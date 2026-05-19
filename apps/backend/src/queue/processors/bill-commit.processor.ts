import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BillStatus, Prisma } from '@prisma/client';
import { WsEvent } from '@billing/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BillingGateway } from '../../websocket/billing.gateway';
import { BILL_COMMIT_QUEUE, BillCommitJobData } from '../queue.constants';
import { BillCommitProducer } from '../bill-commit.producer';
import { InvoiceService } from '../../invoice/invoice.service';
import { StockMovementService } from '../../inventory/stock-movement.service';
import { StockMovementType } from '@prisma/client';

@Processor(BILL_COMMIT_QUEUE, { concurrency: 1 })
export class BillCommitProcessor extends WorkerHost {
  private readonly logger = new Logger(BillCommitProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: BillingGateway,
    private readonly commitProducer: BillCommitProducer,
    private readonly invoiceService: InvoiceService,
    private readonly movements: StockMovementService,
  ) {
    super();
  }

  async process(job: Job<BillCommitJobData>): Promise<void> {
    const { billId, counterId } = job.data;
    this.logger.log(`Processing bill commit: ${billId}`);

    await this.prisma.bill.update({
      where: { id: billId },
      data: { status: BillStatus.COMMITTING },
    });

    try {
      let invoiceNo = '';

      await this.prisma.$transaction(async (tx) => {
        const bill = await tx.bill.findUniqueOrThrow({
          where: { id: billId },
          include: { items: true },
        });

        for (const item of bill.items) {
          if (!item.batchId) continue;

          const batches = await tx.$queryRaw<
            { id: string; stock_qty: number; pending_qty: number }[]
          >`
            SELECT id, stock_qty, pending_qty
            FROM batch_stock
            WHERE id = ${item.batchId}
            FOR UPDATE
          `;

          const batch = batches[0];
          if (!batch) throw new Error(`Batch not found: ${item.batchId}`);

          const stockQty = Number(batch.stock_qty);
          const pendingQty = Number(batch.pending_qty);
          const requestedQty = Number(item.qty);

          // Qty is already reserved in pending_qty — check physical stock only.
          if (stockQty + 0.0001 < requestedQty) {
            throw new Error(
              `Insufficient stock for batch ${item.batchNumber}: on hand ${stockQty}, requested ${requestedQty}`,
            );
          }
          if (pendingQty + 0.0001 < requestedQty) {
            throw new Error(
              `Reservation mismatch for batch ${item.batchNumber}: pending ${pendingQty}, requested ${requestedQty}`,
            );
          }

          await tx.batchStock.update({
            where: { id: item.batchId },
            data: {
              stockQty: { decrement: requestedQty },
              pendingQty: { decrement: requestedQty },
            },
          });

          await this.movements.logMovementOnly(tx, {
            batchId: item.batchId,
            productId: item.productId,
            movementType: StockMovementType.SALE_COMMIT,
            qtyDelta: -requestedQty,
            qtyBefore: stockQty,
            qtyAfter: stockQty - requestedQty,
            referenceType: 'Bill',
            referenceId: billId,
            userId: bill.userId,
          });
        }

        invoiceNo = await this.createInvoice(tx, billId);

        await tx.bill.update({
          where: { id: billId },
          data: {
            status: BillStatus.COMPLETED,
            committedAt: new Date(),
            billNo: invoiceNo,
          },
        });
      });

      const bill = await this.prisma.bill.findUnique({
        where: { id: billId },
        include: { items: true, invoice: true },
      });

      if (bill) {
        for (const item of bill.items) {
          if (!item.batchId) continue;
          const batch = await this.prisma.batchStock.findUnique({
            where: { id: item.batchId },
          });
          if (batch) {
            const stockQty = Number(batch.stockQty);
            const pendingQty = Number(batch.pendingQty);
            await this.redis.syncPendingQty(item.batchId, pendingQty);
            const snapshot = {
              batchId: item.batchId,
              productId: item.productId,
              stockQty,
              pendingQty,
              availableQty: stockQty - pendingQty,
              updatedAt: new Date().toISOString(),
            };
            await this.redis.publishStockSnapshot(snapshot);
            this.gateway.emitStockCommitted(snapshot);
          }
        }

        this.gateway.emitBillCompleted({
          billId,
          invoiceNo: bill.invoice?.invoiceNo ?? invoiceNo,
          counterId,
        });

        try {
          await this.invoiceService.generatePdfForBill(billId);
        } catch (pdfErr) {
          this.logger.warn(
            `PDF generation failed for ${billId}: ${pdfErr instanceof Error ? pdfErr.message : pdfErr}`,
          );
        }
      }

      const stats = await this.commitProducer.getQueueStats();
      this.gateway.emitQueueStatus({
        waiting: stats.waiting,
        active: stats.active,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Commit failed';
      this.logger.error(`Bill commit failed: ${billId}`, message);

      await this.prisma.bill.update({
        where: { id: billId },
        data: { status: BillStatus.FAILED_STOCK, commitError: message },
      });

      const bill = await this.prisma.bill.findUnique({
        where: { id: billId },
        include: { items: true },
      });

      if (bill) {
        for (const item of bill.items) {
          if (!item.batchId) continue;
          await this.prisma.batchStock.update({
            where: { id: item.batchId },
            data: { pendingQty: { decrement: Number(item.qty) } },
          });
          await this.redis.adjustPendingQty(item.batchId, -Number(item.qty));
        }

        await this.redis.releasePendingForBill(
          billId,
          bill.items
            .filter((i) => i.batchId)
            .map((i) => ({ batchId: i.batchId!, qty: Number(i.qty) })),
        );

        for (const item of bill.items) {
          if (!item.batchId) continue;
          const batch = await this.prisma.batchStock.findUnique({
            where: { id: item.batchId },
          });
          if (!batch) continue;
          const stockQty = Number(batch.stockQty);
          const pendingQty = Number(batch.pendingQty);
          const view = {
            batchId: item.batchId,
            productId: item.productId,
            stockQty,
            pendingQty,
            availableQty: stockQty - pendingQty,
          };
          this.gateway.emitStockPendingUpdated(view);
          this.gateway.emitStockFailed({
            ...view,
            billId,
            reason: message,
          });
        }
      }

      throw error;
    }
  }

  private async createInvoice(tx: Prisma.TransactionClient, billId: string): Promise<string> {
    const company = await tx.company.findFirst({ where: { isActive: true } });
    if (!company) throw new Error('No active company for invoice');

    const year = new Date().getFullYear();
    const seq = await tx.invoiceSequence.upsert({
      where: { id: 'default' },
      create: { id: 'default', year, lastNo: 1, prefix: 'INV' },
      update: {
        lastNo: { increment: 1 },
        year,
      },
    });

    const invoiceNo = `${seq.prefix}/${year}/${String(seq.lastNo).padStart(5, '0')}`;

    await tx.invoice.create({
      data: {
        invoiceNo,
        billId,
        companyId: company.id,
        invoiceDate: new Date(),
      },
    });

    return invoiceNo;
  }
}

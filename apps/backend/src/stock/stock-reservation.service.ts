import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { BatchStockSnapshot } from '@billing/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
@Injectable()
export class StockReservationService {
  private readonly logger = new Logger(StockReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Row-locked reserve: DB pending_qty is source of truth; Redis mirror + pub/sub for real-time UI.
   */
  async reserve(
    batchId: string,
    billId: string,
    productId: string,
    qty: number,
    counterId?: string,
    lineQtyHint?: number,
  ) {
    const batch = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string; stock_qty: Prisma.Decimal; pending_qty: Prisma.Decimal; is_active: boolean }[]
      >`
        SELECT id, stock_qty, pending_qty, is_active
        FROM batch_stock
        WHERE id = ${batchId}
        FOR UPDATE
      `;
      const row = rows[0];
      if (!row) throw new NotFoundException('Batch not found');
      if (!row.is_active) {
        throw new BadRequestException('Batch is inactive and cannot be sold');
      }

      const stockQty = Number(row.stock_qty);
      const pendingQty = Number(row.pending_qty);
      const available = stockQty - pendingQty;

      if (available + 0.0001 < qty) {
        throw new BadRequestException(
          `Insufficient stock (available ${Math.max(0, Math.round(available * 100) / 100)})`,
        );
      }

      return tx.batchStock.update({
        where: { id: batchId },
        data: { pendingQty: { increment: qty } },
      });
    });

    await this.redis.adjustPendingQty(batchId, qty);
    await this.redis.trackBillReservation(billId, batchId, qty);
    await this.broadcast(batchId, productId, batch, { billId, counterId, lineQtyHint });
    return batch;
  }

  async release(
    batchId: string,
    billId: string,
    productId: string,
    qty: number,
    counterId?: string,
  ) {
    const batch = await this.prisma.batchStock.update({
      where: { id: batchId },
      data: { pendingQty: { decrement: qty } },
    });
    await this.redis.adjustPendingQty(batchId, -qty);
    await this.redis.trackBillReservation(billId, batchId, -qty);
    await this.broadcast(batchId, productId, batch, { billId, counterId });
    return batch;
  }

  async releaseAllForBill(
    billId: string,
    items: { batchId: string | null; productId: string; qty: number }[],
    counterId?: string,
  ) {
    for (const item of items) {
      if (!item.batchId) continue;
      await this.release(item.batchId, billId, item.productId, Number(item.qty), counterId);
    }
    await this.redis.clearBillSession(billId);
  }

  async touchSession(billId: string) {
    await this.redis.touchBillSession(billId);
  }

  /** Reconcile Redis pending cache with DB for a batch after commit or drift. */
  async reconcileBatch(batchId: string, productId: string) {
    const batch = await this.prisma.batchStock.findUnique({ where: { id: batchId } });
    if (!batch) return;
    const dbPending = Number(batch.pendingQty);
    const redisPending = await this.redis.getPendingQty(batchId);
    if (Math.abs(redisPending - dbPending) > 0.001) {
      this.logger.warn(
        `Redis/DB pending drift batch=${batchId}: redis=${redisPending} db=${dbPending}`,
      );
      await this.redis.syncPendingQty(batchId, dbPending);
    }
    await this.broadcast(batchId, productId, batch);
  }

  private async broadcast(
    batchId: string,
    productId: string,
    batch: { stockQty: Prisma.Decimal; pendingQty: Prisma.Decimal },
    opts?: {
      billId?: string;
      counterId?: string;
      counterName?: string;
      lineId?: string;
      lineQtyHint?: number;
      attemptedQty?: number;
    },
  ) {
    const stockQty = Number(batch.stockQty);
    const pendingQty = Number(batch.pendingQty);
    const poolFree = stockQty - pendingQty;
    const availableQty = poolFree;
    let shortageQty: number | undefined;
    if (opts?.attemptedQty != null && opts.lineQtyHint != null) {
      const sellable = stockQty - pendingQty + opts.lineQtyHint;
      shortageQty = Math.max(0, opts.attemptedQty - sellable);
    } else if (opts?.lineQtyHint != null) {
      const sellable = stockQty - pendingQty + opts.lineQtyHint;
      shortageQty = Math.max(0, opts.lineQtyHint - sellable);
    }

    const snapshot: BatchStockSnapshot = {
      batchId,
      productId,
      stockQty,
      pendingQty,
      availableQty,
      shortageQty: shortageQty != null && shortageQty > 0.001 ? shortageQty : 0,
      attemptedQty: opts?.attemptedQty ?? opts?.lineQtyHint,
      billId: opts?.billId,
      lineId: opts?.lineId,
      counterId: opts?.counterId,
      counterName: opts?.counterName,
      updatedAt: new Date().toISOString(),
    };

    await this.redis.publishStockSnapshot(snapshot);
  }

  /** Broadcast shortage to all counters (no reservation change). */
  async publishShortageAlert(
    batchId: string,
    productId: string,
    opts: {
      billId: string;
      lineId: string;
      counterId: string;
      counterName: string;
      attemptedQty: number;
      currentLineQty: number;
    },
  ) {
    const batch = await this.prisma.batchStock.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    await this.broadcast(batchId, productId, batch, {
      billId: opts.billId,
      lineId: opts.lineId,
      counterId: opts.counterId,
      counterName: opts.counterName,
      lineQtyHint: opts.currentLineQty,
      attemptedQty: opts.attemptedQty,
    });
  }
}

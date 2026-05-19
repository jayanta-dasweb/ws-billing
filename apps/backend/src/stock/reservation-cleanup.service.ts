import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BillStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingGateway } from '../websocket/billing.gateway';
import { StockReservationService } from './stock-reservation.service';

@Injectable()
export class ReservationCleanupService {
  private readonly logger = new Logger(ReservationCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: StockReservationService,
    private readonly gateway: BillingGateway,
    private readonly config: ConfigService,
  ) {}

  /** Release reservations for abandoned draft/hold bills (browser closed, no heartbeat). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseStaleBillReservations() {
    const minutes = this.config.get<number>('RESERVATION_INACTIVITY_MINUTES', 30);
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    const stale = await this.prisma.bill.findMany({
      where: {
        status: { in: [BillStatus.DRAFT, BillStatus.HOLD] },
        updatedAt: { lt: cutoff },
        items: { some: {} },
      },
      include: { items: true },
      take: 50,
    });

    for (const bill of stale) {
      try {
        await this.reservations.releaseAllForBill(
          bill.id,
          bill.items.map((i) => ({
            batchId: i.batchId,
            productId: i.productId,
            qty: Number(i.qty),
          })),
          bill.counterId,
        );

        await this.prisma.bill.update({
          where: { id: bill.id },
          data: {
            status: BillStatus.CANCELLED,
            commitError: 'Session expired — stock released automatically',
          },
        });

        this.gateway.emitBillCancelled({ billId: bill.id, counterId: bill.counterId });
        this.logger.log(`Auto-cancelled stale bill ${bill.id} (no activity ${minutes}m)`);
      } catch (e) {
        this.logger.error(`Failed stale cleanup for bill ${bill.id}`, e);
      }
    }
  }

  /** Align Redis pending counters with DB for active batches (drift recovery). */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileRedisPending() {
    const batches = await this.prisma.batchStock.findMany({
      where: { pendingQty: { gt: 0 } },
      select: { id: true, productId: true, pendingQty: true },
      take: 200,
    });

    for (const b of batches) {
      await this.reservations.reconcileBatch(b.id, b.productId);
    }
  }
}

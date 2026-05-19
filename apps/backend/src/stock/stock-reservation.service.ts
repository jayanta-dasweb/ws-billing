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

    await this.redis.syncPendingQty(batchId, Number(batch.pendingQty));
    await this.redis.trackBillReservation(billId, batchId, qty);
    await this.broadcast(batchId, productId, batch, {
      billId,
      counterId,
      shortageQty: 0,
    });
    return batch;
  }

  async release(
    batchId: string,
    billId: string,
    productId: string,
    qty: number,
    counterId?: string,
    meta?: {
      lineId?: string;
      counterName?: string;
      lineQtyHint?: number;
      /** Skip pub/sub when release is an intermediate step (e.g. before re-reserve on qty change). */
      suppressBroadcast?: boolean;
    },
  ) {
    const batch = await this.prisma.batchStock.update({
      where: { id: batchId },
      data: { pendingQty: { decrement: qty } },
    });
    await this.redis.syncPendingQty(batchId, Number(batch.pendingQty));
    await this.redis.trackBillReservation(billId, batchId, -qty);
    if (!meta?.suppressBroadcast) {
      await this.broadcast(batchId, productId, batch, {
        billId,
        counterId,
        lineId: meta?.lineId,
        counterName: meta?.counterName,
        lineQtyHint: meta?.lineQtyHint ?? 0,
        attemptedQty: 0,
        shortageQty: 0,
      });
    }
    return batch;
  }

  /** Reserve up to free pool (used when full qty is not available). Returns units reserved. */
  async reserveAvailable(
    batchId: string,
    billId: string,
    productId: string,
    counterId: string | undefined,
    lineQtyHint: number,
    meta?: { lineId?: string; counterName?: string },
  ): Promise<number> {
    const batch = await this.prisma.batchStock.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    const available = Math.max(
      0,
      Number(batch.stockQty) - Number(batch.pendingQty),
    );
    if (available <= 0.001) return 0;
    await this.reserve(batchId, billId, productId, available, counterId, lineQtyHint);
    return available;
  }

  /** After line qty change: broadcast pool + shortage (or clear shortage) to all counters. */
  async publishLineStockState(
    batchId: string,
    productId: string,
    opts: {
      billId: string;
      lineId: string;
      counterId: string;
      counterName?: string;
      lineQty: number;
      /** Units actually reserved for this bill line after the change. */
      reservedForLine: number;
    },
  ) {
    const batch = await this.prisma.batchStock.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    const shortageQty = Math.max(0, opts.lineQty - opts.reservedForLine);
    const now = new Date().toISOString();
    if (shortageQty > 0.001) {
      await this.redis.setEphemeralShortage({
        batchId,
        productId,
        billId: opts.billId,
        lineId: opts.lineId,
        counterId: opts.counterId,
        counterName: opts.counterName,
        lineQty: opts.lineQty,
        reservedQty: opts.reservedForLine,
        shortageQty,
        ephemeral: true,
        updatedAt: now,
      });
    } else {
      await this.redis.clearEphemeralShortage(batchId, opts.billId, opts.lineId);
    }
    await this.broadcast(batchId, productId, batch, {
      billId: opts.billId,
      lineId: opts.lineId,
      counterId: opts.counterId,
      counterName: opts.counterName,
      lineQtyHint: opts.lineQty,
      attemptedQty: opts.lineQty,
      shortageQty,
      ephemeralShortage: shortageQty > 0.001,
    });
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
    await this.redis.clearEphemeralShortagesForBill(billId);
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
      shortageQty?: number;
      ephemeralShortage?: boolean;
    },
  ) {
    const stockQty = Number(batch.stockQty);
    const pendingQty = Number(batch.pendingQty);
    const availableQty = stockQty - pendingQty;
    let shortageQty: number | undefined = opts?.shortageQty;
    if (shortageQty == null && opts?.attemptedQty != null && opts.lineQtyHint != null) {
      const sellable = stockQty - pendingQty + opts.lineQtyHint;
      shortageQty = Math.max(0, opts.attemptedQty - sellable);
    } else if (shortageQty == null && opts?.lineQtyHint != null) {
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
      ephemeralShortage: opts?.ephemeralShortage,
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
      reservedQty?: number;
    },
  ) {
    const batch = await this.prisma.batchStock.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    const reserved = opts.reservedQty ?? opts.currentLineQty;
    const shortageQty = Math.max(0, opts.attemptedQty - reserved);
    if (shortageQty > 0.001) {
      await this.redis.setEphemeralShortage({
        batchId,
        productId,
        billId: opts.billId,
        lineId: opts.lineId,
        counterId: opts.counterId,
        counterName: opts.counterName,
        lineQty: opts.attemptedQty,
        reservedQty: reserved,
        shortageQty,
        ephemeral: true,
        updatedAt: new Date().toISOString(),
      });
    }
    await this.broadcast(batchId, productId, batch, {
      billId: opts.billId,
      lineId: opts.lineId,
      counterId: opts.counterId,
      counterName: opts.counterName,
      lineQtyHint: opts.attemptedQty,
      attemptedQty: opts.attemptedQty,
      shortageQty,
      ephemeralShortage: shortageQty > 0.001,
    });
  }
}

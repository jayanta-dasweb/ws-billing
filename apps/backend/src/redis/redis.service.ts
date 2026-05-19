import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BatchStockSnapshot,
  EphemeralShortageRecord,
  STOCK_EVENTS_CHANNEL,
} from '@billing/shared';
import Redis from 'ioredis';

const PENDING_KEY = (batchId: string) => `stock:pending:${batchId}`;
const BATCH_VIEW_KEY = (batchId: string) => `stock:view:${batchId}`;
const BILL_SESSION_KEY = (billId: string) => `bill:session:${billId}`;
const BILL_RESERVE_KEY = (billId: string) => `bill:reserve:${billId}`;
const IDEMPOTENCY_KEY = (scope: string, key: string) => `idempotency:${scope}:${key}`;
const LINE_SHORTAGE_KEY = (batchId: string, billId: string, lineId: string) =>
  `stock:shortage:${batchId}:${billId}:${lineId}`;
const BILL_SHORTAGE_INDEX = (billId: string) => `stock:shortage:bill:${billId}`;

type StockEventHandler = (payload: BatchStockSnapshot) => void;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly subscriber: Redis;
  private stockHandler: StockEventHandler | null = null;

  constructor(private readonly config: ConfigService) {
    const opts = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: null,
    };
    this.client = new Redis(opts);
    this.subscriber = new Redis(opts);
  }

  onModuleInit() {
    void this.subscriber.subscribe(STOCK_EVENTS_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== STOCK_EVENTS_CHANNEL || !this.stockHandler) return;
      try {
        this.stockHandler(JSON.parse(message) as BatchStockSnapshot);
      } catch (e) {
        this.logger.warn(`Invalid stock event payload: ${e}`);
      }
    });
  }

  onStockEvent(handler: StockEventHandler) {
    this.stockHandler = handler;
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  reservationTtlSec(): number {
    const minutes = this.config.get<number>('RESERVATION_INACTIVITY_MINUTES', 30);
    return Math.max(60, minutes * 60);
  }

  async adjustPendingQty(batchId: string, delta: number): Promise<number> {
    const key = PENDING_KEY(batchId);
    const result = await this.client.incrbyfloat(key, delta);
    const n = parseFloat(result);
    if (n < 0) {
      await this.client.set(key, '0');
      return 0;
    }
    return n;
  }

  async syncPendingQty(batchId: string, dbPendingQty: number): Promise<void> {
    await this.client.set(PENDING_KEY(batchId), String(dbPendingQty));
  }

  async getPendingQty(batchId: string): Promise<number> {
    const val = await this.client.get(PENDING_KEY(batchId));
    return val ? parseFloat(val) : 0;
  }

  async setBatchView(batchId: string, data: Record<string, unknown>, ttlSec = 300): Promise<void> {
    await this.client.setex(BATCH_VIEW_KEY(batchId), ttlSec, JSON.stringify(data));
  }

  async getBatchView(batchId: string): Promise<Record<string, unknown> | null> {
    const val = await this.client.get(BATCH_VIEW_KEY(batchId));
    return val ? (JSON.parse(val) as Record<string, unknown>) : null;
  }

  async touchBillSession(billId: string): Promise<void> {
    const ttl = this.reservationTtlSec();
    await this.client.setex(BILL_SESSION_KEY(billId), ttl, Date.now().toString());
    await this.client.expire(BILL_RESERVE_KEY(billId), ttl);
  }

  async trackBillReservation(billId: string, batchId: string, qty: number): Promise<void> {
    const key = BILL_RESERVE_KEY(billId);
    await this.client.hincrbyfloat(key, batchId, qty);
    const val = await this.client.hget(key, batchId);
    if (val != null && parseFloat(val) < 0) {
      await this.client.hset(key, batchId, '0');
    }
    await this.touchBillSession(billId);
  }

  /** Replace bill's reserved qty on a batch (after reconcile). */
  async setBillBatchReservation(billId: string, batchId: string, qty: number): Promise<void> {
    const key = BILL_RESERVE_KEY(billId);
    if (qty <= 0.001) {
      await this.client.hdel(key, batchId);
    } else {
      await this.client.hset(key, batchId, String(qty));
    }
    await this.touchBillSession(billId);
  }

  async getBillReservations(billId: string): Promise<Record<string, number>> {
    const raw = await this.client.hgetall(BILL_RESERVE_KEY(billId));
    const out: Record<string, number> = {};
    for (const [batchId, val] of Object.entries(raw)) {
      out[batchId] = parseFloat(val);
    }
    return out;
  }

  async clearBillSession(billId: string): Promise<void> {
    await this.client.del(BILL_SESSION_KEY(billId), BILL_RESERVE_KEY(billId));
  }

  async releasePendingForBill(billId: string, items: { batchId: string; qty: number }[]): Promise<void> {
    const pipeline = this.client.pipeline();
    for (const item of items) {
      if (item.batchId) {
        pipeline.incrbyfloat(PENDING_KEY(item.batchId), -item.qty);
      }
    }
    pipeline.del(BILL_RESERVE_KEY(billId));
    pipeline.del(BILL_SESSION_KEY(billId));
    await pipeline.exec();
  }

  async publishStockSnapshot(snapshot: BatchStockSnapshot): Promise<void> {
    await this.setBatchView(snapshot.batchId, snapshot as unknown as Record<string, unknown>);
    await this.client.publish(STOCK_EVENTS_CHANNEL, JSON.stringify(snapshot));
  }

  /** Shortage signal for open bills — Redis only, never copied to MySQL pending_qty. */
  async setEphemeralShortage(record: EphemeralShortageRecord, ttlSec?: number): Promise<void> {
    const ttl = ttlSec ?? this.reservationTtlSec();
    const key = LINE_SHORTAGE_KEY(record.batchId, record.billId, record.lineId);
    await this.client.setex(key, ttl, JSON.stringify(record));
    await this.client.sadd(BILL_SHORTAGE_INDEX(record.billId), key);
    await this.client.expire(BILL_SHORTAGE_INDEX(record.billId), ttl);
  }

  async clearEphemeralShortage(
    batchId: string,
    billId: string,
    lineId: string,
  ): Promise<void> {
    const key = LINE_SHORTAGE_KEY(batchId, billId, lineId);
    await this.client.del(key);
    await this.client.srem(BILL_SHORTAGE_INDEX(billId), key);
  }

  async clearEphemeralShortagesForBill(billId: string): Promise<void> {
    const index = BILL_SHORTAGE_INDEX(billId);
    const keys = await this.client.smembers(index);
    if (keys.length) {
      await this.client.del(...keys, index);
    } else {
      await this.client.del(index);
    }
  }

  async getEphemeralShortage(
    batchId: string,
    billId: string,
    lineId: string,
  ): Promise<EphemeralShortageRecord | null> {
    const raw = await this.client.get(LINE_SHORTAGE_KEY(batchId, billId, lineId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as EphemeralShortageRecord;
    } catch {
      return null;
    }
  }

  async getIdempotencyResult<T>(scope: string, key: string): Promise<T | null> {
    const val = await this.client.get(IDEMPOTENCY_KEY(scope, key));
    return val ? (JSON.parse(val) as T) : null;
  }

  async setIdempotencyResult(scope: string, key: string, result: unknown, ttlSec = 86400): Promise<void> {
    await this.client.setex(IDEMPOTENCY_KEY(scope, key), ttlSec, JSON.stringify(result));
  }

  onModuleDestroy() {
    this.subscriber.disconnect();
    this.client.disconnect();
  }
}

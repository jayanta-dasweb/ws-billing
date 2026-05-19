import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BatchStockSnapshot, STOCK_EVENTS_CHANNEL } from '@billing/shared';
import Redis from 'ioredis';

const PENDING_KEY = (batchId: string) => `stock:pending:${batchId}`;
const BATCH_VIEW_KEY = (batchId: string) => `stock:view:${batchId}`;
const BILL_SESSION_KEY = (billId: string) => `bill:session:${billId}`;
const BILL_RESERVE_KEY = (billId: string) => `bill:reserve:${billId}`;
const IDEMPOTENCY_KEY = (scope: string, key: string) => `idempotency:${scope}:${key}`;

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
    await this.client.hincrbyfloat(BILL_RESERVE_KEY(billId), batchId, qty);
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

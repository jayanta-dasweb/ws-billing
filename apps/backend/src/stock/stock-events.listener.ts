import { Injectable, OnModuleInit } from '@nestjs/common';
import type { BatchStockSnapshot } from '@billing/shared';
import { RedisService } from '../redis/redis.service';
import { BillingGateway } from '../websocket/billing.gateway';

/**
 * Forwards Redis pub/sub stock events to Socket.IO (supports multi-instance backends).
 */
@Injectable()
export class StockEventsListener implements OnModuleInit {
  constructor(
    private readonly redis: RedisService,
    private readonly gateway: BillingGateway,
  ) {}

  onModuleInit() {
    this.redis.onStockEvent((payload: BatchStockSnapshot) => {
      this.gateway.emitStockPendingUpdated(payload);
    });
  }
}

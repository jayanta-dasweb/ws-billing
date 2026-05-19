import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebsocketModule } from '../websocket/websocket.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { InventoryModule } from '../inventory/inventory.module';
import { BILL_COMMIT_QUEUE } from './queue.constants';
import { BillCommitProcessor } from './processors/bill-commit.processor';
import { BillCommitProducer } from './bill-commit.producer';

@Module({
  imports: [
    WebsocketModule,
    InvoiceModule,
    InventoryModule,
    BullModule.registerQueue({
      name: BILL_COMMIT_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),
  ],
  providers: [BillCommitProcessor, BillCommitProducer],
  exports: [BillCommitProducer, BullModule],
})
export class QueueModule {}

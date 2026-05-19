import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BILL_COMMIT_QUEUE, BillCommitJobData } from './queue.constants';

@Injectable()
export class BillCommitProducer {
  constructor(
    @InjectQueue(BILL_COMMIT_QUEUE) private readonly queue: Queue<BillCommitJobData>,
  ) {}

  async enqueue(data: BillCommitJobData): Promise<string> {
    const job = await this.queue.add('commit', data, {
      jobId: `bill-${data.billId}`,
    });
    return job.id ?? data.billId;
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }
}

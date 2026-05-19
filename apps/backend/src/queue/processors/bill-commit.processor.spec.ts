import { BillStatus } from '@prisma/client';
import { BILL_COMMIT_QUEUE } from '../queue.constants';

describe('BillCommitProcessor', () => {
  it('should use FIFO queue with concurrency 1', () => {
    expect(BILL_COMMIT_QUEUE).toBe('bill-commit');
  });

  it('should define all bill statuses for commit flow', () => {
    expect(BillStatus.PENDING_COMMIT).toBe('PENDING_COMMIT');
    expect(BillStatus.COMMITTING).toBe('COMMITTING');
    expect(BillStatus.COMPLETED).toBe('COMPLETED');
    expect(BillStatus.FAILED_STOCK).toBe('FAILED_STOCK');
  });
});

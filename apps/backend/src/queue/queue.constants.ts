export const BILL_COMMIT_QUEUE = 'bill-commit';

export interface BillCommitJobData {
  billId: string;
  counterId: string;
  userId: string;
}

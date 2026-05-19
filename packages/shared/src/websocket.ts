export enum WsEvent {
  STOCK_PENDING_UPDATED = 'stock_pending_updated',
  STOCK_COMMITTED = 'stock_committed',
  STOCK_FAILED = 'stock_failed',
  BILL_COMPLETED = 'bill_completed',
  BILL_CANCELLED = 'bill_cancelled',
  BILL_TRANSFERRED = 'bill_transferred',
  COUNTER_ONLINE = 'counter_online',
  COUNTER_OFFLINE = 'counter_offline',
  QUEUE_STATUS_UPDATED = 'queue_status_updated',
}

export interface StockPendingUpdatedPayload {
  batchId: string;
  productId: string;
  stockQty: number;
  pendingQty: number;
  availableQty: number;
  /** How many units this line needs beyond available (0 = OK). */
  shortageQty?: number;
  attemptedQty?: number;
  billId?: string;
  lineId?: string;
  counterId?: string;
  counterName?: string;
  updatedAt?: string;
  ephemeralShortage?: boolean;
}

export interface BillCompletedPayload {
  billId: string;
  invoiceNo: string;
  counterId: string;
}

export interface BillTransferredPayload {
  billId: string;
  fromCounterId: string;
  toCounterId: string;
  toUserId: string;
  toUsername: string;
}

/** Emitted when bill commit fails — stock is released back to the pool. */
export interface StockFailedPayload {
  batchId: string;
  billId: string;
  reason: string;
  productId?: string;
  stockQty?: number;
  pendingQty?: number;
  availableQty?: number;
}

/** Real-time stock snapshot broadcast to all billing counters (WebSocket + Redis pub/sub). */
export interface BatchStockSnapshot {
  batchId: string;
  productId: string;
  stockQty: number;
  pendingQty: number;
  availableQty: number;
  /** Units short vs a specific line qty (optional, for targeted UI hints). */
  shortageQty?: number;
  attemptedQty?: number;
  billId?: string;
  lineId?: string;
  counterId?: string;
  counterName?: string;
  updatedAt: string;
}

export const STOCK_EVENTS_CHANNEL = 'billing:stock:events';

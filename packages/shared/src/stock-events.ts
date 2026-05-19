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
  /** True when shortage is Redis-only (line qty > reserved); not extra MySQL pending. */
  ephemeralShortage?: boolean;
}

/** Redis-only shortage record (not written to batch_stock.pending_qty). */
export interface EphemeralShortageRecord {
  batchId: string;
  productId: string;
  billId: string;
  lineId: string;
  counterId: string;
  counterName?: string;
  lineQty: number;
  reservedQty: number;
  shortageQty: number;
  ephemeral: true;
  updatedAt: string;
}

export const STOCK_EVENTS_CHANNEL = 'billing:stock:events';

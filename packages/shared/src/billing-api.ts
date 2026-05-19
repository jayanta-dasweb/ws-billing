import type { BillStatus, PaymentMode } from './bill';
import type { PaymentAuditDetails } from './payment-audit';
export type { PaymentAuditDetails } from './payment-audit';

/** Open-bill reservations on one batch, grouped by counter (all counters see this on WebSocket sync). */
export interface BatchCounterHoldDto {
  counterId: string;
  counterName: string;
  reservedQty: number;
}

export interface BatchStockHoldSummaryDto {
  batchId: string;
  batchNumber: string;
  stockQty: number;
  pendingQty: number;
  availableQty: number;
  counters: BatchCounterHoldDto[];
}

export interface BillLineDto {
  id: string;
  productId: string;
  batchId: string | null;
  productName: string;
  batchNumber: string | null;
  barcode?: string | null;
  hsnCode: string | null;
  qty: number;
  rate: number;
  discount: number;
  gstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
  /** Physical stock in batch. */
  stockQty?: number;
  /** Total reserved (all open bills). */
  pendingQty?: number;
  /** Free pool in batch: stock − pending (all open bills). */
  availableQty?: number;
  /** Units reserved on this bill for this batch (from Redis session). */
  reservedQty?: number;
  /** Units on the line not covered by reservation (line qty − reserved). */
  shortageQty?: number;
}

export interface BillPaymentDto {
  id: string;
  mode: PaymentMode;
  amount: number;
  reference: string | null;
  audit?: PaymentAuditDetails | null;
}

export interface BillDto {
  id: string;
  billNo: string | null;
  status: BillStatus;
  counterId: string;
  customerId: string | null;
  customerName?: string;
  customerMobile?: string | null;
  customerGst?: string | null;
  customerPan?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  subtotal: number;
  lineDiscountTotal?: number;
  discountTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  rawGrandTotal?: number;
  roundOff: number;
  grandTotal: number;
  paymentMode: PaymentMode | null;
  cashReceived?: number | null;
  balanceReturn?: number | null;
  payments?: BillPaymentDto[];
  items: BillLineDto[];
  invoiceNo?: string | null;
  commitError?: string | null;
}

export interface ScanLineDto {
  barcode: string;
  qty?: number;
}

export interface AddProductLineDto {
  productId: string;
  batchId?: string;
  qty?: number;
}

export interface CatalogBatchDto {
  id: string;
  batchNumber: string;
  expiryDate: string | null;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  discountPerUnit: number;
  stockQty: number;
  pendingQty: number;
  availableQty: number;
}

export interface CatalogProductDto {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  hsnCode: string | null;
  gstPercent: number;
  batches: CatalogBatchDto[];
}

export interface UpdateLineQtyDto {
  qty: number;
}

export interface UpdateLineDto {
  qty?: number;
  discount?: number;
  discountPercent?: number;
}

/** Cashier-controlled round-off (default is exact paise, no round). */
export type BillRoundOffMode = 'none' | 'nearest';

export interface SetBillRoundOffDto {
  mode: BillRoundOffMode;
}

export interface BillSummaryDto {
  id: string;
  status: BillStatus;
  customerName?: string;
  itemCount: number;
  grandTotal: number;
  invoiceNo?: string | null;
  /** Stable tab order (left → right); do not sort tabs by updatedAt. */
  createdAt: string;
  updatedAt: string;
}

export interface OnlineCounterDto {
  counterId: string;
  counterName: string;
  userId: string;
  username: string;
}

export interface TransferBillDto {
  targetCounterId: string;
}

export interface TransferBillResult {
  billId: string;
  counterId: string;
  counterName: string;
  assignedToUsername: string;
}

export interface SetBillCustomerDto {
  customerId: string;
}

export interface SetBillDiscountDto {
  /** Bill-level discount in ₹ (after line discounts) */
  amount?: number;
  /** Bill-level discount as % of total before bill discount */
  percent?: number;
}

export interface PaymentSplitDto {
  mode: PaymentMode;
  amount: number;
  /** Legacy single-line ref; prefer audit fields */
  reference?: string;
  cashTendered?: number;
  audit?: PaymentAuditDetails;
}

export interface CompleteBillDto {
  paymentMode: PaymentMode;
  cashReceived?: number;
  splits?: PaymentSplitDto[];
  /** Structured audit fields for single-mode payment */
  audit?: PaymentAuditDetails;
  /** Credit sale note (also mapped into audit when provided) */
  creditNote?: string;
}

export interface CreateBillDto {
  counterId?: string;
  customerId?: string;
}

export interface CleanupEmptyDraftsResult {
  cancelled: number;
}

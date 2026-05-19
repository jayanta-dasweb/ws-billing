import type { PaymentMode } from './bill';

export type ReturnStatusDto = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type ReturnTypeDto = 'FULL' | 'PARTIAL';

export interface ReturnableBillDto {
  billId: string;
  billNo: string | null;
  invoiceNo: string | null;
  customerName: string | null;
  grandTotal: number;
  items: {
    id: string;
    productId: string;
    productName: string;
    batchId: string | null;
    batchNumber: string | null;
    soldQty: number;
    returnableQty: number;
    rate: number;
    lineTotal: number;
  }[];
}

export interface ReturnLineInputDto {
  billItemId: string;
  qty: number;
  reason?: string;
}

export interface CreateReturnDto {
  billId: string;
  returnType: ReturnTypeDto;
  lines: ReturnLineInputDto[];
  refundMode?: PaymentMode;
  refundNote?: string;
}

export interface SalesReturnDto {
  id: string;
  returnNo: string | null;
  status: ReturnStatusDto;
  returnType: ReturnTypeDto;
  billId: string;
  invoiceNo: string | null;
  refundTotal: number;
  refundMode: PaymentMode | null;
  refundNote: string | null;
  items: {
    id: string;
    billItemId: string;
    productName: string;
    batchNumber: string | null;
    qty: number;
    rate: number;
    lineTotal: number;
    reason: string | null;
  }[];
  createdAt: string;
  completedAt: string | null;
}

export type StockAdjustmentReasonDto =
  | 'PHYSICAL_COUNT'
  | 'DAMAGE'
  | 'EXPIRED'
  | 'THEFT'
  | 'CORRECTION'
  | 'OTHER';

export interface CreateStockAdjustmentDto {
  batchId: string;
  qtyDelta: number;
  reason: StockAdjustmentReasonDto;
  notes?: string;
}

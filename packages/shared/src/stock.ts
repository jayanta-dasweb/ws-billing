export interface BatchStockView {
  batchId: string;
  productId: string;
  batchNumber: string;
  stockQty: number;
  pendingQty: number;
  availableQty: number;
  expiryDate?: string;
  mrp: number;
  sellingPrice: number;
}

export interface PendingStockUpdate {
  batchId: string;
  deltaQty: number;
  counterId: string;
  billId?: string;
}

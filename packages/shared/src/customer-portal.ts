export interface CustomerBillSummaryDto {
  id: string;
  invoiceNo: string | null;
  status: string;
  grandTotal: number;
  committedAt: string | null;
  createdAt: string;
  itemCount: number;
}

export interface CustomerTopProductDto {
  productId: string;
  productName: string;
  totalQty: number;
  totalSpend: number;
  orderCount: number;
}

export interface CustomerMonthlySpendDto {
  month: string;
  label: string;
  total: number;
  billCount: number;
}

export interface CustomerDashboardDto {
  summary: {
    totalBills: number;
    totalSpend: number;
    averageBill: number;
    firstPurchaseAt: string | null;
    lastPurchaseAt: string | null;
  };
  topByQuantity: CustomerTopProductDto[];
  topBySpend: CustomerTopProductDto[];
  monthlySpend: CustomerMonthlySpendDto[];
  recentBills: CustomerBillSummaryDto[];
}

import type { PaymentMode } from './bill';

export type InvoicePrintFormat = 'a4' | 'thermal';

export interface InvoiceLineDto {
  productName: string;
  hsnCode: string | null;
  batchNumber: string | null;
  qty: number;
  rate: number;
  discount: number;
  gstPercent: number;
  cgstPercent?: number;
  sgstPercent?: number;
  taxableAmount?: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export interface InvoiceTaxSummaryRow {
  gstPercent: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface InvoicePaymentLineDto {
  mode: PaymentMode;
  amount: number;
  reference: string | null;
}

export interface InvoiceLookupDto {
  billId: string;
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  customerMobile: string | null;
  grandTotal: number;
}

export interface InvoiceDetailDto {
  billId: string;
  invoiceNo: string;
  invoiceDate: string;
  isCredit: boolean;
  company: {
    name: string;
    address: string;
    gstin: string | null;
    pan: string | null;
    phone: string | null;
    email: string | null;
    footer: string | null;
    terms: string | null;
  };
  counterName: string;
  customer: {
    name: string;
    mobile: string | null;
    email: string | null;
    gstNumber: string | null;
    panNumber: string | null;
    billingAddress: string | null;
  };
  items: InvoiceLineDto[];
  taxSummary: InvoiceTaxSummaryRow[];
  subtotal: number;
  lineDiscountTotal: number;
  billDiscount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
  paymentMode: PaymentMode | null;
  cashReceived: number | null;
  balanceReturn: number | null;
  payments: InvoicePaymentLineDto[];
  pdfAvailable: boolean;
}

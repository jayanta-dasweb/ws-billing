import type PDFKit from 'pdfkit';
import type { InvoiceDetailDto } from '@billing/shared';
import { amountInWords, formatInr, formatInvoiceDate } from './invoice-pdf.util';

/** PDF-safe currency (Helvetica lacks ₹ glyph in some viewers). */
export function formatRs(n: number): string {
  return `Rs. ${formatInr(n)}`;
}

export const INV = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  accent: '#0d9488',
  accentDark: '#0f766e',
  surface: '#f8fafc',
  white: '#ffffff',
  warn: '#b45309',
  success: '#059669',
} as const;

type Doc = PDFKit.PDFDocument;

export function drawAccentBar(doc: Doc, x: number, y: number, w: number, h: number): void {
  doc.save();
  doc.rect(x, y, w, h).fill(INV.accent);
  doc.restore();
}

export function drawSoftCard(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 6,
): void {
  doc.save();
  doc.roundedRect(x, y, w, h, radius).fill(INV.surface);
  doc.roundedRect(x, y, w, h, radius).lineWidth(0.5).stroke(INV.line);
  doc.restore();
}

export function paymentLabel(detail: InvoiceDetailDto): string {
  if (detail.paymentMode === 'CREDIT' || detail.isCredit) return 'Credit';
  if (detail.payments.length) {
    return detail.payments.map((p) => `${p.mode} ${formatRs(p.amount)}`).join(' · ');
  }
  return detail.paymentMode ?? 'Paid';
}

export function taxableAmount(detail: InvoiceDetailDto): number {
  return detail.subtotal - detail.lineDiscountTotal - detail.billDiscount;
}

export { amountInWords, formatInvoiceDate };

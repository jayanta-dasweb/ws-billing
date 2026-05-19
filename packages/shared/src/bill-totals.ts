import { round2 } from './discount';

export interface LineTotalInput {
  lineTotal: number;
  discount?: number;
}

/** Recompute bill amounts from line totals when server/store totals are stale (e.g. after localStorage rehydrate). */
export function totalsFromLineItems(
  items: LineTotalInput[],
  billDiscount = 0,
  roundOff = 0,
): {
  rawGrandTotal: number;
  exactDue: number;
  grandTotal: number;
  lineDiscountTotal: number;
} {
  const rawGrandTotal = round2(items.reduce((s, i) => s + (i.lineTotal || 0), 0));
  const lineDiscountTotal = round2(items.reduce((s, i) => s + (i.discount ?? 0), 0));
  const extraDisc = round2(Math.max(0, billDiscount));
  const exactDue = round2(Math.max(0, rawGrandTotal - extraDisc));
  const grandTotal = round2(exactDue + roundOff);
  return { rawGrandTotal, exactDue, grandTotal, lineDiscountTotal };
}

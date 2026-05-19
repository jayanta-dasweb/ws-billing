export interface LineCalcInput {
  qty: number;
  rate: number;
  discount: number;
  gstPercent: number;
  cgstPercent: number;
  sgstPercent: number;
}

export interface LineCalcResult {
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export interface BillTotalsResult {
  subtotal: number;
  lineDiscountTotal: number;
  billDiscount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  /** Sum of line totals before bill-level discount */
  rawGrandTotal: number;
  /** Amount due before optional round-off (exact paise) */
  rawAfterBillDiscount: number;
  roundOff: number;
  grandTotal: number;
}

/** Cashier optional: round to nearest whole rupee (e.g. cash). */
export function applyRoundToNearestRupee(rawAfterBillDiscount: number): {
  roundOff: number;
  grandTotal: number;
} {
  const grandTotal = Math.round(rawAfterBillDiscount);
  return {
    grandTotal,
    roundOff: round2(grandTotal - rawAfterBillDiscount),
  };
}

import { round2 } from '@billing/shared';

export { round2 };

export function calcLineAmounts(input: LineCalcInput): LineCalcResult {
  const taxableAmount = Math.max(0, input.qty * input.rate - input.discount);
  const cgstAmount = (taxableAmount * input.cgstPercent) / 100;
  const sgstAmount = (taxableAmount * input.sgstPercent) / 100;
  const igstAmount = 0;
  const lineTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount;
  return {
    taxableAmount: round2(taxableAmount),
    cgstAmount: round2(cgstAmount),
    sgstAmount: round2(sgstAmount),
    igstAmount: round2(igstAmount),
    lineTotal: round2(lineTotal),
  };
}

/** Sum lines and bill discount. No round-off unless cashier applies it separately. */
export function calcBillTotals(
  lines: {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    lineTotal: number;
    discount?: number;
  }[],
  billDiscount = 0,
): BillTotalsResult {
  const subtotal = lines.reduce((s, l) => s + l.taxableAmount, 0);
  const lineDiscountTotal = round2(lines.reduce((s, l) => s + (l.discount ?? 0), 0));
  const cgstTotal = lines.reduce((s, l) => s + l.cgstAmount, 0);
  const sgstTotal = lines.reduce((s, l) => s + l.sgstAmount, 0);
  const igstTotal = lines.reduce((s, l) => s + l.igstAmount, 0);
  const rawGrand = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const extraDisc = round2(Math.max(0, billDiscount));
  const rawAfterBillDiscount = round2(Math.max(0, rawGrand - extraDisc));

  return {
    subtotal: round2(subtotal),
    lineDiscountTotal,
    billDiscount: extraDisc,
    cgstTotal: round2(cgstTotal),
    sgstTotal: round2(sgstTotal),
    igstTotal: round2(igstTotal),
    rawGrandTotal: rawGrand,
    rawAfterBillDiscount,
    roundOff: 0,
    grandTotal: rawAfterBillDiscount,
  };
}

import { round2 } from '@billing/shared';

export interface LineStockInputs {
  qty: number;
  availableQty?: number;
  stockQty?: number;
  pendingQty?: number;
}

/** Max qty this line can hold (pool + own reservation). */
export function calcLineSellable({
  qty,
  availableQty,
  stockQty,
  pendingQty,
}: LineStockInputs): number | null {
  if (stockQty != null && pendingQty != null) {
    return round2(stockQty - pendingQty + qty);
  }
  if (availableQty != null) return availableQty;
  return null;
}

export function calcLineShortage(inputs: LineStockInputs): number {
  const sellable = calcLineSellable(inputs);
  if (sellable == null) return 0;
  return Math.max(0, round2(inputs.qty - sellable));
}

/** Shortage if user tried a qty above what the line can sell (e.g. API rejected increase). */
export function calcShortageForAttemptedQty(
  attemptedQty: number,
  line: LineStockInputs,
): number {
  const sellable = calcLineSellable(line);
  if (sellable == null) return 0;
  return Math.max(0, round2(attemptedQty - sellable));
}

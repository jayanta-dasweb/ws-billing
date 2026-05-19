import { round2 } from '@billing/shared';
import type { BatchShortageAlert } from '@/redux/slices/stockSlice';

export interface LineStockInputs {
  qty: number;
  availableQty?: number;
  stockQty?: number;
  pendingQty?: number;
  /** Units actually reserved for this bill line (when API provides it). */
  reservedQty?: number;
  shortageQty?: number;
}

/** Free units in the batch (warehouse pool not reserved on any open bill). */
export function calcPoolAvailable({
  availableQty,
  stockQty,
  pendingQty,
}: LineStockInputs): number | null {
  if (stockQty != null && pendingQty != null) {
    return round2(Math.max(0, stockQty - pendingQty));
  }
  if (availableQty != null) return round2(Math.max(0, availableQty));
  return null;
}

/** Max qty this line can still take from pool (pool + already reserved on this line). */
export function calcLineSellable(inputs: LineStockInputs): number | null {
  const pool = calcPoolAvailable(inputs);
  if (pool == null) return null;
  const reserved = inputs.reservedQty ?? 0;
  return round2(pool + reserved);
}

export function calcLineShortage(inputs: LineStockInputs): number {
  if (inputs.shortageQty != null && inputs.shortageQty > 0) {
    return round2(inputs.shortageQty);
  }
  if (inputs.reservedQty != null) {
    return Math.max(0, round2(inputs.qty - inputs.reservedQty));
  }
  const sellable = calcLineSellable(inputs);
  if (sellable == null) return 0;
  return Math.max(0, round2(inputs.qty - sellable));
}

/** Shortage if user tried a qty above what the line can sell (e.g. API rejected increase). */
export function calcShortageForAttemptedQty(
  attemptedQty: number,
  line: LineStockInputs,
): number {
  if (line.reservedQty != null) {
    return Math.max(0, round2(attemptedQty - line.reservedQty));
  }
  const sellable = calcLineSellable(line);
  if (sellable == null) return 0;
  return Math.max(0, round2(attemptedQty - sellable));
}

/** Whether a WS shortage alert should show on this line (same batch — any counter). */
export function batchShortageAppliesToLine(
  alert: BatchShortageAlert | null | undefined,
  ctx: { batchId?: string; billId?: string | null; lineId?: string },
): boolean {
  if (!alert || alert.shortageQty <= 0.001) return false;
  if (!ctx.batchId || alert.batchId !== ctx.batchId) return false;
  return true;
}

/** Qty to show in the items grid (typed draft, server line qty, or attempted when short). */
export function displayLineQty(
  item: LineStockInputs & { id?: string },
  opts?: {
    selectedLineId?: string | null;
    lineQtyDraft?: number | null;
    attemptedQty?: number;
  },
): number {
  if (opts?.selectedLineId && item.id === opts.selectedLineId && opts.lineQtyDraft != null) {
    return opts.lineQtyDraft;
  }
  if (opts?.attemptedQty != null && opts.attemptedQty > item.qty + 0.001) {
    return opts.attemptedQty;
  }
  return item.qty;
}

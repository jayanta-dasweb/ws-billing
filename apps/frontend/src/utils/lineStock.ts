import { round2 } from '@billing/shared';
import type { BatchShortageAlert } from '@/redux/slices/stockSlice';
import { listShortagesForBatch } from '@/utils/batchShortageAlerts';

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
  const pool = calcPoolAvailable(inputs);
  if (pool != null && pool > 0.001) {
    return 0;
  }
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

/**
 * Shortage preview while editing qty (before Done).
 * On save the server releases the current line qty then reserves the new qty,
 * so this line can use pool + current qty without shorting.
 */
export function calcDraftQtyShortage(attemptedQty: number, line: LineStockInputs): number {
  const pool = calcPoolAvailable(line);
  if (pool == null) return 0;
  if (pool > 0.001) return 0;
  const currentQty = line.qty ?? 0;
  const maxWithoutShort = round2(pool + currentQty);
  return Math.max(0, round2(attemptedQty - maxWithoutShort));
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

/** Any active shortage on this batch that should highlight the row (own line or other counter). */
export function batchHasShortageForRow(
  alerts: Record<string, BatchShortageAlert>,
  ctx: { batchId?: string; billId?: string | null; lineId?: string },
): boolean {
  if (!ctx.batchId) return false;
  return listShortagesForBatch(alerts, ctx.batchId).some((a) =>
    batchShortageAppliesToLine(a, ctx),
  );
}

/** Whether a WS shortage alert applies to this grid row. */
export function batchShortageAppliesToLine(
  alert: BatchShortageAlert | null | undefined,
  ctx: { batchId?: string; billId?: string | null; lineId?: string },
): boolean {
  if (!alert || alert.shortageQty <= 0.001) return false;
  if (!ctx.batchId || alert.batchId !== ctx.batchId) return false;
  if (alert.billId && alert.lineId) {
    if (ctx.billId && ctx.lineId && alert.billId === ctx.billId && alert.lineId === ctx.lineId) {
      return true;
    }
    if (ctx.billId && alert.billId !== ctx.billId) {
      return true;
    }
    return false;
  }
  return false;
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

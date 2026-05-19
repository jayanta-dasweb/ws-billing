import type { BatchShortageAlert } from '@/redux/slices/stockSlice';

export function shortageAlertKey(parts: {
  batchId: string;
  billId?: string;
  lineId?: string;
}): string {
  if (parts.billId && parts.lineId) {
    return `${parts.batchId}:${parts.billId}:${parts.lineId}`;
  }
  return parts.batchId;
}

export function listShortagesForBatch(
  alerts: Record<string, BatchShortageAlert>,
  batchId: string,
): BatchShortageAlert[] {
  return Object.values(alerts).filter(
    (a) => a.batchId === batchId && a.shortageQty > 0.001,
  );
}

/** Best alert to show on a line (own shortage first, else another counter on same batch). */
export function pickDisplayShortageAlert(
  alerts: Record<string, BatchShortageAlert>,
  batchId: string | undefined,
  ctx?: { billId?: string | null; lineId?: string },
): BatchShortageAlert | null {
  if (!batchId) return null;
  const list = listShortagesForBatch(alerts, batchId);
  if (!list.length) return null;
  if (ctx?.billId && ctx.lineId) {
    const own = list.find((a) => a.billId === ctx.billId && a.lineId === ctx.lineId);
    if (own) return own;
  }
  return list.sort((a, b) => b.shortageQty - a.shortageQty)[0];
}

export function anyBatchShortage(
  alerts: Record<string, BatchShortageAlert>,
  batchId: string | undefined,
): boolean {
  if (!batchId) return false;
  return listShortagesForBatch(alerts, batchId).length > 0;
}

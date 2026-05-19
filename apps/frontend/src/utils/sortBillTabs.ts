import type { BillSummaryDto } from '@billing/shared';

/** Keep tab positions fixed (oldest left, newest right) — never reorder on switch. */
export function sortBillTabsStable(tabs: BillSummaryDto[]): BillSummaryDto[] {
  return [...tabs].sort((a, b) => {
    const ca = a.createdAt ?? a.updatedAt;
    const cb = b.createdAt ?? b.updatedAt;
    if (ca !== cb) return ca.localeCompare(cb);
    return a.id.localeCompare(b.id);
  });
}

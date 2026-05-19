import { BillStatus } from '@billing/shared';

const EDITABLE: BillStatus[] = [BillStatus.DRAFT, BillStatus.HOLD];

/** Bill can be scanned/edited only when there is an open draft or parked bill. */
export function canEditBill(billId: string | null | undefined, status: string | null | undefined): boolean {
  if (!billId || !status) return false;
  return EDITABLE.includes(status as BillStatus);
}

export function isOpenBillStatus(status: string | null | undefined): boolean {
  return Boolean(status && EDITABLE.includes(status as BillStatus));
}

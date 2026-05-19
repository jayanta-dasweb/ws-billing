import { get, set, del } from 'idb-keyval';
import type { BillDto } from '@billing/shared';

const draftKey = (counterId: string) => `billing-draft:${counterId}`;

export interface PersistedBillingDraft {
  savedAt: string;
  bill: BillDto | null;
  localOnly: boolean;
}

export async function saveBillingDraft(
  counterId: string,
  bill: BillDto | null,
  localOnly = false,
): Promise<void> {
  if (!counterId) return;
  const payload: PersistedBillingDraft = {
    savedAt: new Date().toISOString(),
    bill,
    localOnly,
  };
  await set(draftKey(counterId), payload);
}

export async function loadBillingDraft(counterId: string): Promise<PersistedBillingDraft | null> {
  if (!counterId) return null;
  return (await get<PersistedBillingDraft>(draftKey(counterId))) ?? null;
}

export async function clearBillingDraft(counterId: string): Promise<void> {
  if (!counterId) return;
  await del(draftKey(counterId));
}

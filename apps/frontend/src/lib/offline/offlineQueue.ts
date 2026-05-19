import { get, set } from 'idb-keyval';

export type OfflineAction =
  | { id: string; type: 'scan'; billId: string; barcode: string; qty: number; createdAt: string }
  | { id: string; type: 'removeLine'; billId: string; lineId: string; createdAt: string }
  | {
      id: string;
      type: 'updateLine';
      billId: string;
      lineId: string;
      patch: { qty?: number; discount?: number };
      createdAt: string;
    }
  | {
      id: string;
      type: 'setCustomer';
      billId: string;
      customerId: string;
      createdAt: string;
    };

const queueKey = (counterId: string) => `billing-offline-queue:${counterId}`;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getOfflineQueue(counterId: string): Promise<OfflineAction[]> {
  return (await get<OfflineAction[]>(queueKey(counterId))) ?? [];
}

export type OfflineActionInput =
  | { type: 'scan'; billId: string; barcode: string; qty: number }
  | { type: 'removeLine'; billId: string; lineId: string }
  | { type: 'updateLine'; billId: string; lineId: string; patch: { qty?: number; discount?: number } }
  | { type: 'setCustomer'; billId: string; customerId: string };

export async function enqueueOfflineAction(
  counterId: string,
  action: OfflineActionInput,
): Promise<OfflineAction> {
  const full = { ...action, id: uid(), createdAt: new Date().toISOString() } as OfflineAction;
  const queue = await getOfflineQueue(counterId);
  queue.push(full);
  await set(queueKey(counterId), queue);
  return full;
}

export async function setOfflineQueue(counterId: string, queue: OfflineAction[]): Promise<void> {
  await set(queueKey(counterId), queue);
}

export async function clearOfflineQueue(counterId: string): Promise<void> {
  await set(queueKey(counterId), []);
}

export async function offlineQueueLength(counterId: string): Promise<number> {
  return (await getOfflineQueue(counterId)).length;
}

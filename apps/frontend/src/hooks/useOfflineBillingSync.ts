'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { store } from '@/redux/store';
import { billingApi } from '@/services/api/billingApi';
import {
  clearOfflineQueue,
  getOfflineQueue,
  setOfflineQueue,
  type OfflineAction,
} from '@/lib/offline/offlineQueue';
import { useOnlineStatus } from './useOnlineStatus';

export function useOfflineBillingSync(
  counterId: string | undefined,
  onSynced?: (result: { ok: number; failed: number }) => void,
) {
  const online = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    if (!counterId) {
      setPendingCount(0);
      return;
    }
    const queue = await getOfflineQueue(counterId);
    setPendingCount(queue.length);
  }, [counterId]);

  const flushQueue = useCallback(async (): Promise<{ ok: number; failed: number }> => {
    if (!counterId || syncingRef.current) return { ok: 0, failed: 0 };
    syncingRef.current = true;
    setSyncing(true);
    let ok = 0;
    let failed = 0;

    try {
      let queue = await getOfflineQueue(counterId);
      const remaining: OfflineAction[] = [];

      for (const action of queue) {
        try {
          if (action.type === 'scan') {
            await store
              .dispatch(
                billingApi.endpoints.scanBarcode.initiate({
                  billId: action.billId,
                  body: { barcode: action.barcode, qty: action.qty },
                }),
              )
              .unwrap();
          } else if (action.type === 'removeLine') {
            await store
              .dispatch(
                billingApi.endpoints.removeLine.initiate({
                  billId: action.billId,
                  lineId: action.lineId,
                }),
              )
              .unwrap();
          } else if (action.type === 'updateLine') {
            await store
              .dispatch(
                billingApi.endpoints.updateLine.initiate({
                  billId: action.billId,
                  lineId: action.lineId,
                  body: action.patch,
                }),
              )
              .unwrap();
          } else if (action.type === 'setCustomer') {
            await store
              .dispatch(
                billingApi.endpoints.setBillCustomer.initiate({
                  billId: action.billId,
                  body: { customerId: action.customerId },
                }),
              )
              .unwrap();
          }
          ok++;
        } catch {
          failed++;
          remaining.push(action);
        }
      }

      await setOfflineQueue(counterId, remaining);
      setPendingCount(remaining.length);
      if (ok > 0) onSynced?.({ ok, failed });
      return { ok, failed };
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [counterId, onSynced]);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount, online]);

  useEffect(() => {
    if (online && counterId && pendingCount > 0) {
      void flushQueue();
    }
  }, [online, counterId, pendingCount, flushQueue]);

  return {
    online,
    pendingCount,
    syncing,
    refreshCount,
    flushQueue,
    clearQueue: useCallback(async () => {
      if (!counterId) return;
      await clearOfflineQueue(counterId);
      setPendingCount(0);
    }, [counterId]),
  };
}

'use client';

import { useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';

export function useLiveBatchStock(
  batchId: string | undefined,
  fallback?: { stockQty?: number; pendingQty?: number; availableQty?: number },
) {
  const live = useSelector((s: RootState) => (batchId ? s.stock.batches[batchId] : undefined));

  if (live) {
    return {
      stockQty: live.stockQty,
      pendingQty: live.pendingQty,
      availableQty: live.availableQty,
      isLive: true,
    };
  }

  return {
    stockQty: fallback?.stockQty,
    pendingQty: fallback?.pendingQty,
    availableQty: fallback?.availableQty,
    isLive: false,
  };
}

'use client';

import { useLiveBatchStock } from '@/hooks/useLiveBatchStock';

interface BillingLineAvailProps {
  batchId?: string;
  qty: number;
  availableQty?: number;
  pendingQty?: number;
}

export function BillingLineAvail({ batchId, qty, availableQty, pendingQty }: BillingLineAvailProps) {
  const live = useLiveBatchStock(batchId, { availableQty, pendingQty });
  const avail = live.availableQty;
  const low = typeof avail === 'number' && avail < qty;

  return (
    <span className={low ? 'text-danger font-weight-bold' : undefined} title={live.isLive ? 'Live (WebSocket)' : 'From bill load'}>
      {typeof avail === 'number' ? avail : '—'}
      {live.isLive && <span className="billing-stock-live-dot ml-1" />}
    </span>
  );
}

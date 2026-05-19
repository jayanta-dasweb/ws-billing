'use client';

import { useEffect, useRef } from 'react';
import { useBillHeartbeatMutation } from '@/services/api/billingApi';
import { BillStatus } from '@billing/shared';

const HEARTBEAT_MS = 60_000;

/**
 * Keeps server-side cart reservation TTL alive while a draft/hold bill is open.
 */
export function useBillReservationHeartbeat(
  billId: string | null,
  status: string | null,
) {
  const [heartbeat] = useBillHeartbeatMutation();
  const heartbeatRef = useRef(heartbeat);
  heartbeatRef.current = heartbeat;

  const editable =
    status === BillStatus.DRAFT || status === BillStatus.HOLD || status === null;

  useEffect(() => {
    if (!billId || !editable) return;

    const tick = () => {
      void heartbeatRef.current(billId).catch(() => {
        /* silent — offline queue handles mutations */
      });
    };

    tick();
    const id = window.setInterval(tick, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [billId, editable]);
}

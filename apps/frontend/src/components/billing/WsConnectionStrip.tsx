'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearRecoveredBanner } from '@/redux/slices/websocketSlice';
import type { RootState } from '@/redux/store';

const RECOVERED_BANNER_MS = 4000;

export function WsConnectionStrip() {
  const dispatch = useDispatch();
  const connected = useSelector((s: RootState) => s.websocket.connected);
  const reconnecting = useSelector((s: RootState) => s.websocket.reconnecting);
  const recoveredAt = useSelector((s: RootState) => s.websocket.recoveredAt);

  useEffect(() => {
    if (!recoveredAt) return;
    const t = window.setTimeout(() => dispatch(clearRecoveredBanner()), RECOVERED_BANNER_MS);
    return () => window.clearTimeout(t);
  }, [recoveredAt, dispatch]);

  if (connected && !recoveredAt) return null;

  if (reconnecting) {
    return (
      <div className="ws-strip ws-strip--warn" role="status">
        Reconnecting to stock sync…
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="ws-strip ws-strip--danger" role="alert">
        Stock sync disconnected — reservations still held on server; changes may be delayed
      </div>
    );
  }

  if (recoveredAt) {
    return (
      <div className="ws-strip ws-strip--ok" role="status">
        Connection recovered · stock sync active
      </div>
    );
  }

  return null;
}

'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';

/** Top progress bar + optional full-screen overlay for navigation and async work. */
export function GlobalLoading() {
  const { routeLoading, routeMessage, overlay, apiPending } = useSelector(
    (s: RootState) => s.ui,
  );
  const [showBar, setShowBar] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const barActive = routeLoading || apiPending > 0;
  const overlayActive = overlay.active;

  useEffect(() => {
    if (!barActive) {
      setShowBar(false);
      return;
    }
    const t = window.setTimeout(() => setShowBar(true), 80);
    return () => window.clearTimeout(t);
  }, [barActive]);

  useEffect(() => {
    if (!overlayActive) {
      setShowOverlay(false);
      return;
    }
    const t = window.setTimeout(() => setShowOverlay(true), 0);
    return () => window.clearTimeout(t);
  }, [overlayActive]);

  const overlayMessage =
    overlay.message ?? routeMessage ?? (routeLoading ? 'Loading page…' : 'Please wait…');

  return (
    <>
      <div
        className={`app-top-loader${showBar ? ' app-top-loader--active' : ''}`}
        aria-hidden={!showBar}
      >
        <div className="app-top-loader__bar" />
      </div>

      {showOverlay && (
        <div className="app-overlay-loader" role="status" aria-live="polite" aria-busy="true">
          <div className="app-overlay-loader__panel">
            <div className="spinner-border text-primary mb-3" />
            <p className="mb-0 text-muted font-weight-bold">{overlayMessage}</p>
          </div>
        </div>
      )}
    </>
  );
}

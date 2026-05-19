'use client';

interface BillingBusyOverlayProps {
  active: boolean;
  message?: string;
}

/** Covers only the POS workspace (not the whole app) during billing API work. */
export function BillingBusyOverlay({ active, message = 'Please wait…' }: BillingBusyOverlayProps) {
  if (!active) return null;

  return (
    <div className="billing-pos__busy" role="status" aria-live="polite" aria-busy="true">
      <div className="billing-pos__busy-panel">
        <div className="spinner-border text-primary mb-2" role="presentation" />
        <span className="billing-pos__busy-text">{message}</span>
      </div>
    </div>
  );
}

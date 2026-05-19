'use client';

interface OfflineBannerProps {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  onSyncNow?: () => void;
}

export function OfflineBanner({ online, pendingCount, syncing, onSyncNow }: OfflineBannerProps) {
  if (online && pendingCount === 0) return null;

  return (
    <div
      className={`billing-offline-banner ${online ? 'billing-offline-banner--sync' : 'billing-offline-banner--offline'}`}
      role="status"
    >
      {!online ? (
        <>
          <strong>Offline</strong> — scans and edits are saved locally and will sync when connection
          returns. Payment is disabled until online.
        </>
      ) : syncing ? (
        <>Syncing {pendingCount} pending action(s)…</>
      ) : (
        <>
          <strong>{pendingCount} action(s)</strong> waiting to sync.{' '}
          {onSyncNow && (
            <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onSyncNow}>
              Sync now
            </button>
          )}
        </>
      )}
    </div>
  );
}

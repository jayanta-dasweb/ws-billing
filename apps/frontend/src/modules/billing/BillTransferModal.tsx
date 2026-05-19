'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OnlineCounterDto } from '@billing/shared';

interface BillTransferModalProps {
  open: boolean;
  billLabel: string;
  billMeta?: string;
  targets: OnlineCounterDto[];
  loading?: boolean;
  saving?: boolean;
  onClose: () => void;
  onTransfer: (targetCounterId: string) => void;
}

export function BillTransferModal({
  open,
  billLabel,
  billMeta,
  targets,
  loading,
  saving,
  onClose,
  onTransfer,
}: BillTransferModalProps) {
  const [focusIdx, setFocusIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setFocusIdx(0);
  }, [open, targets.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (targets.length === 0 || saving) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, targets.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const t = targets[focusIdx];
        if (t) onTransfer(t.counterId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, targets, focusIdx, saving, onClose, onTransfer]);

  const pick = useCallback(
    (counterId: string) => {
      if (saving) return;
      onTransfer(counterId);
    },
    [onTransfer, saving],
  );

  if (!open) return null;

  return (
    <div
      className="pharmacy-modal bill-transfer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bill-transfer-title"
    >
      <button type="button" className="pharmacy-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="pharmacy-modal__panel pharmacy-modal__panel--wide bill-transfer-modal__panel">
        <div className="pharmacy-modal__head bill-transfer-modal__head">
          <span id="bill-transfer-title" className="bill-transfer-modal__title">
            <i className="fas fa-share-square bill-transfer-modal__title-icon" aria-hidden />
            Transfer bill
          </span>
          <button type="button" className="pharmacy-modal__close" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="pharmacy-modal__body bill-transfer-modal__body">
          <div className="bill-transfer-modal__bill-card">
            <span className="bill-transfer-modal__bill-label">Sending</span>
            <strong className="bill-transfer-modal__bill-name">{billLabel}</strong>
            {billMeta ? <span className="bill-transfer-modal__bill-meta">{billMeta}</span> : null}
          </div>

          {loading ? (
            <div className="bill-transfer-modal__state bill-transfer-modal__state--loading">
              <i className="fas fa-circle-notch fa-spin" aria-hidden />
              <span>Looking for online counters…</span>
            </div>
          ) : targets.length === 0 ? (
            <div className="bill-transfer-modal__state bill-transfer-modal__state--empty">
              <div className="bill-transfer-modal__empty-icon" aria-hidden>
                <i className="fas fa-desktop" />
              </div>
              <p className="bill-transfer-modal__empty-title">No counters online</p>
              <p className="bill-transfer-modal__empty-text">
                Another cashier must sign in on a different counter. This bill stays on your screen until
                someone is available.
              </p>
            </div>
          ) : (
            <>
              <p className="bill-transfer-modal__hint">↑↓ select · Enter send · Esc close</p>
              <div className="pharmacy-modal__list bill-transfer-modal__list">
                {targets.map((t, idx) => (
                  <button
                    key={t.counterId}
                    type="button"
                    className={[
                      'bill-transfer-modal__counter',
                      idx === focusIdx ? 'bill-transfer-modal__counter--active' : '',
                    ].join(' ')}
                    disabled={saving}
                    onClick={() => pick(t.counterId)}
                  >
                    <span className="bill-transfer-modal__counter-icon" aria-hidden>
                      <i className="fas fa-cash-register" />
                    </span>
                    <span className="bill-transfer-modal__counter-text">
                      <strong>{t.counterName}</strong>
                      <span className="pharmacy-modal__row-meta">Cashier · {t.username}</span>
                    </span>
                    <span className="bill-transfer-modal__send">
                      {saving ? (
                        <i className="fas fa-circle-notch fa-spin" aria-hidden />
                      ) : (
                        <>
                          Send <i className="fas fa-arrow-right" aria-hidden />
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
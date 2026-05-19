'use client';

import { useEffect, useMemo } from 'react';
import { round2 } from '@billing/shared';
import { useGetBatchStockHoldsQuery } from '@/services/api/billingApi';

const COUNTER_COLORS = [
  '#8b5cf6',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#6366f1',
  '#14b8a6',
  '#ec4899',
];

export interface BatchStockHoldModalProps {
  open: boolean;
  batchId: string;
  batchNumber?: string | null;
  productName?: string;
  lineQty?: number;
  shortageQty?: number;
  /** Qty the alerting counter tried to sell (may be higher than reserved on their line). */
  attemptedQty?: number;
  alertCounterName?: string;
  onClose: () => void;
}

export function BatchStockHoldModal({
  open,
  batchId,
  batchNumber,
  productName,
  lineQty,
  shortageQty,
  attemptedQty,
  alertCounterName,
  onClose,
}: BatchStockHoldModalProps) {
  const { data, isFetching, refetch } = useGetBatchStockHoldsQuery(batchId, {
    skip: !open || !batchId,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && batchId) void refetch();
  }, [open, batchId, refetch]);

  const counters = data?.counters ?? [];
  const label = batchNumber ?? data?.batchNumber ?? 'Batch';
  const stockQty = data?.stockQty ?? 0;
  const totalHeld = data?.pendingQty ?? 0;
  const free = data?.availableQty ?? Math.max(0, stockQty - totalHeld);

  const segments = useMemo(() => {
    if (totalHeld <= 0) return [];
    return counters.map((c, i) => ({
      ...c,
      pct: (c.reservedQty / totalHeld) * 100,
      color: COUNTER_COLORS[i % COUNTER_COLORS.length],
    }));
  }, [counters, totalHeld]);

  if (!open) return null;

  return (
    <div
      className="pharmacy-modal batch-hold-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-hold-modal-title"
    >
      <button type="button" className="pharmacy-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="pharmacy-modal__panel batch-hold-modal__panel">
        <div className="pharmacy-modal__head batch-hold-modal__head">
          <span id="batch-hold-modal-title" className="batch-hold-modal__title">
            <i className="fas fa-boxes-stacked batch-hold-modal__title-icon" aria-hidden />
            Stock on batch
          </span>
          <button type="button" className="pharmacy-modal__close" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="pharmacy-modal__body batch-hold-modal__body">
          {(productName || label) && (
            <div className="batch-hold-modal__product">
              {productName && <strong>{productName}</strong>}
              <span className="batch-hold-modal__batch">{label}</span>
            </div>
          )}

          {(shortageQty ?? 0) > 0 && (
            <div className="batch-hold-modal__alert" role="alert">
              <i className="fas fa-triangle-exclamation" aria-hidden />
              <span>
                {alertCounterName ? (
                  <>
                    Alert from <strong>{alertCounterName}</strong> — short by <strong>{shortageQty}</strong>
                  </>
                ) : (
                  <>
                    Short by <strong>{shortageQty}</strong>
                  </>
                )}
                {(() => {
                  const tried = attemptedQty ?? lineQty;
                  if (tried == null) return null;
                  const canSell = round2(Math.max(0, tried - (shortageQty ?? 0)));
                  return (
                    <>
                      {' '}
                      — tried <strong>{tried}</strong>, only <strong>{canSell}</strong> can be sold
                      {alertCounterName && attemptedQty != null && lineQty != null && attemptedQty > lineQty + 0.005 ? (
                        <>
                          {' '}
                          · <strong>{alertCounterName}</strong> bill line: <strong>{lineQty}</strong>{' '}
                          reserved (not {attemptedQty})
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </span>
            </div>
          )}

          <div className="batch-hold-modal__stats">
            <div className="batch-hold-modal__stat batch-hold-modal__stat--stock">
              <span className="batch-hold-modal__stat-label">On hand</span>
              <span className="batch-hold-modal__stat-value">{stockQty}</span>
            </div>
            <div className="batch-hold-modal__stat batch-hold-modal__stat--held">
              <span className="batch-hold-modal__stat-label">Reserved</span>
              <span className="batch-hold-modal__stat-value">{totalHeld}</span>
            </div>
            <div className="batch-hold-modal__stat batch-hold-modal__stat--free">
              <span className="batch-hold-modal__stat-label">Free pool</span>
              <span className="batch-hold-modal__stat-value">{free}</span>
            </div>
          </div>

          {segments.length > 0 && (
            <div className="batch-hold-modal__bar-wrap">
              <span className="batch-hold-modal__bar-label">
                Reserved on open bills (draft / parked)
              </span>
              <div className="batch-hold-modal__bar" role="img" aria-hidden>
                {segments.map((s) => (
                  <span
                    key={s.counterId}
                    className="batch-hold-modal__bar-seg"
                    style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    title={`${s.counterName}: ${s.reservedQty}`}
                  />
                ))}
              </div>
            </div>
          )}

          {isFetching && counters.length === 0 ? (
            <p className="batch-hold-modal__loading">
              <i className="fas fa-circle-notch fa-spin" aria-hidden /> Loading counter holds…
            </p>
          ) : counters.length === 0 ? (
            <p className="batch-hold-modal__empty text-muted mb-0">No open bills holding this batch.</p>
          ) : (
            <div className="batch-hold-modal__table-wrap">
              <table className="table table-sm batch-hold-modal__table mb-0">
                <thead>
                  <tr>
                    <th>Counter</th>
                    <th className="text-right">Reserved</th>
                    <th className="text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {counters.map((c, i) => (
                    <tr key={c.counterId}>
                      <td>
                        <span
                          className="batch-hold-modal__dot"
                          style={{ backgroundColor: COUNTER_COLORS[i % COUNTER_COLORS.length] }}
                          aria-hidden
                        />
                        {c.counterName}
                      </td>
                      <td className="text-right font-weight-bold">{c.reservedQty}</td>
                      <td className="text-right text-muted">
                        {totalHeld > 0 ? `${Math.round((c.reservedQty / totalHeld) * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="batch-hold-modal__hint small text-muted mb-0">
            Live across all counters · draft & parked bills only
          </p>
        </div>
      </div>
    </div>
  );
}

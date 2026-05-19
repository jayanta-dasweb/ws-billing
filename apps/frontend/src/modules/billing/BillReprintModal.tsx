'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';
import { useLazyLookupInvoicesQuery } from '@/services/api/invoiceApi';
import type { InvoiceLookupDto } from '@billing/shared';

interface BillReprintModalProps {
  open: boolean;
  counterId: string | undefined;
  disabled?: boolean;
  onClose: () => void;
  onOpenInvoice: (billId: string) => void;
}

function formatInvoiceDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function BillReprintModal({
  open,
  counterId,
  disabled,
  onClose,
  onOpenInvoice,
}: BillReprintModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [query, setQuery] = useState('');
  const [listIndex, setListIndex] = useState(0);
  const debounced = useDebouncedValue(query, 320);
  const { error, setError } = useTimedAlerts({ errorMs: 5000 });
  const [lookup, { data: results = [], isFetching, reset }] = useLazyLookupInvoicesQuery();

  const searchActive = debounced.trim().length >= 2;
  const rows = searchActive ? results : [];

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setQuery('');
    setListIndex(0);
    setError('');
    rowRefs.current = [];
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, setError, reset]);

  useEffect(() => {
    setListIndex(0);
    rowRefs.current = [];
  }, [rows.length, debounced]);

  useEffect(() => {
    if (!open || !searchActive || !counterId) return;
    void lookup({ q: debounced.trim(), counterId });
  }, [open, debounced, counterId, lookup, searchActive]);

  useEffect(() => {
    const el = rowRefs.current[listIndex];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [listIndex, rows.length]);

  const pick = useCallback(
    (row: InvoiceLookupDto) => {
      if (disabled) return;
      onOpenInvoice(row.billId);
      onClose();
    },
    [onOpenInvoice, onClose, disabled],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (rows.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setListIndex((i) => Math.min(i + 1, rows.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setListIndex((i) => (i <= 0 ? 0 : i - 1));
      }
      if (e.key === 'Enter' && rows[listIndex]) {
        e.preventDefault();
        pick(rows[listIndex]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, rows, listIndex, onClose, pick]);

  if (!open) return null;

  return (
    <div
      className="pharmacy-modal invoice-find-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-find-title"
    >
      <button type="button" className="pharmacy-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="pharmacy-modal__panel pharmacy-modal__panel--wide invoice-find-modal__panel">
        <div className="pharmacy-modal__head invoice-find-modal__head">
          <span id="invoice-find-title" className="invoice-find-modal__title">
            <i className="fas fa-file-invoice invoice-find-modal__title-icon" aria-hidden />
            Find invoice
          </span>
          <kbd className="pharmacy-kbd">F7</kbd>
          <button type="button" className="pharmacy-modal__close" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="pharmacy-modal__body invoice-find-modal__body">
          <input
            ref={inputRef}
            type="text"
            className="pharmacy-modal__input invoice-find-modal__input"
            placeholder="Invoice no, customer name, or mobile…"
            value={query}
            disabled={disabled}
            autoComplete="off"
            aria-label="Search invoices"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && rows[listIndex]) {
                e.preventDefault();
                e.stopPropagation();
                pick(rows[listIndex]);
              }
            }}
          />

          <p className="pharmacy-modal__hint invoice-find-modal__hint">
            {!searchActive
              ? 'Type at least 2 characters — results update as you type'
              : isFetching
                ? 'Searching…'
                : rows.length === 0
                  ? 'No invoices match this search'
                  : '↑↓ select · Enter open · Esc close'}
          </p>

          <div className="pharmacy-modal__list invoice-find-modal__list">
            {searchActive && !isFetching && rows.length === 0 && (
              <div className="invoice-find-modal__state invoice-find-modal__state--empty">
                <div className="invoice-find-modal__empty-icon" aria-hidden>
                  <i className="fas fa-search" />
                </div>
                <p className="invoice-find-modal__empty-title">No invoices found</p>
                <p className="invoice-find-modal__empty-text">
                  Try invoice number, customer name, or mobile from the bill.
                </p>
              </div>
            )}

            {searchActive && isFetching && rows.length === 0 && (
              <div className="invoice-find-modal__state invoice-find-modal__state--loading">
                <i className="fas fa-circle-notch fa-spin" aria-hidden />
                <span>Searching invoices…</span>
              </div>
            )}

            {rows.map((row, idx) => (
              <button
                key={row.billId}
                ref={(el) => {
                  rowRefs.current[idx] = el;
                }}
                type="button"
                className={[
                  'invoice-find-modal__row',
                  idx === listIndex ? 'invoice-find-modal__row--active' : '',
                ].join(' ')}
                disabled={disabled}
                onFocus={() => setListIndex(idx)}
                onClick={() => pick(row)}
              >
                <span className="invoice-find-modal__row-icon" aria-hidden>
                  <i className="fas fa-receipt" />
                </span>
                <span className="invoice-find-modal__row-main">
                  <strong className="invoice-find-modal__inv">{row.invoiceNo}</strong>
                  <span className="pharmacy-modal__row-meta">
                    {row.customerName}
                    {row.customerMobile ? ` · ${row.customerMobile}` : ''}
                  </span>
                  <span className="invoice-find-modal__date">{formatInvoiceDate(row.invoiceDate)}</span>
                </span>
                <span className="invoice-find-modal__amt">₹{row.grandTotal.toFixed(2)}</span>
                <span className="invoice-find-modal__open">
                  Open <i className="fas fa-arrow-right" aria-hidden />
                </span>
              </button>
            ))}
          </div>

          {error ? (
            <p className="invoice-find-modal__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
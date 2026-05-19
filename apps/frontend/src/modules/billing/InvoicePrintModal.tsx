'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';
import type { InvoiceDetailDto } from '@billing/shared';
import { downloadInvoicePdf, openInvoicePdfTab, printInvoicePdf } from './invoicePdf';

interface InvoicePrintModalProps {
  open: boolean;
  detail: InvoiceDetailDto | null;
  accessToken: string | null;
  onClose: () => void;
}

type PrintAction = 'a4' | 'thermal' | 'download';

const ACTIONS: { id: PrintAction; label: string }[] = [
  { id: 'a4', label: 'Print A4 GST invoice' },
  { id: 'thermal', label: 'Print thermal (80mm)' },
  { id: 'download', label: 'Save PDF copy' },
];

export function InvoicePrintModal({
  open,
  detail,
  accessToken,
  onClose,
}: InvoicePrintModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const actionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const doneRef = useRef<HTMLButtonElement>(null);
  const inFlightRef = useRef(false);
  const [actionIndex, setActionIndex] = useState(0);
  const [loading, setLoading] = useState<PrintAction | null>(null);
  const [mounted, setMounted] = useState(false);
  const { error, setError } = useTimedAlerts({ errorMs: 8000 });

  const handleClose = useCallback(() => {
    inFlightRef.current = false;
    setLoading(null);
    onClose();
  }, [onClose]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      inFlightRef.current = false;
      setLoading(null);
      return;
    }
    setError('');
    setActionIndex(0);
    window.setTimeout(() => actionRefs.current[0]?.focus(), 0);
  }, [open, detail?.billId, setError]);

  const focusAction = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, ACTIONS.length - 1));
    setActionIndex(clamped);
    window.setTimeout(() => actionRefs.current[clamped]?.focus(), 0);
  }, []);

  const runAction = useCallback(
    async (action: PrintAction) => {
      if (inFlightRef.current) return;
      if (!detail || !accessToken) {
        setError('Not signed in');
        return;
      }

      inFlightRef.current = true;
      setError('');
      setLoading(action);

      try {
        if (action === 'download') {
          await downloadInvoicePdf(detail.billId, accessToken, detail.invoiceNo, 'a4');
          setError('');
        } else if (action === 'a4') {
          await printInvoicePdf(detail.billId, accessToken, 'a4');
        } else {
          await printInvoicePdf(detail.billId, accessToken, 'thermal');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invoice PDF failed';
        if (action !== 'download' && !msg.includes('Popup blocked')) {
          try {
            await openInvoicePdfTab(
              detail.billId,
              accessToken,
              action === 'thermal' ? 'thermal' : 'a4',
            );
            setError('Opened PDF in new tab — press Ctrl+P to print');
          } catch {
            setError(msg);
          }
        } else {
          setError(msg);
        }
      } finally {
        inFlightRef.current = false;
        setLoading(null);
      }
    },
    [detail, accessToken, setError],
  );

  /** Esc always closes — even while PDF is loading. */
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      handleClose();
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;
      const t = e.target as HTMLElement;
      if (!panelRef.current?.contains(t)) return;

      const inText = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

      if (e.key === 'Home' && !inText) {
        e.preventDefault();
        focusAction(0);
        return;
      }

      if (e.key === 'End' && !inText) {
        e.preventDefault();
        doneRef.current?.focus();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (document.activeElement === doneRef.current) {
          focusAction(0);
          return;
        }
        const next = actionIndex + 1;
        if (next >= ACTIONS.length) doneRef.current?.focus();
        else focusAction(next);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (document.activeElement === doneRef.current) {
          focusAction(ACTIONS.length - 1);
          return;
        }
        const prev = actionIndex - 1;
        if (prev < 0) doneRef.current?.focus();
        else focusAction(prev);
        return;
      }

      if (e.key === 'Enter' && t instanceof HTMLButtonElement && !inFlightRef.current) {
        e.preventDefault();
        if (t === doneRef.current) {
          handleClose();
          return;
        }
        const idx = actionRefs.current.findIndex((el) => el === t);
        if (idx >= 0) void runAction(ACTIONS[idx].id);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, actionIndex, focusAction, runAction, handleClose]);

  if (!open || !detail || !mounted) return null;

  const dateStr = new Date(detail.invoiceDate).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const working = loading !== null;

  return createPortal(
    <div
      className="billing-pay-modal billing-inv-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-print-title"
    >
      <div
        className="billing-pay-modal__backdrop"
        onClick={() => {
          if (!inFlightRef.current) handleClose();
        }}
        aria-hidden
      />
      <div ref={panelRef} className="billing-pay-modal__panel billing-inv-print-panel">
        <header className="billing-pay-modal__header">
          <h2 id="inv-print-title" className="billing-pay-modal__title">
            Invoice {detail.invoiceNo}
          </h2>
          <button
            type="button"
            className="billing-pay-modal__close"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="billing-inv-summary">
          <p>
            <strong>{detail.customer.name}</strong>
            {detail.customer.mobile ? ` · ${detail.customer.mobile}` : ''}
          </p>
          <p className="billing-inv-summary__meta">
            {dateStr} · ₹ {detail.grandTotal.toFixed(2)}
            {detail.isCredit ? ' · Credit sale' : ''}
          </p>
        </div>

        {working && (
          <p className="billing-inv-loading" role="status">
            Preparing PDF… (Esc to cancel)
          </p>
        )}

        <p className="billing-inv-keys-hint">
          <kbd>↑</kbd> <kbd>↓</kbd> choose · <kbd>Enter</kbd> run once · <kbd>Esc</kbd> close
        </p>

        <div className="billing-inv-actions" role="listbox" aria-label="Print actions">
          {ACTIONS.map((action, idx) => (
            <button
              key={action.id}
              ref={(el) => {
                actionRefs.current[idx] = el;
              }}
              type="button"
              role="option"
              aria-selected={actionIndex === idx}
              className={`btn btn-block billing-inv-action${
                actionIndex === idx ? ' billing-inv-action--focused' : ''
              }${action.id === 'a4' ? ' btn-success btn-lg' : ' btn-outline-secondary'}`}
              disabled={working || !accessToken}
              onFocus={() => setActionIndex(idx)}
              onClick={() => void runAction(action.id)}
            >
              {loading === action.id ? 'Please wait…' : action.label}
            </button>
          ))}
        </div>

        <p className="billing-inv-footnote">One PDF per invoice — print or save once, then Esc to close.</p>

        {error && (
          <p className="alert alert-danger billing-pay-error py-2 mx-3" role="alert">
            {error}
          </p>
        )}

        <footer className="billing-pay-footer">
          <button ref={doneRef} type="button" className="btn btn-outline-secondary" onClick={handleClose}>
            Done <kbd>End</kbd>
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

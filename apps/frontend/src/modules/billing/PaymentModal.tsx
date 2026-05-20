'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';
import { PaymentMode, validatePaymentAudit } from '@billing/shared';
import type {
  BillRoundOffMode,
  CompleteBillDto,
  PaymentAuditDetails,
  PaymentSplitDto,
} from '@billing/shared';
import { PaymentAuditForm } from '@/components/billing/PaymentAuditForm';
import { DiscountField, type DiscountInputMode } from '@/components/billing/DiscountField';
import { NumericInput } from '@/components/masters/NumericInput';

export interface PaymentTotals {
  subtotal: number;
  lineDiscountTotal: number;
  billDiscount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  rawGrandTotal: number;
  roundOff: number;
  grandTotal: number;
  exactDue: number;
}

interface PaymentModalProps {
  open: boolean;
  totals: PaymentTotals;
  onClose: () => void;
  onApplyBillDiscount: (body: { amount?: number; percent?: number }) => Promise<void>;
  onApplyRoundOff: (mode: BillRoundOffMode) => Promise<void>;
  onComplete: (body: CompleteBillDto) => Promise<void>;
  busy?: boolean;
}

type PayTab = PaymentMode;

const PAY_MODES: { mode: PayTab; label: string; key: string }[] = [
  { mode: PaymentMode.CASH, label: 'Cash', key: '1' },
  { mode: PaymentMode.CARD, label: 'Card', key: '2' },
  { mode: PaymentMode.UPI, label: 'UPI', key: '3' },
  { mode: PaymentMode.CHEQUE, label: 'Cheque', key: '4' },
  { mode: PaymentMode.DD, label: 'DD', key: '5' },
  { mode: PaymentMode.CREDIT, label: 'Credit', key: '6' },
  { mode: PaymentMode.SPLIT, label: 'Split', key: '7' },
];

const SPLIT_MODES: PaymentMode[] = [
  PaymentMode.CASH,
  PaymentMode.CARD,
  PaymentMode.UPI,
  PaymentMode.CHEQUE,
  PaymentMode.DD,
];

function emptySplit(mode: PaymentMode = PaymentMode.CASH): PaymentSplitDto {
  return { mode, amount: 0, audit: {}, cashTendered: 0 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const AUDIT_TABS = new Set<PaymentMode>([
  PaymentMode.CASH,
  PaymentMode.CARD,
  PaymentMode.UPI,
  PaymentMode.CHEQUE,
  PaymentMode.DD,
  PaymentMode.CREDIT,
]);

export function PaymentModal({
  open,
  totals,
  onClose,
  onApplyBillDiscount,
  onApplyRoundOff,
  onComplete,
  busy,
}: PaymentModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const payBtnRef = useRef<HTMLButtonElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);
  const auditFirstRef = useRef<HTMLInputElement>(null);
  const modeBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [tab, setTab] = useState<PayTab>(PaymentMode.CASH);
  const [billDiscMode, setBillDiscMode] = useState<DiscountInputMode>('amount');
  const [cashReceived, setCashReceived] = useState(totals.grandTotal);
  const [cashAudit, setCashAudit] = useState<PaymentAuditDetails>({});
  const [cardAudit, setCardAudit] = useState<PaymentAuditDetails>({ cardType: 'DEBIT' });
  const [upiAudit, setUpiAudit] = useState<PaymentAuditDetails>({});
  const [chequeAudit, setChequeAudit] = useState<PaymentAuditDetails>({});
  const [ddAudit, setDdAudit] = useState<PaymentAuditDetails>({});
  const [creditAudit, setCreditAudit] = useState<PaymentAuditDetails>({});
  const [splits, setSplits] = useState<PaymentSplitDto[]>([
    emptySplit(PaymentMode.CASH),
    emptySplit(PaymentMode.UPI),
  ]);
  const [mounted, setMounted] = useState(false);
  const tabRef = useRef<PayTab>(PaymentMode.CASH);
  const pendingModeFocusRef = useRef<'bar' | 'fields' | null>(null);
  const { error, setError } = useTimedAlerts({ errorMs: 6000 });

  const setPayTab = useCallback((mode: PayTab) => {
    tabRef.current = mode;
    setTab(mode);
  }, []);

  const payable = totals.grandTotal;
  const exactDue = totals.exactDue;
  const roundedDue = Math.round(exactDue);
  const hasRound = Math.abs(totals.roundOff) >= 0.005;

  const auditForTab = useMemo((): PaymentAuditDetails => {
    switch (tab) {
      case PaymentMode.CASH:
        return cashAudit;
      case PaymentMode.CARD:
        return cardAudit;
      case PaymentMode.UPI:
        return upiAudit;
      case PaymentMode.CHEQUE:
        return chequeAudit;
      case PaymentMode.DD:
        return ddAudit;
      case PaymentMode.CREDIT:
        return creditAudit;
      default:
        return {};
    }
  }, [tab, cashAudit, cardAudit, upiAudit, chequeAudit, ddAudit, creditAudit]);

  const setAuditForTab = useCallback(
    (next: PaymentAuditDetails) => {
      switch (tab) {
        case PaymentMode.CASH:
          setCashAudit(next);
          break;
        case PaymentMode.CARD:
          setCardAudit(next);
          break;
        case PaymentMode.UPI:
          setUpiAudit(next);
          break;
        case PaymentMode.CHEQUE:
          setChequeAudit(next);
          break;
        case PaymentMode.DD:
          setDdAudit(next);
          break;
        case PaymentMode.CREDIT:
          setCreditAudit(next);
          break;
      }
    },
    [tab],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    if (totals.grandTotal > 0) setCashReceived(totals.grandTotal);
    setError('');
    setPayTab(PaymentMode.CASH);
    pendingModeFocusRef.current = 'bar';
    setSplits([emptySplit(PaymentMode.CASH), emptySplit(PaymentMode.UPI)]);
    setCashAudit({});
    setCardAudit({ cardType: 'DEBIT' });
    setUpiAudit({});
    setChequeAudit({});
    setDdAudit({});
    setCreditAudit({});
    // Only when modal opens - do not reset tab on every totals tick (was forcing UPI on Enter).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset once per open
  }, [open, setError, setPayTab]);

  useEffect(() => {
    if (!open || totals.grandTotal < 0.005) return;
    setCashReceived(totals.grandTotal);
  }, [open, totals.grandTotal]);

  const focusTabField = useCallback((mode: PayTab) => {
    window.setTimeout(() => {
      if (mode === PaymentMode.CASH) cashRef.current?.focus();
      else if (AUDIT_TABS.has(mode)) auditFirstRef.current?.focus();
      else payBtnRef.current?.focus();
    }, 0);
  }, []);

  const focusModeBar = useCallback((mode: PayTab = tab) => {
    window.setTimeout(() => {
      const idx = PAY_MODES.findIndex((m) => m.mode === mode);
      modeBtnRefs.current[idx >= 0 ? idx : 0]?.focus();
    }, 0);
  }, [tab]);

  useEffect(() => {
    if (!open) return;
    const pending = pendingModeFocusRef.current;
    if (!pending) return;
    pendingModeFocusRef.current = null;
    const id = window.setTimeout(() => {
      if (pending === 'fields') {
        focusTabField(tabRef.current);
      } else {
        const idx = PAY_MODES.findIndex((m) => m.mode === tabRef.current);
        modeBtnRefs.current[idx >= 0 ? idx : 0]?.focus();
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [tab, open, focusTabField]);

  const changeDue = useMemo(() => {
    if (tab !== PaymentMode.CASH) return 0;
    return Math.max(0, round2(cashReceived - payable));
  }, [tab, cashReceived, payable]);

  const splitSum = useMemo(
    () => round2(splits.reduce((s, x) => s + (x.amount || 0), 0)),
    [splits],
  );
  const splitRemaining = round2(payable - splitSum);

  const assertAudit = useCallback(
    (mode: PaymentMode, audit: PaymentAuditDetails, label: string) => {
      const err = validatePaymentAudit(mode, audit);
      if (err) {
        setError(`${label}: ${err}`);
        return false;
      }
      return true;
    },
    [setError],
  );

  const validateAndPay = useCallback(async () => {
    setError('');
    const payMode = tabRef.current;
    try {
      if (payMode === PaymentMode.CASH) {
        if (cashReceived + 0.001 < payable) {
          setError(`Cash received must be at least ₹${payable.toFixed(2)}`);
          cashRef.current?.focus();
          return;
        }
        await onComplete({
          paymentMode: PaymentMode.CASH,
          cashReceived: round2(cashReceived),
          audit: cashAudit,
        });
        return;
      }

      if (payMode === PaymentMode.SPLIT) {
        if (splits.length < 2) {
          setError('Add at least two payment lines');
          return;
        }
        if (Math.abs(splitSum - payable) > 0.01) {
          setError(
            splitRemaining > 0
              ? `₹${splitRemaining.toFixed(2)} still due - adjust split amounts`
              : `Split total exceeds due by ₹${Math.abs(splitRemaining).toFixed(2)}`,
          );
          return;
        }
        for (let i = 0; i < splits.length; i++) {
          const s = splits[i];
          if (!s.amount || s.amount <= 0) {
            setError(`Line ${i + 1}: enter amount`);
            return;
          }
          if (!assertAudit(s.mode, s.audit ?? {}, `Line ${i + 1}`)) return;
        }
        const cashParts = splits.filter((s) => s.mode === PaymentMode.CASH);
        let cashReceivedTotal: number | undefined;
        if (cashParts.length === 1 && cashParts[0].cashTendered && cashParts[0].cashTendered > 0) {
          cashReceivedTotal = cashParts[0].cashTendered;
        }
        await onComplete({
          paymentMode: PaymentMode.SPLIT,
          cashReceived: cashReceivedTotal,
          splits: splits.map((s) => ({
            mode: s.mode,
            amount: round2(s.amount),
            audit: s.audit,
            cashTendered:
              s.mode === PaymentMode.CASH && s.cashTendered ? round2(s.cashTendered) : undefined,
          })),
        });
        return;
      }

      const audit =
        payMode === PaymentMode.CARD
          ? cardAudit
          : payMode === PaymentMode.UPI
            ? upiAudit
            : payMode === PaymentMode.CHEQUE
              ? chequeAudit
              : payMode === PaymentMode.DD
                ? ddAudit
                : creditAudit;

      if (!assertAudit(payMode, audit, 'Payment')) return;

      const creditNote =
        payMode === PaymentMode.CREDIT
          ? creditAudit.creditTerms?.trim() || creditAudit.creditDueDate || 'On account'
          : undefined;

      await onComplete({
        paymentMode: payMode,
        audit,
        creditNote,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    }
  }, [
    tab,
    cashReceived,
    payable,
    cashAudit,
    auditForTab,
    creditAudit,
    splits,
    splitSum,
    splitRemaining,
    onComplete,
    setError,
    assertAudit,
  ]);

  const selectMode = useCallback(
    (mode: PayTab, focusFields = false) => {
      setPayTab(mode);
      pendingModeFocusRef.current = focusFields ? 'fields' : 'bar';
    },
    [setPayTab],
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inPanel = panelRef.current?.contains(t);

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (!inPanel) return;

      const inTextEntry =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement;

      const inModesBar = !!t.closest('.billing-pay-modes');
      const inPayBody = !!t.closest('.billing-pay-body');

      if (
        inModesBar &&
        (e.key === 'Enter' || e.key === ' ') &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        selectMode(tabRef.current, true);
        return;
      }

      const modeKey = PAY_MODES.find((m) => m.key === e.key);
      if (
        modeKey &&
        !inTextEntry &&
        (e.ctrlKey || e.altKey || inModesBar)
      ) {
        e.preventDefault();
        e.stopPropagation();
        selectMode(modeKey.mode);
        return;
      }

      if (e.key === 'r' && !e.ctrlKey && !e.altKey && !inTextEntry) {
        if (!hasRound) {
          e.preventDefault();
          void onApplyRoundOff('nearest');
        }
        return;
      }
      if (e.key === 'e' && !e.ctrlKey && !e.altKey && !inTextEntry) {
        if (hasRound) {
          e.preventDefault();
          void onApplyRoundOff('none');
        }
        return;
      }

      const MODE_COLS = 4;
      const arrowModeChange =
        inModesBar ||
        (!inTextEntry && !!t.closest('.billing-pay-main'));

      if (
        arrowModeChange &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        const idx = PAY_MODES.findIndex((m) => m.mode === tabRef.current);
        let next = idx;
        if (e.key === 'ArrowRight') next = (idx + 1) % PAY_MODES.length;
        if (e.key === 'ArrowLeft') next = (idx - 1 + PAY_MODES.length) % PAY_MODES.length;
        if (e.key === 'ArrowDown') next = Math.min(idx + MODE_COLS, PAY_MODES.length - 1);
        if (e.key === 'ArrowUp') next = Math.max(idx - MODE_COLS, 0);
        e.preventDefault();
        e.stopPropagation();
        selectMode(PAY_MODES[next].mode);
        return;
      }

      if (inPayBody && inTextEntry && e.key === 'ArrowUp' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        focusModeBar(tabRef.current);
        return;
      }

      if (
        inPayBody &&
        inTextEntry &&
        (e.ctrlKey || e.altKey) &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        const idx = PAY_MODES.findIndex((m) => m.mode === tabRef.current);
        const next =
          e.key === 'ArrowRight'
            ? (idx + 1) % PAY_MODES.length
            : (idx - 1 + PAY_MODES.length) % PAY_MODES.length;
        e.preventDefault();
        e.stopPropagation();
        selectMode(PAY_MODES[next].mode, true);
        return;
      }

      if (e.key === 'Home' && !inTextEntry) {
        e.preventDefault();
        e.stopPropagation();
        focusModeBar(tabRef.current);
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        e.stopPropagation();
        selectMode(tabRef.current, true);
        return;
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        void validateAndPay();
        return;
      }

      if (
        e.key === 'Enter' &&
        !e.ctrlKey &&
        !e.altKey &&
        t instanceof HTMLInputElement &&
        !inModesBar
      ) {
        const isDisc = t.closest('.disc-field');
        if (isDisc) return;
        const payMode = tabRef.current;
        if (payMode === PaymentMode.CASH && t.id === 'pay-cash') {
          e.preventDefault();
          void validateAndPay();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    open,
    onClose,
    selectMode,
    hasRound,
    onApplyRoundOff,
    validateAndPay,
    tab,
    focusModeBar,
    focusTabField,
  ]);

  if (!open || !mounted) return null;

  const content = (
    <div className="billing-pay-modal" role="dialog" aria-modal="true" aria-labelledby="pay-modal-title">
      <div className="billing-pay-modal__backdrop" aria-hidden />
      <div ref={panelRef} className="billing-pay-modal__panel billing-pay-modal__panel--payment">
        {busy && (
          <div className="billing-pay-modal__panel-busy" role="status" aria-live="polite" aria-busy="true">
            <div className="spinner-border text-light mb-2" role="presentation" />
            <span>Processing…</span>
          </div>
        )}
        <header className="billing-pay-modal__header">
          <h2 id="pay-modal-title" className="billing-pay-modal__title">
            Payment
          </h2>
          <button
            type="button"
            className="billing-pay-modal__close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close (Esc)"
          >
            ×
          </button>
        </header>

        <div className="billing-pay-due">
          <span className="billing-pay-due__label">Due</span>
          <span className="billing-pay-due__amount">₹ {payable.toFixed(2)}</span>
          {hasRound && (
            <span className="billing-pay-due__round">
              Round {totals.roundOff >= 0 ? '+' : ''}
              {totals.roundOff.toFixed(2)} · exact ₹{exactDue.toFixed(2)}
            </span>
          )}
        </div>

        <details className="billing-pay-details">
          <summary>Bill breakdown & discount</summary>
          <div className="billing-pay-summary">
            {totals.lineDiscountTotal > 0.005 && (
              <div className="billing-pay-row text-muted">
                <span>Gross</span>
                <span>₹ {(totals.subtotal + totals.lineDiscountTotal).toFixed(2)}</span>
              </div>
            )}
            {totals.lineDiscountTotal > 0 && (
              <div className="billing-pay-row billing-pay-row--disc">
                <span>Line discounts</span>
                <span>- ₹ {totals.lineDiscountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="billing-pay-row">
              <span>{totals.lineDiscountTotal > 0.005 ? 'Taxable' : 'Subtotal'}</span>
              <span>₹ {totals.subtotal.toFixed(2)}</span>
            </div>
            {(totals.cgstTotal > 0 || totals.sgstTotal > 0) && (
              <div className="billing-pay-row">
                <span>GST</span>
                <span>+ ₹ {(totals.cgstTotal + totals.sgstTotal + totals.igstTotal).toFixed(2)}</span>
              </div>
            )}
            <div className="billing-pay-row">
              <span>Total (incl. GST)</span>
              <span>₹ {totals.rawGrandTotal.toFixed(2)}</span>
            </div>
            <div className="billing-pay-disc">
              <DiscountField
                label="Extra bill discount"
                mode={billDiscMode}
                onModeChange={setBillDiscMode}
                amount={totals.billDiscount}
                gross={totals.rawGrandTotal}
                disabled={busy}
                compact
                onApply={(patch) => {
                  setError('');
                  void onApplyBillDiscount(
                    patch.discountPercent !== undefined
                      ? { percent: patch.discountPercent }
                      : { amount: patch.amount ?? 0 },
                  ).catch((err) => {
                    setError(err instanceof Error ? err.message : 'Could not apply discount');
                  });
                }}
              />
            </div>
            <div className="billing-pay-round">
              {!hasRound ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark"
                  disabled={busy}
                  onClick={() => void onApplyRoundOff('nearest')}
                >
                  <kbd>R</kbd> Round to ₹{roundedDue} (cash)
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  disabled={busy}
                  onClick={() => void onApplyRoundOff('none')}
                >
                  <kbd>E</kbd> Exact ₹{exactDue.toFixed(2)} (UPI/card)
                </button>
              )}
            </div>
          </div>
        </details>

        <div className="billing-pay-main">
          <div className="billing-pay-modes" role="tablist" aria-label="Payment method">
            {PAY_MODES.map(({ mode, label, key }, idx) => (
              <button
                key={mode}
                ref={(el) => {
                  modeBtnRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                data-pay-mode={mode}
                aria-selected={tab === mode}
                tabIndex={tab === mode ? 0 : -1}
                className={`billing-pay-mode${tab === mode ? ' billing-pay-mode--active' : ''}`}
                disabled={busy}
                title={`${label} (Ctrl+${key})`}
                onClick={() => selectMode(mode, true)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="billing-pay-body">
          {tab === PaymentMode.CASH && (
            <>
              <label className="billing-pay-field-label" htmlFor="pay-cash">
                Cash received
              </label>
              <NumericInput
                id="pay-cash"
                inputRef={cashRef}
                className="form-control billing-pay-input billing-pay-input--amount"
                value={cashReceived}
                onChange={setCashReceived}
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void validateAndPay();
                  }
                }}
              />
              <p className="billing-pay-change">
                Change: <strong>₹ {changeDue.toFixed(2)}</strong>
              </p>
              <PaymentAuditForm
                mode={PaymentMode.CASH}
                value={cashAudit}
                onChange={setCashAudit}
                disabled={busy}
                firstInputRef={auditFirstRef}
                onEnter={() => payBtnRef.current?.focus()}
              />
            </>
          )}

          {AUDIT_TABS.has(tab) && tab !== PaymentMode.CASH && (
            <PaymentAuditForm
              mode={tab}
              value={auditForTab}
              onChange={setAuditForTab}
              disabled={busy}
              firstInputRef={auditFirstRef}
              onEnter={() => payBtnRef.current?.focus()}
            />
          )}

          {tab === PaymentMode.SPLIT && (
            <div className="billing-pay-split">
              {splits.map((row, idx) => (
                <div key={idx} className="billing-pay-split-block">
                  <div className="billing-pay-split-row">
                    <select
                      className="form-control form-control-sm billing-pay-input"
                      value={row.mode}
                      disabled={busy}
                      onChange={(e) => {
                        const mode = e.target.value as PaymentMode;
                        setSplits((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, mode, audit: mode === PaymentMode.CARD ? { cardType: 'DEBIT' } : {} } : r,
                          ),
                        );
                      }}
                    >
                      {SPLIT_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <NumericInput
                      className="form-control form-control-sm billing-pay-input"
                      value={row.amount}
                      onChange={(amount) =>
                        setSplits((prev) => prev.map((r, i) => (i === idx ? { ...r, amount } : r)))
                      }
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busy || splits.length <= 2}
                      onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove line"
                    >
                      ×
                    </button>
                  </div>
                  <PaymentAuditForm
                    compact
                    mode={row.mode}
                    value={row.audit ?? {}}
                    onChange={(audit) =>
                      setSplits((prev) => prev.map((r, i) => (i === idx ? { ...r, audit } : r)))
                    }
                    disabled={busy}
                  />
                </div>
              ))}
              <button
                type="button"
                className="btn btn-sm btn-outline-primary btn-block"
                disabled={busy}
                onClick={() => setSplits((prev) => [...prev, emptySplit(PaymentMode.UPI)])}
              >
                + Add payment line
              </button>
              <p
                className={`billing-pay-split-total${Math.abs(splitRemaining) < 0.01 ? ' billing-pay-split-total--ok' : ''}`}
              >
                Split: ₹ {splitSum.toFixed(2)} / ₹ {payable.toFixed(2)}
              </p>
            </div>
          )}
          </div>
        </div>

        {error && (
          <div className="alert alert-danger billing-pay-error" role="alert">
            {error}
          </div>
        )}

        <footer className="billing-pay-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
            Cancel <kbd>Esc</kbd>
          </button>
          <button
            ref={payBtnRef}
            type="button"
            className="btn btn-success billing-pay-submit"
            disabled={busy || payable <= 0}
            onClick={() => void validateAndPay()}
          >
            {busy ? 'Processing…' : `Pay ₹ ${payable.toFixed(2)}`}
            <span className="billing-pay-submit-hint">
              <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
            </span>
          </button>
        </footer>

        <p className="billing-pay-keys" aria-hidden>
          <kbd>↑↓←→</kbd> payment type · <kbd>Enter</kbd> → amount/details · <kbd>↑</kbd> back to types ·{' '}
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> pay · <kbd>Esc</kbd> close
        </p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

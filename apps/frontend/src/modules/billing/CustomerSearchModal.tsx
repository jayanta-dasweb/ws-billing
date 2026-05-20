'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CustomerType,
  formatGstinInput,
  formatPanInput,
  normalizeIndianMobile,
  validateCustomerFields,
} from '@billing/shared';
import { MobileInput } from '@/components/forms/MobileInput';
import { useCreateCustomerMutation, useListCustomersQuery, type Customer } from '@/services/api/mastersApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';
import { getApiErrorMessage } from '@/utils/api';
import { WALK_IN_CUSTOMER_ID } from './CustomerPanel';

interface CustomerSearchModalProps {
  open: boolean;
  disabled?: boolean;
  currentName: string;
  onClose: () => void;
  onSelect: (
    customerId: string,
    name: string,
    mobile?: string | null,
    gst?: string | null,
    pan?: string | null,
    email?: string | null,
    address?: string | null,
  ) => void;
}

const EMPTY_NEW = {
  name: '',
  mobile: '',
  email: '',
  gstNumber: '',
  panNumber: '',
  billingAddress: '',
  shippingAddress: '',
  creditLimit: '',
  customerType: CustomerType.BUSINESS as CustomerType,
};

function selectCustomer(c: Customer, onSelect: CustomerSearchModalProps['onSelect'], onClose: () => void) {
  onSelect(
    c.id,
    c.name,
    c.mobile,
    c.gstNumber,
    c.panNumber,
    c.email,
    c.billingAddress,
  );
  onClose();
}

export function CustomerSearchModal({
  open,
  disabled,
  currentName,
  onClose,
  onSelect,
}: CustomerSearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 280);
  const [focusIdx, setFocusIdx] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const { error: localError, setError: setLocalError } = useTimedAlerts({ errorMs: 6000 });

  const searchActive = debouncedSearch.trim().length >= 2;

  const { data: customers, isFetching } = useListCustomersQuery(
    { search: debouncedSearch.trim(), limit: 25, activeOnly: true },
    { skip: !open || !searchActive },
  );
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();

  const results = useMemo(
    () => (customers?.items ?? []).filter((c) => c.id !== WALK_IN_CUSTOMER_ID),
    [customers],
  );

  const options = useMemo(() => {
    const walkIn = { id: WALK_IN_CUSTOMER_ID, name: 'Walk-in Customer', mobile: null as string | null };
    if (!searchActive) return [walkIn];
    return [walkIn, ...results];
  }, [results, searchActive]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setFocusIdx(0);
    setShowNew(false);
    setNewForm(EMPTY_NEW);
    setLocalError('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (showNew) {
      setFocusIdx(0);
      return;
    }
    // After search, highlight first match — not walk-in (index 0)
    if (searchActive && results.length > 0) {
      setFocusIdx(1);
    } else {
      setFocusIdx(0);
    }
  }, [debouncedSearch, showNew, searchActive, results.length]);

  const confirmSelection = (idx: number) => {
    const c = options[idx];
    if (!c) return;
    if (c.id === WALK_IN_CUSTOMER_ID) {
      onSelect(WALK_IN_CUSTOMER_ID, 'Walk-in Customer', null, null, null, null, null);
      onClose();
    } else {
      selectCustomer(c as Customer, onSelect, onClose);
    }
  };

  useEffect(() => {
    if (!open || showNew) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.target instanceof HTMLInputElement && e.target !== inputRef.current) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, options.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setFocusIdx(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        setFocusIdx(Math.max(0, options.length - 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmSelection(focusIdx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, showNew, options, focusIdx, onSelect, onClose]);

  const handleCreate = async () => {
    const validationError = validateCustomerFields({
      name: newForm.name,
      mobile: newForm.mobile,
      email: newForm.email,
      gstNumber: newForm.gstNumber,
      panNumber: newForm.panNumber,
    });
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    const mobile = normalizeIndianMobile(newForm.mobile)!;
    setLocalError('');
    try {
      const row = await createCustomer({
        name: newForm.name.trim(),
        mobile,
        email: newForm.email.trim() || undefined,
        gstNumber: formatGstinInput(newForm.gstNumber) || undefined,
        panNumber: formatPanInput(newForm.panNumber) || undefined,
        billingAddress: newForm.billingAddress.trim() || undefined,
        shippingAddress: newForm.shippingAddress.trim() || undefined,
        creditLimit: newForm.creditLimit ? Number(newForm.creditLimit) : 0,
        customerType: newForm.customerType,
        isActive: true,
      }).unwrap();
      selectCustomer(row, onSelect, onClose);
    } catch (e) {
      setLocalError(getApiErrorMessage(e, 'Could not create customer'));
    }
  };

  if (!open) return null;

  return (
    <div className="pharmacy-modal" role="dialog" aria-modal="true" aria-label="Customer">
      <button type="button" className="pharmacy-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="pharmacy-modal__panel pharmacy-modal__panel--wide">
        <div className="pharmacy-modal__head">
          <span>Customer</span>
          <kbd className="pharmacy-kbd">F2</kbd>
          <button type="button" className="pharmacy-modal__close" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="pharmacy-modal__body">
          <p className="pharmacy-modal__current">
            Now: <strong>{currentName}</strong>
          </p>

          {!showNew ? (
            <>
              <input
                ref={inputRef}
                type="text"
                className="pharmacy-modal__input"
                placeholder="Name, mobile, GST, PAN, or email (min 2 chars)…"
                value={search}
                disabled={disabled}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    confirmSelection(focusIdx);
                  }
                }}
              />
              <p className="pharmacy-modal__hint">
                {searchActive
                  ? isFetching
                    ? 'Searching…'
                    : results.length === 0
                      ? 'No match — try another term or add new customer'
                      : `↑↓ pick · Enter select · End last · ${results.length} match(es)`
                  : 'Walk-in = default. Type 2+ chars to search · Enter = walk-in'}
              </p>
              <div className="pharmacy-modal__list">
                {options.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pharmacy-modal__row${idx === focusIdx ? ' pharmacy-modal__row--active' : ''}${
                      c.id === WALK_IN_CUSTOMER_ID ? ' pharmacy-modal__row--walkin' : ''
                    }`}
                    disabled={disabled}
                    onClick={() => confirmSelection(idx)}
                  >
                    <div>
                      <strong>{c.name}</strong>
                      {c.id === WALK_IN_CUSTOMER_ID && (
                        <span className="pharmacy-modal__row-tag">Default · no GST invoice name</span>
                      )}
                    </div>
                    {c.mobile && <span className="pharmacy-modal__row-meta">{c.mobile}</span>}
                    {'gstNumber' in c && c.gstNumber && (
                      <span className="pharmacy-modal__row-meta">GST {c.gstNumber}</span>
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="pharmacy-modal__link"
                disabled={disabled}
                onClick={() => setShowNew(true)}
              >
                + New customer (full details)
              </button>
            </>
          ) : (
            <div className="pharmacy-modal__new pharmacy-modal__new--scroll">
              <p className="pharmacy-modal__hint mb-2">Quick register at counter — saved to customer master</p>
              <div className="pharmacy-modal__field-row">
                <label>Name *</label>
                <input
                  className="pharmacy-modal__input"
                  placeholder="Full name"
                  value={newForm.name}
                  disabled={disabled || creating}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="pharmacy-modal__field-row">
                <label>Mobile *</label>
                <MobileInput
                  className="pharmacy-modal__input"
                  value={newForm.mobile}
                  disabled={disabled || creating}
                  onChange={(mobile) => setNewForm((f) => ({ ...f, mobile }))}
                />
              </div>
              <div className="pharmacy-modal__field-row">
                <label>Email</label>
                <input
                  type="email"
                  className="pharmacy-modal__input"
                  placeholder="email@example.com"
                  value={newForm.email}
                  disabled={disabled || creating}
                  onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="pharmacy-modal__field-row">
                <label>GSTIN / VAT</label>
                <input
                  className="pharmacy-modal__input"
                  placeholder="GST number if registered"
                  value={newForm.gstNumber}
                  disabled={disabled || creating}
                  maxLength={15}
                  onChange={(e) => setNewForm((f) => ({ ...f, gstNumber: formatGstinInput(e.target.value) }))}
                />
              </div>
              <div className="pharmacy-modal__field-row">
                <label>PAN</label>
                <input
                  className="pharmacy-modal__input"
                  placeholder="PAN if available"
                  value={newForm.panNumber}
                  disabled={disabled || creating}
                  maxLength={10}
                  onChange={(e) => setNewForm((f) => ({ ...f, panNumber: formatPanInput(e.target.value) }))}
                />
              </div>
              <div className="pharmacy-modal__field-row">
                <label>Billing address</label>
                <textarea
                  className="pharmacy-modal__input"
                  rows={2}
                  placeholder="Street, city, state, PIN"
                  value={newForm.billingAddress}
                  disabled={disabled || creating}
                  onChange={(e) => setNewForm((f) => ({ ...f, billingAddress: e.target.value }))}
                />
              </div>
              <div className="pharmacy-modal__field-row">
                <label>Shipping address</label>
                <textarea
                  className="pharmacy-modal__input"
                  rows={2}
                  placeholder="Leave blank if same as billing"
                  value={newForm.shippingAddress}
                  disabled={disabled || creating}
                  onChange={(e) => setNewForm((f) => ({ ...f, shippingAddress: e.target.value }))}
                />
              </div>
              <div className="pharmacy-modal__field-row">
                <label>Credit limit (₹)</label>
                <input
                  type="number"
                  min={0}
                  className="pharmacy-modal__input"
                  placeholder="0 = no credit"
                  value={newForm.creditLimit}
                  disabled={disabled || creating}
                  onChange={(e) => setNewForm((f) => ({ ...f, creditLimit: e.target.value }))}
                />
              </div>
              <div className="pharmacy-modal__field-row">
                <label>Type</label>
                <select
                  className="pharmacy-modal__input"
                  value={newForm.customerType}
                  disabled={disabled || creating}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, customerType: e.target.value as CustomerType }))
                  }
                >
                  <option value={CustomerType.BUSINESS}>Business / registered</option>
                  <option value={CustomerType.WALK_IN}>Walk-in profile</option>
                </select>
              </div>
              <div className="pharmacy-modal__new-actions">
                <button type="button" className="pharmacy-btn pharmacy-btn--ghost" onClick={() => setShowNew(false)}>
                  Back
                </button>
                <button
                  type="button"
                  className="pharmacy-btn pharmacy-btn--primary"
                  disabled={disabled || creating}
                  onClick={() => void handleCreate()}
                >
                  Save &amp; select
                </button>
              </div>
            </div>
          )}
          {localError && <p className="pharmacy-modal__error">{localError}</p>}
        </div>
      </div>
    </div>
  );
}

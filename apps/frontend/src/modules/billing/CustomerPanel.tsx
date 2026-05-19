'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CustomerType } from '@billing/shared';
import { useCreateCustomerMutation, useListCustomersQuery } from '@/services/api/mastersApi';
import { useBillingStore } from '@/stores/billingStore';
import { getApiErrorMessage } from '@/utils/api';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';

export const WALK_IN_CUSTOMER_ID = 'seed-walkin';

interface CustomerPanelProps {
  customerId: string | null;
  customerName: string;
  customerMobile: string | null;
  customerGst: string | null;
  customerPan: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  disabled?: boolean;
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

export function CustomerPanel({
  customerId,
  customerName,
  customerMobile,
  customerGst,
  customerPan,
  customerEmail,
  customerAddress,
  disabled,
  onSelect,
}: CustomerPanelProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const focusField = useBillingStore((s) => s.focusField);
  const setFocusField = useBillingStore((s) => s.setFocusField);

  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newGst, setNewGst] = useState('');
  const [newPan, setNewPan] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [showNew, setShowNew] = useState(false);
  const { error: localError, setError: setLocalError } = useTimedAlerts({ errorMs: 6000 });

  const { data: customers } = useListCustomersQuery({ search: search || undefined, limit: 8, activeOnly: true });
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();

  const results = useMemo(() => customers?.items ?? [], [customers]);
  const isWalkIn = !customerId || customerId === WALK_IN_CUSTOMER_ID;

  useEffect(() => {
    if (focusField === 'customer' && !disabled) {
      searchRef.current?.focus();
      searchRef.current?.select();
      setFocusField(null);
    }
  }, [focusField, disabled, setFocusField]);

  const pickWalkIn = () => {
    setLocalError('');
    onSelect(WALK_IN_CUSTOMER_ID, 'Walk-in Customer', null, null, null, null, null);
    setSearch('');
    setShowNew(false);
  };

  const pickCustomer = (
    id: string,
    name: string,
    mobile?: string | null,
    gst?: string | null,
    pan?: string | null,
    email?: string | null,
    address?: string | null,
  ) => {
    setLocalError('');
    onSelect(id, name, mobile, gst, pan, email, address);
    setSearch('');
    setShowNew(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setLocalError('Name is required');
      return;
    }
    const mobile = newMobile.trim();
    if (!mobile) {
      setLocalError('Mobile is required for billing');
      return;
    }
    setLocalError('');
    try {
      const row = await createCustomer({
        name: newName.trim(),
        mobile,
        gstNumber: newGst.trim() || undefined,
        panNumber: newPan.trim() || undefined,
        email: newEmail.trim() || undefined,
        billingAddress: newAddress.trim() || undefined,
        customerType: CustomerType.BUSINESS,
        isActive: true,
      }).unwrap();
      pickCustomer(
        row.id,
        row.name,
        row.mobile,
        row.gstNumber,
        row.panNumber,
        row.email,
        row.billingAddress,
      );
      setNewName('');
      setNewMobile('');
      setNewGst('');
      setNewPan('');
      setNewEmail('');
      setNewAddress('');
    } catch (e) {
      setLocalError(getApiErrorMessage(e, 'Could not create customer'));
    }
  };

  return (
    <div className="billing-panel">
      <div className="billing-panel__head d-flex justify-content-between align-items-center">
        <span>Customer (F2)</span>
        <button type="button" className="btn btn-link btn-sm p-0" disabled={disabled} onClick={pickWalkIn}>
          Walk-in
        </button>
      </div>
      <div className="billing-panel__body">
        <p className="font-weight-bold mb-1 text-truncate" title={customerName}>
          {customerName}
        </p>
        {!isWalkIn &&
          (customerMobile || customerGst || customerPan || customerEmail || customerAddress) && (
            <div className="small text-muted mb-2 border rounded p-2 bg-light">
              {customerMobile && (
                <div>
                  <strong>Mobile:</strong> {customerMobile}
                </div>
              )}
              {customerGst && (
                <div>
                  <strong>GSTIN:</strong> {customerGst}
                </div>
              )}
              {customerPan && (
                <div>
                  <strong>PAN:</strong> {customerPan}
                </div>
              )}
              {customerEmail && (
                <div>
                  <strong>Email:</strong> {customerEmail}
                </div>
              )}
              {customerAddress && (
                <div>
                  <strong>Address:</strong> {customerAddress}
                </div>
              )}
            </div>
          )}

        <input
          ref={searchRef}
          type="text"
          className="form-control form-control-sm mb-2"
          placeholder="Search name or mobile… (F2)"
          value={search}
          disabled={disabled}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="billing-panel__scroll mb-2">
          {results.length === 0 && search ? (
            <p className="small text-muted mb-2">No match — add as new below</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                className="btn btn-light btn-block btn-sm text-left mb-1 py-1"
                disabled={disabled}
                onClick={() =>
                  pickCustomer(c.id, c.name, c.mobile, c.gstNumber, c.panNumber, c.email, c.billingAddress)
                }
              >
                <span className="d-block text-truncate font-weight-bold">{c.name}</span>
                <small className="text-muted d-block">
                  {[c.mobile, c.gstNumber].filter(Boolean).join(' · ') || 'No mobile on file'}
                </small>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm btn-block mb-2"
          disabled={disabled}
          onClick={() => setShowNew((v) => !v)}
        >
          {showNew ? 'Cancel new customer' : '+ New customer'}
        </button>

        {showNew && (
          <div className="border rounded p-2 mb-2 bg-light">
            <input
              className="form-control form-control-sm mb-1"
              placeholder="Name *"
              value={newName}
              disabled={disabled || creating}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="form-control form-control-sm mb-1"
              placeholder="Mobile *"
              value={newMobile}
              disabled={disabled || creating}
              onChange={(e) => setNewMobile(e.target.value)}
            />
            <input
              className="form-control form-control-sm mb-1"
              placeholder="GSTIN"
              value={newGst}
              disabled={disabled || creating}
              onChange={(e) => setNewGst(e.target.value)}
            />
            <input
              className="form-control form-control-sm mb-1"
              placeholder="PAN"
              value={newPan}
              disabled={disabled || creating}
              onChange={(e) => setNewPan(e.target.value)}
            />
            <input
              className="form-control form-control-sm mb-1"
              placeholder="Email"
              value={newEmail}
              disabled={disabled || creating}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <textarea
              className="form-control form-control-sm mb-1"
              placeholder="Billing address"
              rows={2}
              value={newAddress}
              disabled={disabled || creating}
              onChange={(e) => setNewAddress(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm btn-block"
              disabled={disabled || creating}
              onClick={() => void handleCreate()}
            >
              {creating ? (
                <>
                  <span className="spinner-border spinner-border-sm mr-1" role="presentation" />
                  Saving…
                </>
              ) : (
                'Save & use'
              )}
            </button>
          </div>
        )}

        {localError && <p className="small text-danger mb-0">{localError}</p>}
      </div>
    </div>
  );
}


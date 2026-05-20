'use client';

import type { RefObject } from 'react';
import { PaymentMode } from '@billing/shared';
import type { PaymentAuditDetails } from '@billing/shared';
import { SimpleDateField } from './SimpleDateField';
import { SimpleDateTimeField } from './SimpleDateTimeField';

interface PaymentAuditFormProps {
  mode: PaymentMode;
  value: PaymentAuditDetails;
  onChange: (next: PaymentAuditDetails) => void;
  disabled?: boolean;
  firstInputRef?: RefObject<HTMLInputElement | null>;
  onEnter?: () => void;
  compact?: boolean;
}

function field(
  id: string,
  label: string,
  props: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
    type?: string;
    inputRef?: RefObject<HTMLInputElement | null>;
    onEnter?: () => void;
    maxLength?: number;
  },
) {
  return (
    <div className="billing-pay-field">
      <label className="billing-pay-field-label" htmlFor={id}>
        {label}
        {props.required ? ' *' : ''}
      </label>
      <input
        id={id}
        ref={props.inputRef}
        type={props.type ?? 'text'}
        className="form-control billing-pay-input"
        value={props.value}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        disabled={props.disabled}
        autoComplete="off"
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && props.onEnter) {
            e.preventDefault();
            props.onEnter();
          }
        }}
      />
    </div>
  );
}

export function PaymentAuditForm({
  mode,
  value,
  onChange,
  disabled,
  firstInputRef,
  onEnter,
  compact,
}: PaymentAuditFormProps) {
  const set = (patch: Partial<PaymentAuditDetails>) => onChange({ ...value, ...patch });
  const gridClass = compact ? 'billing-pay-audit-grid billing-pay-audit-grid--compact' : 'billing-pay-audit-grid';

  if (mode === PaymentMode.CASH) {
    return (
      <div className={gridClass}>
        {field('pay-cash-remark', 'Remark (optional)', {
          value: value.remark ?? '',
          onChange: (remark) => set({ remark }),
          disabled,
          placeholder: 'e.g. rounded notes, drawer ref',
          inputRef: firstInputRef,
          onEnter,
        })}
      </div>
    );
  }

  if (mode === PaymentMode.UPI) {
    return (
      <div className={gridClass}>
        {field('pay-upi-txn', 'UPI transaction ID', {
          value: value.upiTxnId ?? '',
          onChange: (upiTxnId) => set({ upiTxnId: upiTxnId.replace(/[^A-Za-z0-9]/g, '').slice(0, 32) }),
          disabled,
          required: true,
          placeholder: '12-digit ref from customer SMS',
          inputRef: firstInputRef,
          onEnter,
        })}
        {field('pay-upi-app', 'App / provider', {
          value: value.upiApp ?? '',
          onChange: (upiApp) => set({ upiApp }),
          disabled,
          placeholder: 'PhonePe, GPay, Paytm…',
        })}
        {field('pay-upi-vpa', 'Payer VPA (optional)', {
          value: value.upiPayerVpa ?? '',
          onChange: (upiPayerVpa) => set({ upiPayerVpa }),
          disabled,
          placeholder: 'name@bank',
        })}
        {field('pay-upi-at', 'Txn date & time', {
          value: value.upiTxnAt ?? '',
          onChange: (upiTxnAt) => set({ upiTxnAt }),
          disabled,
          type: 'datetime-local',
        })}
      </div>
    );
  }

  if (mode === PaymentMode.CARD) {
    return (
      <div className={gridClass}>
        <div className="billing-pay-field billing-pay-field--full">
          <span className="billing-pay-field-label">Card type *</span>
          <div className="billing-pay-card-type" role="radiogroup">
            {(['DEBIT', 'CREDIT'] as const).map((ct) => (
              <label key={ct} className="billing-pay-card-type-opt">
                <input
                  type="radio"
                  name="cardType"
                  checked={value.cardType === ct}
                  disabled={disabled}
                  onChange={() => set({ cardType: ct })}
                />
                {ct === 'DEBIT' ? 'Debit (DC)' : 'Credit (CC)'}
              </label>
            ))}
          </div>
        </div>
        {field('pay-card-bank', 'Bank name', {
          value: value.cardBank ?? '',
          onChange: (cardBank) => set({ cardBank }),
          disabled,
          required: true,
          inputRef: firstInputRef,
        })}
        {field('pay-card-last4', 'Last 4 digits', {
          value: value.cardLast4 ?? '',
          onChange: (cardLast4) => set({ cardLast4: cardLast4.replace(/\D/g, '').slice(0, 4) }),
          disabled,
          required: true,
          maxLength: 4,
          placeholder: '1234',
        })}
        {field('pay-card-auth', 'Approval / auth code', {
          value: value.cardApprovalCode ?? '',
          onChange: (cardApprovalCode) => set({ cardApprovalCode }),
          disabled,
          placeholder: 'From POS slip',
        })}
        {field('pay-card-rrn', 'RRN / bank txn ref', {
          value: value.cardRrn ?? '',
          onChange: (cardRrn) => set({ cardRrn }),
          disabled,
          placeholder: 'Required if no approval code',
          onEnter,
        })}
        {field('pay-card-network', 'Network', {
          value: value.cardNetwork ?? '',
          onChange: (cardNetwork) => set({ cardNetwork }),
          disabled,
          placeholder: 'Visa, RuPay, Mastercard',
        })}
        {field('pay-card-terminal', 'Terminal / TID', {
          value: value.cardTerminalId ?? '',
          onChange: (cardTerminalId) => set({ cardTerminalId }),
          disabled,
        })}
      </div>
    );
  }

  if (mode === PaymentMode.CHEQUE) {
    return (
      <div className={gridClass}>
        {field('pay-chq-no', 'Cheque number', {
          value: value.chequeNo ?? '',
          onChange: (chequeNo) => set({ chequeNo }),
          disabled,
          required: true,
          inputRef: firstInputRef,
        })}
        {field('pay-chq-bank', 'Bank', {
          value: value.chequeBank ?? '',
          onChange: (chequeBank) => set({ chequeBank }),
          disabled,
          required: true,
        })}
        {field('pay-chq-branch', 'Branch', {
          value: value.chequeBranch ?? '',
          onChange: (chequeBranch) => set({ chequeBranch }),
          disabled,
        })}
        <SimpleDateField
          id="pay-chq-date"
          label="Cheque date"
          value={value.chequeDate}
          onChange={(chequeDate) => set({ chequeDate })}
          disabled={disabled}
          required
          onEnter={onEnter}
        />
        {field('pay-chq-drawer', 'Drawer name', {
          value: value.chequeDrawer ?? '',
          onChange: (chequeDrawer) => set({ chequeDrawer }),
          disabled,
        })}
      </div>
    );
  }

  if (mode === PaymentMode.DD) {
    return (
      <div className={gridClass}>
        {field('pay-dd-no', 'DD number', {
          value: value.ddNo ?? '',
          onChange: (ddNo) => set({ ddNo }),
          disabled,
          required: true,
          inputRef: firstInputRef,
        })}
        {field('pay-dd-bank', 'Bank', {
          value: value.ddBank ?? '',
          onChange: (ddBank) => set({ ddBank }),
          disabled,
          required: true,
        })}
        {field('pay-dd-branch', 'Branch', {
          value: value.ddBranch ?? '',
          onChange: (ddBranch) => set({ ddBranch }),
          disabled,
        })}
        <SimpleDateField
          id="pay-dd-date"
          label="DD date"
          value={value.ddDate}
          onChange={(ddDate) => set({ ddDate })}
          disabled={disabled}
          required
          onEnter={onEnter}
        />
      </div>
    );
  }

  if (mode === PaymentMode.CREDIT) {
    return (
      <div className={gridClass}>
        <p className="billing-pay-hint">Registered customer required (not walk-in).</p>
        {field('pay-credit-terms', 'Credit terms', {
          value: value.creditTerms ?? '',
          onChange: (creditTerms) => set({ creditTerms }),
          disabled,
          placeholder: 'e.g. 30 days from invoice',
          inputRef: firstInputRef,
        })}
        <SimpleDateField
          id="pay-credit-due"
          label="Due date"
          value={value.creditDueDate}
          onChange={(creditDueDate) => set({ creditDueDate })}
          disabled={disabled}
        />
        {field('pay-credit-po', 'PO / order ref', {
          value: value.creditPoRef ?? '',
          onChange: (creditPoRef) => set({ creditPoRef }),
          disabled,
          onEnter,
        })}
      </div>
    );
  }

  return null;
}

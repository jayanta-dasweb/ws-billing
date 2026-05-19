'use client';

import { useEffect, useMemo, useState } from 'react';
import { discountFromPercent, round2 } from '@billing/shared';
import { NumericInput } from '@/components/masters/NumericInput';

export type DiscountInputMode = 'amount' | 'percent';

export interface DiscountFieldProps {
  id?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  label?: string;
  mode: DiscountInputMode;
  onModeChange: (mode: DiscountInputMode) => void;
  /** Current discount ₹ stored on bill line / bill */
  amount: number;
  /** For line: qty × rate. For bill: total before bill discount */
  gross: number;
  onApply: (patch: { amount?: number; discountPercent?: number }) => void;
  disabled?: boolean;
  compact?: boolean;
  hint?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function DiscountField({
  id,
  inputRef,
  label = 'Discount',
  mode,
  onModeChange,
  amount,
  gross,
  onApply,
  disabled,
  compact,
  hint,
  onKeyDown,
}: DiscountFieldProps) {
  const derivedPercent = useMemo(
    () => (gross > 0 ? round2((amount / gross) * 100) : 0),
    [amount, gross],
  );

  const [localAmount, setLocalAmount] = useState(amount);
  const [localPercent, setLocalPercent] = useState(derivedPercent);

  useEffect(() => {
    setLocalAmount(amount);
    setLocalPercent(derivedPercent);
  }, [amount, derivedPercent]);

  const preview = useMemo(() => {
    if (mode === 'percent') {
      return discountFromPercent(gross, localPercent);
    }
    return round2(Math.min(localAmount, gross > 0 ? gross : localAmount));
  }, [mode, localAmount, localPercent, gross]);

  const apply = () => {
    if (mode === 'percent') {
      onApply({ discountPercent: localPercent });
    } else {
      onApply({ amount: round2(Math.min(localAmount, gross > 0 ? gross : localAmount)) });
    }
  };

  return (
    <div className={`disc-field${compact ? ' disc-field--compact' : ''}`}>
      <div className="disc-field__head">
        <label className="disc-field__label small mb-0" htmlFor={id}>
          {label}
        </label>
        <div className="disc-field__toggle btn-group btn-group-sm" role="group" aria-label="Discount type">
          <button
            type="button"
            className={`btn btn-sm ${mode === 'amount' ? 'btn-primary' : 'btn-outline-secondary'}`}
            disabled={disabled}
            onClick={() => onModeChange('amount')}
          >
            ₹
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'percent' ? 'btn-primary' : 'btn-outline-secondary'}`}
            disabled={disabled}
            onClick={() => onModeChange('percent')}
          >
            %
          </button>
        </div>
      </div>
      <div className="disc-field__row">
        {mode === 'amount' ? (
          <NumericInput
            id={id}
            inputRef={inputRef}
            className="form-control form-control-sm disc-field__input"
            value={localAmount}
            onChange={setLocalAmount}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
              onKeyDown?.(e);
            }}
          />
        ) : (
          <NumericInput
            id={id}
            inputRef={inputRef}
            className="form-control form-control-sm disc-field__input"
            value={localPercent}
            onChange={setLocalPercent}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
              onKeyDown?.(e);
            }}
          />
        )}
        <button
          type="button"
          className="btn btn-sm btn-outline-primary disc-field__apply"
          disabled={disabled}
          onClick={apply}
        >
          Set
        </button>
      </div>
      <div className="disc-field__meta">
        <span className="disc-field__preview">− ₹ {preview.toFixed(2)}</span>
        {gross > 0 && <span className="disc-field__gross text-muted">of ₹ {gross.toFixed(2)}</span>}
      </div>
      {hint && <span className="disc-field__hint">{hint}</span>}
    </div>
  );
}

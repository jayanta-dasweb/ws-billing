'use client';

import { useEffect, useId, useState } from 'react';
import {
  displayToStoredDate,
  formatDateTyping,
  todayDateStr,
  toDisplayDate,
} from './simpleDateTimeUtils';

interface SimpleDateFieldProps {
  id?: string;
  label: string;
  value?: string;
  onChange: (stored: string) => void;
  disabled?: boolean;
  required?: boolean;
  onEnter?: () => void;
}

export function SimpleDateField({
  id: idProp,
  label,
  value,
  onChange,
  disabled,
  required,
  onEnter,
}: SimpleDateFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [date, setDate] = useState('');

  useEffect(() => {
    setDate(toDisplayDate(value));
  }, [value]);

  return (
    <div className="billing-pay-field simple-dt">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
        <label className="billing-pay-field-label mb-0" htmlFor={id}>
          {label}
          {required ? ' *' : ''}
        </label>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary simple-dt__now"
          disabled={disabled}
          onClick={() => {
            const t = todayDateStr();
            setDate(t);
            onChange(displayToStoredDate(t));
          }}
        >
          Today
        </button>
      </div>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        className="form-control billing-pay-input"
        placeholder="DD/MM/YYYY"
        value={date}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          const next = formatDateTyping(e.target.value);
          setDate(next);
          onChange(displayToStoredDate(next));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
    </div>
  );
}

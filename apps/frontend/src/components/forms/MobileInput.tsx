'use client';

import { digitsOnly } from '@billing/shared';

interface MobileInputProps {
  id?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

/** 10-digit Indian mobile — digits only while typing. */
export function MobileInput({
  id,
  className = 'form-control form-control-sm',
  value,
  onChange,
  disabled,
  placeholder = '10-digit mobile',
  autoFocus,
}: MobileInputProps) {
  return (
    <input
      id={id}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      className={className}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      maxLength={10}
      onChange={(e) => onChange(digitsOnly(e.target.value, 10))}
    />
  );
}

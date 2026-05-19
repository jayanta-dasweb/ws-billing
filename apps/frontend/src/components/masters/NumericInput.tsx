'use client';

import { useEffect, useState, type KeyboardEventHandler, type Ref } from 'react';

const DECIMAL_PATTERN = /^\d*\.?\d*$/;

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** Fires after blur normalization (final numeric value). */
  onAfterBlur?: (value: number) => void;
  /** Keep user-typed text when parent `value` changes (e.g. stock rejected but qty stays visible). */
  lockDisplay?: boolean;
}

function formatDisplay(n: number): string {
  if (n === 0) return '';
  return String(n);
}

/** Text-based decimal field — no spinner arrows; you can type freely. */
export function NumericInput({
  value,
  onChange,
  className = 'form-control',
  placeholder,
  disabled,
  min = 0,
  id,
  inputRef,
  onKeyDown,
  onAfterBlur,
  lockDisplay = false,
}: NumericInputProps) {
  const [text, setText] = useState(() => formatDisplay(value));

  useEffect(() => {
    if (lockDisplay) return;
    setText(formatDisplay(value));
  }, [value, lockDisplay]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        if (next !== '' && !DECIMAL_PATTERN.test(next)) return;
        setText(next);
        if (next === '' || next === '.') {
          return;
        }
        const parsed = parseFloat(next);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => {
        let n = text === '' || text === '.' ? 0 : parseFloat(text);
        if (Number.isNaN(n)) n = 0;
        if (n < min) n = min;
        onChange(n);
        setText(formatDisplay(n));
        onAfterBlur?.(n);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

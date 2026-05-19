'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import {
  formatDateTyping,
  parseIsoToParts,
  partsToIso,
  pad2,
} from './simpleDateTimeUtils';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

interface SimpleDateTimeFieldProps {
  id?: string;
  label: string;
  value?: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  onEnter?: () => void;
}

export function SimpleDateTimeField({
  id: idProp,
  label,
  value,
  onChange,
  disabled,
  onEnter,
}: SimpleDateTimeFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [date, setDate] = useState('');
  const [hour12, setHour12] = useState('');
  const [minute, setMinute] = useState('');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    const p = parseIsoToParts(value);
    setDate(p.date);
    setHour12(p.hour12);
    setMinute(p.minute);
    setAmpm(p.ampm);
  }, [value]);

  const emit = useCallback(
    (d: string, h: string, m: string, ap: 'AM' | 'PM') => {
      if (!d.trim() && !h && !m) {
        onChange('');
        return;
      }
      onChange(partsToIso(d, h || '12', m || '00', ap));
    },
    [onChange],
  );

  const setNow = () => {
    const n = parseIsoToParts(new Date().toISOString());
    setDate(n.date);
    setHour12(n.hour12);
    setMinute(n.minute);
    setAmpm(n.ampm);
    onChange(partsToIso(n.date, n.hour12, n.minute, n.ampm));
  };

  return (
    <div className="billing-pay-field billing-pay-field--full simple-dt">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
        <label className="billing-pay-field-label mb-0" htmlFor={`${id}-date`}>
          {label}
        </label>
        <button
          type="button"
          className="btn btn-sm btn-outline-info simple-dt__now"
          disabled={disabled}
          onClick={setNow}
        >
          <i className="fas fa-clock mr-1" aria-hidden />
          Now
        </button>
      </div>
      <div className="simple-dt__row">
        <input
          id={`${id}-date`}
          type="text"
          inputMode="numeric"
          className="form-control billing-pay-input simple-dt__date"
          placeholder="DD/MM/YYYY"
          value={date}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => {
            const next = formatDateTyping(e.target.value);
            setDate(next);
            emit(next, hour12, minute, ampm);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        <select
          className="form-control billing-pay-input simple-dt__select"
          value={hour12}
          disabled={disabled}
          aria-label="Hour"
          onChange={(e) => {
            const h = e.target.value;
            setHour12(h);
            emit(date, h, minute || '00', ampm);
          }}
        >
          <option value="">Hr</option>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="simple-dt__colon" aria-hidden>
          :
        </span>
        <select
          className="form-control billing-pay-input simple-dt__select"
          value={minute}
          disabled={disabled}
          aria-label="Minute"
          onChange={(e) => {
            const m = e.target.value;
            setMinute(m);
            emit(date, hour12 || '12', m, ampm);
          }}
        >
          <option value="">Min</option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="form-control billing-pay-input simple-dt__select simple-dt__ampm"
          value={ampm}
          disabled={disabled}
          aria-label="AM or PM"
          onChange={(e) => {
            const ap = e.target.value as 'AM' | 'PM';
            setAmpm(ap);
            emit(date, hour12 || '12', minute || '00', ap);
          }}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      <small className="text-muted simple-dt__hint">Tap Now for current time, or pick date + time</small>
    </div>
  );
}

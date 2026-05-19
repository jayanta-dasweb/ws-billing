'use client';

export type StockMetricKind = 'available' | 'reserved' | 'short';
export type StockMetricVariant = 'light' | 'dark';
export type StockMetricSize = 'sm' | 'md';

const KIND_META: Record<
  StockMetricKind,
  { label: string; shortLabel: string; icon: string; chipClass: string }
> = {
  available: {
    label: 'Free pool',
    shortLabel: 'Pool',
    icon: 'fa-circle-check',
    chipClass: 'stk-metric--avail',
  },
  reserved: {
    label: 'Reserved',
    shortLabel: 'Rsv',
    icon: 'fa-lock',
    chipClass: 'stk-metric--rsv',
  },
  short: {
    label: 'Shortage',
    shortLabel: 'Short',
    icon: 'fa-triangle-exclamation',
    chipClass: 'stk-metric--short',
  },
};

function formatQty(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export interface StockMetricProps {
  kind: StockMetricKind;
  value: number | null | undefined;
  live?: boolean;
  variant?: StockMetricVariant;
  size?: StockMetricSize;
  /** Low stock warning on available */
  tone?: 'default' | 'low' | 'critical';
  className?: string;
}

export function StockMetric({
  kind,
  value,
  variant = 'light',
  size = 'sm',
  tone = 'default',
  className = '',
}: StockMetricProps) {
  const meta = KIND_META[kind];
  const display = formatQty(value);
  const caption = size === 'sm' ? meta.shortLabel : meta.label;

  return (
    <span
      className={[
        'stk-metric',
        meta.chipClass,
        `stk-metric--${variant}`,
        `stk-metric--${size}`,
        tone !== 'default' ? `stk-metric--tone-${tone}` : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      title={`${meta.label}: ${display}`}
    >
      <span className="stk-metric__icon" aria-hidden>
        <i className={`fas ${meta.icon}`} />
      </span>
      <span className="stk-metric__body">
        <span className="stk-metric__label">{caption}</span>
        <span className="stk-metric__value">{display}</span>
      </span>
    </span>
  );
}

export interface StockMetricsInlineProps {
  batchId?: string;
  available?: number | null;
  reserved?: number | null;
  short?: number | null;
  live?: boolean;
  variant?: StockMetricVariant;
}

/** Compact row for bill lines — available, reserved, optional shortage */
export function StockMetricsInline({
  batchId,
  available,
  reserved,
  short,
  live,
  variant = 'light',
}: StockMetricsInlineProps) {
  if (!batchId) {
    return <span className="stk-inline stk-inline--empty">No batch linked</span>;
  }

  const availTone =
    typeof available === 'number' && typeof short === 'number' && short > 0
      ? 'critical'
      : typeof available === 'number' && available <= 5
        ? 'low'
        : 'default';

  return (
    <span className="stk-inline" role="status" aria-live="polite">
      <StockMetric
        kind="available"
        value={available}
        live={live}
        variant={variant}
        size="sm"
        tone={availTone}
      />
      <StockMetric kind="reserved" value={reserved} variant={variant} size="sm" />
      {short != null && short > 0.001 && (
        <StockMetric
          kind="short"
          value={short}
          variant={variant}
          size="sm"
          tone="critical"
          className="stk-metric--short-pill"
        />
      )}
    </span>
  );
}

export interface StockMetricsPairProps {
  available: number;
  reserved: number;
  live?: boolean;
  variant?: StockMetricVariant;
  lowStock?: boolean;
}

/** Side-by-side cards for batch picker / panels */
export function StockMetricsPair({
  available,
  reserved,
  live,
  variant = 'dark',
  lowStock,
}: StockMetricsPairProps) {
  return (
    <div className="stk-pair">
      <StockMetric
        kind="available"
        value={available}
        live={live}
        variant={variant}
        size="md"
        tone={lowStock ? 'low' : 'default'}
      />
      <StockMetric kind="reserved" value={reserved} variant={variant} size="md" />
    </div>
  );
}

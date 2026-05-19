'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { BillingLineItem } from '@/stores/billingStore';

interface BillingAlertsStripProps {
  items: BillingLineItem[];
  connected: boolean;
  grandTotal: number;
  customerCreditLimit?: number | null;
  paymentMismatch?: boolean;
}

type AlertItem = { id: string; node: ReactNode };

/** Real warnings only — dismiss with ×. No always-on tips or draft text. */
export function BillingAlertsStrip({
  items,
  connected,
  grandTotal,
  customerCreditLimit,
  paymentMismatch,
}: BillingAlertsStripProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts = useMemo(() => {
    const list: AlertItem[] = [];

    if (!connected) {
      list.push({
        id: 'ws-offline',
        node: (
          <span className="billing-alert billing-alert--danger">Stock sync offline — reconnect</span>
        ),
      });
    }

    if (paymentMismatch) {
      list.push({
        id: 'pay-mismatch',
        node: <span className="billing-alert billing-alert--warn">Split payment does not match total</span>,
      });
    }

    if (customerCreditLimit != null && customerCreditLimit > 0 && grandTotal > customerCreditLimit * 0.9) {
      list.push({
        id: 'credit-limit',
        node: (
          <span className="billing-alert billing-alert--warn">
            Near credit limit (₹{customerCreditLimit})
          </span>
        ),
      });
    }

    for (const item of items.slice(0, 3)) {
      const sellable =
        item.stockQty != null && item.pendingQty != null
          ? item.stockQty - item.pendingQty + item.qty
          : item.availableQty;
      if (typeof sellable === 'number' && item.qty > sellable + 0.0001) {
        const short = Math.round((item.qty - sellable) * 100) / 100;
        list.push({
          id: `line-${item.id}`,
          node: (
            <span className="billing-alert billing-alert--danger">
              Low stock: {item.productName} (need {item.qty}, can sell {sellable}
              {short > 0 ? `, short ${short}` : ''})
            </span>
          ),
        });
      } else if (!item.batchId) {
        list.push({
          id: `line-${item.id}`,
          node: (
            <span className="billing-alert billing-alert--warn">Pick batch: {item.productName}</span>
          ),
        });
      }
    }

    return list;
  }, [connected, paymentMismatch, customerCreditLimit, grandTotal, items]);

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed(new Set(alerts.map((a) => a.id)));
  }, [alerts]);

  if (visible.length === 0) return null;

  return (
    <div className="billing-alerts" role="status">
      <div className="billing-alerts__list">
        {visible.map((a) => (
          <span key={a.id} className="billing-alerts__item">
            {a.node}
            <button
              type="button"
              className="billing-alerts__dismiss-one"
              aria-label="Dismiss"
              onClick={() => dismiss(a.id)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <button type="button" className="billing-alerts__close" onClick={dismissAll} aria-label="Dismiss all">
        ×
      </button>
    </div>
  );
}

export const OperationalGuidanceBar = BillingAlertsStrip;

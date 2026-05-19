'use client';

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';
import type { BillingLineItem } from '@/stores/billingStore';
import { useLiveBatchStock } from '@/hooks/useLiveBatchStock';
import { StockMetricsPair } from '@/components/billing/StockMetrics';

interface LiveStockPanelProps {
  items: BillingLineItem[];
  selectedLineId: string | null;
}

function BatchStockCard({
  batchId,
  label,
  qtyOnBill,
  fallback,
}: {
  batchId: string;
  label: string;
  qtyOnBill: number;
  fallback?: { availableQty?: number; pendingQty?: number; stockQty?: number };
}) {
  const live = useLiveBatchStock(batchId, fallback);
  const avail = live.availableQty ?? 0;
  const reserved = live.pendingQty ?? 0;
  const low = typeof live.availableQty === 'number' && live.availableQty < qtyOnBill;

  return (
    <div className={`stk-panel-card${low ? ' stk-panel-card--warn' : ''}`}>
      <p className="stk-panel-card__name text-truncate mb-2" title={label}>
        {label}
      </p>
      <StockMetricsPair
        available={avail}
        reserved={reserved}
        live={live.isLive}
        variant="light"
        lowStock={low}
      />
    </div>
  );
}

export function LiveStockPanel({ items, selectedLineId }: LiveStockPanelProps) {
  const wsConnected = useSelector((s: RootState) => s.websocket.connected);
  const lastEvent = useSelector((s: RootState) => s.websocket.lastEvent);

  const batchesOnBill = useMemo(() => {
    const seen = new Map<string, { item: BillingLineItem; qty: number }>();
    for (const item of items) {
      if (!item.batchId) continue;
      const prev = seen.get(item.batchId);
      if (prev) prev.qty += item.qty;
      else seen.set(item.batchId, { item, qty: item.qty });
    }
    return [...seen.entries()];
  }, [items]);

  const selected = items.find((i) => i.id === selectedLineId);

  return (
    <div className="billing-panel billing-panel--stock">
      <div className="billing-panel__head d-flex justify-content-between align-items-center">
        <span className="stk-panel-head">
          <i className="fas fa-signal mr-1" aria-hidden />
          Live inventory
        </span>
        <span className={`stk-ws-badge ${wsConnected ? 'stk-ws-badge--on' : 'stk-ws-badge--off'}`}>
          <span className="stk-ws-badge__dot" aria-hidden />
          {wsConnected ? 'Synced' : 'Offline'}
        </span>
      </div>
      <div className="billing-panel__body py-2">
        <p className="stk-panel-hint mb-2 px-1">
          Other counters see <strong>reserved</strong> qty instantly. Stock deducts when the bill
          completes.
          {lastEvent && (
            <span className="d-block mt-1 stk-panel-hint__event">
              {lastEvent.replace(/_/g, ' ')}
            </span>
          )}
        </p>
        {selected?.batchId && (
          <div className="px-1 mb-2">
            <span className="stk-panel-section-label">Selected line</span>
            <BatchStockCard
              batchId={selected.batchId}
              label={`${selected.productName}${selected.batchNumber ? ` · ${selected.batchNumber}` : ''}`}
              qtyOnBill={selected.qty}
              fallback={{
                availableQty: selected.availableQty,
                pendingQty: selected.pendingQty,
              }}
            />
          </div>
        )}
        {batchesOnBill.length === 0 ? (
          <p className="stk-panel-empty mb-0 px-1">Scan or add items to see availability</p>
        ) : (
          <div className="billing-panel__scroll billing-stock-list stk-panel-list">
            {batchesOnBill.map(([batchId, { item, qty }]) => (
              <BatchStockCard
                key={batchId}
                batchId={batchId}
                label={`${item.productName}${item.batchNumber ? ` · ${item.batchNumber}` : ''}`}
                qtyOnBill={qty}
                fallback={{
                  availableQty: item.availableQty,
                  pendingQty: item.pendingQty,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

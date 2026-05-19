'use client';

import { useEffect, useState } from 'react';
import { useLiveBatchStock } from '@/hooks/useLiveBatchStock';
import type { BatchShortageAlert } from '@/redux/slices/stockSlice';
import { calcLineShortage } from '@/utils/lineStock';
import { StockMetricsInline } from './StockMetrics';
import { BatchStockHoldModal } from './BatchStockHoldModal';

interface LineStockIndicatorsProps {
  batchId?: string;
  batchNumber?: string | null;
  productName?: string;
  lineQty: number;
  availableQty?: number;
  pendingQty?: number;
  stockQty?: number;
  /** Open details modal after failed qty (shortage). */
  forceDetails?: boolean;
  /** When API rejects a higher qty, show shortfall for what user tried. */
  shortageOverride?: number;
  attemptedQty?: number;
  /** Cross-counter WS alert for this batch. */
  batchShortageAlert?: BatchShortageAlert | null;
}

/**
 * Compact Avail / Rsv chips + red shortage badge → modal with counter-wise holds.
 */
export function LineStockIndicators({
  batchId,
  batchNumber,
  productName,
  lineQty,
  availableQty,
  pendingQty,
  stockQty,
  forceDetails,
  shortageOverride,
  attemptedQty,
  batchShortageAlert,
}: LineStockIndicatorsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const live = useLiveBatchStock(batchId, { availableQty, pendingQty, stockQty });

  const stockInputs = {
    qty: lineQty,
    availableQty: live.availableQty ?? availableQty,
    stockQty: live.stockQty ?? stockQty,
    pendingQty: live.pendingQty ?? pendingQty,
  };
  const computedShort = calcLineShortage(stockInputs);
  const wsShort =
    batchShortageAlert && batchShortageAlert.shortageQty > 0.001
      ? batchShortageAlert.shortageQty
      : 0;
  const shortage =
    shortageOverride != null && shortageOverride > 0
      ? shortageOverride
      : wsShort > 0
        ? wsShort
        : computedShort;
  const hasShort = shortage > 0.001;
  const triedQty = attemptedQty ?? batchShortageAlert?.attemptedQty;
  const sellable =
    live.stockQty != null && live.pendingQty != null
      ? live.stockQty - live.pendingQty + lineQty
      : availableQty;

  useEffect(() => {
    if (forceDetails && hasShort && batchId) {
      setModalOpen(true);
    }
  }, [forceDetails, hasShort, batchId]);

  return (
    <>
      <div className="line-stock-indicators">
        <StockMetricsInline
          batchId={batchId}
          available={sellable}
          reserved={live.pendingQty ?? pendingQty}
          short={null}
          live={live.isLive}
          variant="light"
        />
        {hasShort && batchId && (
          <button
            type="button"
            className="line-stock-short-btn"
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
            title={
              batchShortageAlert?.counterName
                ? `Shortage from ${batchShortageAlert.counterName} — view details`
                : 'View shortage and counter reservations'
            }
            aria-label={`Short ${shortage} units — view details`}
          >
            <i className="fas fa-triangle-exclamation" aria-hidden />
            SHORT {shortage}
          </button>
        )}
      </div>

      {batchId && (
        <BatchStockHoldModal
          open={modalOpen}
          batchId={batchId}
          batchNumber={batchNumber}
          productName={productName}
          lineQty={lineQty}
          shortageQty={hasShort ? shortage : undefined}
          attemptedQty={triedQty}
          alertCounterName={batchShortageAlert?.counterName}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

/** For table row styling without duplicating logic. */
export function lineItemHasShortage(
  item: {
    id?: string;
    qty: number;
    availableQty?: number;
    stockQty?: number;
    pendingQty?: number;
  },
  shortageHints?: Record<string, { short: number }>,
  batchAlert?: BatchShortageAlert | null,
): boolean {
  if (batchAlert && batchAlert.shortageQty > 0.001) return true;
  if (item.id && shortageHints?.[item.id]?.short != null && shortageHints[item.id].short > 0) {
    return true;
  }
  return calcLineShortage(item) > 0.001;
}

'use client';

import { useEffect, useState } from 'react';
import { useLiveBatchStock } from '@/hooks/useLiveBatchStock';
import type { BatchShortageAlert } from '@/redux/slices/stockSlice';
import {
  batchHasShortageForRow,
  batchShortageAppliesToLine,
  calcLineShortage,
  calcPoolAvailable,
} from '@/utils/lineStock';
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
  /** Units reserved on this bill for this line (not whole-batch pending). */
  reservedQty?: number;
  /** Server-reported shortage for this line (after Done / API sync). */
  shortageQty?: number;
  /** Open details modal after failed qty (shortage). */
  forceDetails?: boolean;
  /** When API rejects a higher qty, show shortfall for what user tried. */
  shortageOverride?: number;
  attemptedQty?: number;
  /** Cross-counter WS alert for this batch. */
  batchShortageAlert?: BatchShortageAlert | null;
  /** Hide WS batch alert when this line/batch is not on the active bill. */
  billId?: string | null;
  lineId?: string;
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
  reservedQty,
  shortageQty,
  forceDetails,
  shortageOverride,
  attemptedQty,
  batchShortageAlert,
  billId,
  lineId,
}: LineStockIndicatorsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const live = useLiveBatchStock(batchId, { availableQty, pendingQty, stockQty });

  const stockInputs = {
    qty: lineQty,
    availableQty: live.availableQty ?? availableQty,
    stockQty: live.stockQty ?? stockQty,
    pendingQty: live.pendingQty ?? pendingQty,
    reservedQty,
    shortageQty,
  };
  const computedShort = calcLineShortage(stockInputs);
  const batchAlertApplies = batchShortageAppliesToLine(batchShortageAlert, {
    batchId,
    billId,
    lineId,
  });
  const isForeignAlert = Boolean(
    batchAlertApplies &&
      batchShortageAlert?.billId &&
      billId &&
      batchShortageAlert.billId !== billId,
  );
  const wsShort = batchAlertApplies ? batchShortageAlert!.shortageQty : 0;
  const shortage =
    shortageOverride != null && shortageOverride > 0
      ? shortageOverride
      : isForeignAlert
        ? wsShort
        : wsShort > 0
          ? wsShort
          : computedShort;
  const hasShort = shortage > 0.001;
  const hasOwnShort = !isForeignAlert && (computedShort > 0.001 || (shortageQty != null && shortageQty > 0.001));
  const triedQty = attemptedQty ?? (batchAlertApplies ? batchShortageAlert?.attemptedQty : undefined);
  const poolAvail = calcPoolAvailable(stockInputs);
  const lineReserved = reservedQty ?? 0;

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
          available={poolAvail}
          reserved={lineReserved > 0.001 ? lineReserved : null}
          short={null}
          live={live.isLive}
          variant="light"
        />
        {hasShort && batchId && (
          <button
            type="button"
            className={[
              'line-stock-short-btn',
              isForeignAlert ? 'line-stock-short-btn--foreign' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
            title={
              isForeignAlert && batchShortageAlert?.counterName
                ? `${batchShortageAlert.counterName} is short ${shortage} on this batch`
                : hasOwnShort
                  ? `This line is short ${shortage} units`
                  : 'View batch reservations'
            }
            aria-label={
              isForeignAlert
                ? `Other counter short ${shortage}`
                : `Short ${shortage} units`
            }
          >
            <i className="fas fa-triangle-exclamation" aria-hidden />
            {isForeignAlert && batchShortageAlert?.counterName ? (
              <>
                <span className="line-stock-short-btn__who">{batchShortageAlert.counterName}</span>
                SHORT {shortage}
              </>
            ) : (
              <>SHORT {shortage}</>
            )}
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
          alertCounterName={batchAlertApplies ? batchShortageAlert?.counterName : undefined}
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
    reservedQty?: number;
    shortageQty?: number;
  },
  batchAlert?: BatchShortageAlert | null,
  scope?: { billId?: string | null; lineId?: string; batchId?: string },
  allAlerts?: Record<string, BatchShortageAlert>,
): boolean {
  const pool = calcPoolAvailable(item);
  if (pool != null && pool > 0.001) {
    return false;
  }
  if (item.shortageQty != null && item.shortageQty > 0.001) {
    return true;
  }
  if (
    batchShortageAppliesToLine(batchAlert, {
      batchId: scope?.batchId,
      billId: scope?.billId,
      lineId: scope?.lineId,
    })
  ) {
    return true;
  }
  if (allAlerts && scope && batchHasShortageForRow(allAlerts, scope)) {
    return true;
  }
  return calcLineShortage(item) > 0.001;
}

/** Own-line shortage (not another counter's WS alert on this batch). */
export function lineItemHasOwnShortage(item: {
  qty: number;
  reservedQty?: number;
  shortageQty?: number;
}): boolean {
  if (item.shortageQty != null && item.shortageQty > 0.001) return true;
  return calcLineShortage(item) > 0.001;
}

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { StockPendingUpdatedPayload } from '@billing/shared';
import { shortageAlertKey } from '@/utils/batchShortageAlerts';

type StockMap = Record<string, StockPendingUpdatedPayload>;

/** Cross-counter shortage signal (from WebSocket). Keyed by batchId. */
export interface BatchShortageAlert {
  batchId: string;
  productId: string;
  shortageQty: number;
  attemptedQty: number;
  billId?: string;
  lineId?: string;
  counterId?: string;
  counterName?: string;
  updatedAt: string;
}

interface StockState {
  batches: StockMap;
  batchShortageAlerts: Record<string, BatchShortageAlert>;
  lastUpdated: string | null;
}

const initialState: StockState = {
  batches: {},
  batchShortageAlerts: {},
  lastUpdated: null,
};

const stockSlice = createSlice({
  name: 'stock',
  initialState,
  reducers: {
    updateBatchStock(state, action: PayloadAction<StockPendingUpdatedPayload>) {
      const p = action.payload;
      state.batches[p.batchId] = p;
      state.lastUpdated = new Date().toISOString();
      const pool =
        p.availableQty != null
          ? p.availableQty
          : p.stockQty != null && p.pendingQty != null
            ? Math.max(0, p.stockQty - p.pendingQty)
            : null;
      if (pool != null && pool > 0.001) {
        for (const [key, alert] of Object.entries(state.batchShortageAlerts)) {
          if (alert.batchId === p.batchId) delete state.batchShortageAlerts[key];
        }
        return;
      }
      const key = shortageAlertKey({
        batchId: p.batchId,
        billId: p.billId,
        lineId: p.lineId,
      });
      if (p.shortageQty != null && p.shortageQty > 0.001) {
        state.batchShortageAlerts[key] = {
          batchId: p.batchId,
          productId: p.productId,
          shortageQty: p.shortageQty,
          attemptedQty: p.attemptedQty ?? p.shortageQty,
          billId: p.billId,
          lineId: p.lineId,
          counterId: p.counterId,
          counterName: p.counterName,
          updatedAt: p.updatedAt ?? new Date().toISOString(),
        };
      } else if (p.billId && p.lineId) {
        // Only clear a specific line shortage — pool refresh must not wipe other counters' alerts.
        delete state.batchShortageAlerts[key];
      }
    },
    clearBatchShortageAlert(state, action: PayloadAction<string>) {
      delete state.batchShortageAlerts[action.payload];
    },
    clearShortageAlertForLine(
      state,
      action: PayloadAction<{ batchId: string; billId: string; lineId: string }>,
    ) {
      const key = shortageAlertKey(action.payload);
      delete state.batchShortageAlerts[key];
    },
    clearShortageAlertsForBill(state, action: PayloadAction<string | null | undefined>) {
      const billId = action.payload;
      if (!billId) return;
      for (const [key, alert] of Object.entries(state.batchShortageAlerts)) {
        if (alert.billId === billId) delete state.batchShortageAlerts[key];
      }
    },
    clearShortageAlertsForBatch(state, action: PayloadAction<string>) {
      const batchId = action.payload;
      for (const [key, alert] of Object.entries(state.batchShortageAlerts)) {
        if (alert.batchId === batchId) delete state.batchShortageAlerts[key];
      }
    },
    setBatchStocks(state, action: PayloadAction<StockPendingUpdatedPayload[]>) {
      for (const batch of action.payload) {
        state.batches[batch.batchId] = batch;
      }
      state.lastUpdated = new Date().toISOString();
    },
  },
});

export const {
  updateBatchStock,
  setBatchStocks,
  clearBatchShortageAlert,
  clearShortageAlertForLine,
  clearShortageAlertsForBill,
  clearShortageAlertsForBatch,
} = stockSlice.actions;
export default stockSlice.reducer;

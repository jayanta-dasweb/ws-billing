import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { StockPendingUpdatedPayload } from '@billing/shared';

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
      if (p.shortageQty != null && p.shortageQty > 0.001) {
        state.batchShortageAlerts[p.batchId] = {
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
      } else {
        delete state.batchShortageAlerts[p.batchId];
      }
    },
    clearBatchShortageAlert(state, action: PayloadAction<string>) {
      delete state.batchShortageAlerts[action.payload];
    },
    setBatchStocks(state, action: PayloadAction<StockPendingUpdatedPayload[]>) {
      for (const batch of action.payload) {
        state.batches[batch.batchId] = batch;
      }
      state.lastUpdated = new Date().toISOString();
    },
  },
});

export const { updateBatchStock, setBatchStocks, clearBatchShortageAlert } = stockSlice.actions;
export default stockSlice.reducer;

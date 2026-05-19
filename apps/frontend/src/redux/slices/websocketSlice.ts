import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface StockAlert {
  message: string;
  billId: string;
  batchId: string;
}

interface WebsocketState {
  connected: boolean;
  reconnecting: boolean;
  lastEvent: string | null;
  stockAlert: StockAlert | null;
  recoveredAt: string | null;
}

const initialState: WebsocketState = {
  connected: false,
  reconnecting: false,
  lastEvent: null,
  stockAlert: null,
  recoveredAt: null,
};

const websocketSlice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    setConnected(state, action: PayloadAction<boolean>) {
      const wasDisconnected = !state.connected && action.payload;
      state.connected = action.payload;
      if (action.payload) {
        state.reconnecting = false;
        if (wasDisconnected) {
          state.recoveredAt = new Date().toISOString();
        }
      } else {
        state.recoveredAt = null;
      }
    },
    clearRecoveredBanner(state) {
      state.recoveredAt = null;
    },
    setReconnecting(state, action: PayloadAction<boolean>) {
      state.reconnecting = action.payload;
    },
    setLastEvent(state, action: PayloadAction<string>) {
      state.lastEvent = action.payload;
    },
    setStockAlert(state, action: PayloadAction<StockAlert | null>) {
      state.stockAlert = action.payload;
    },
  },
});

export const { setConnected, setReconnecting, setLastEvent, setStockAlert, clearRecoveredBanner } =
  websocketSlice.actions;
export default websocketSlice.reducer;

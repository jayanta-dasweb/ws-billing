import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  /** Sidebar / menu navigation in progress */
  routeLoading: boolean;
  routeMessage?: string;
  /** Full-screen overlay (login, logout, save, redirect) */
  overlay: { active: boolean; message?: string };
  /** In-flight RTK Query requests */
  apiPending: number;
}

const initialState: UiState = {
  routeLoading: false,
  overlay: { active: false },
  apiPending: 0,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    startRouteLoading(state, action: PayloadAction<string | undefined>) {
      state.routeLoading = true;
      state.routeMessage = action.payload;
    },
    stopRouteLoading(state) {
      state.routeLoading = false;
      state.routeMessage = undefined;
    },
    setOverlay(
      state,
      action: PayloadAction<{ active: boolean; message?: string }>,
    ) {
      state.overlay = action.payload;
    },
    apiPendingIncrement(state) {
      state.apiPending += 1;
    },
    apiPendingDecrement(state) {
      state.apiPending = Math.max(0, state.apiPending - 1);
    },
  },
});

export const {
  startRouteLoading,
  stopRouteLoading,
  setOverlay,
  apiPendingIncrement,
  apiPendingDecrement,
} = uiSlice.actions;

export default uiSlice.reducer;

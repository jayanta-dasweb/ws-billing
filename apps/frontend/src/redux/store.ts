import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from '@/services/api/baseApi';
import '@/services/api/authApi';
import '@/services/api/healthApi';
import '@/services/api/billingApi';
import '@/services/api/mastersApi';
import '@/services/api/rbacApi';
import '@/services/api/reportsApi';
import '@/services/api/inventoryApi';
import '@/services/api/auditApi';
import '@/services/api/returnsApi';
import '@/services/api/securityApi';
import '@/services/api/invoiceApi';
import '@/services/api/auditApi';
import '@/services/api/customerAuthApi';
import authReducer from '@/redux/slices/authSlice';
import uiReducer from '@/redux/slices/uiSlice';
import stockReducer from '@/redux/slices/stockSlice';
import websocketReducer from '@/redux/slices/websocketSlice';
import { rtkLoadingMiddleware } from '@/redux/rtkLoadingMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    stock: stockReducer,
    websocket: websocketReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(rtkLoadingMiddleware, baseApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

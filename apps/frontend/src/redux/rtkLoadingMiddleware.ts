import type { Middleware } from '@reduxjs/toolkit';
import { apiPendingDecrement, apiPendingIncrement } from './slices/uiSlice';

const SILENT_ENDPOINTS = new Set(['listOpenBills', 'getInvoiceByBill', 'lookupInvoices']);

function getEndpointName(action: unknown): string | undefined {
  return (action as { meta?: { arg?: { endpointName?: string } } })?.meta?.arg?.endpointName;
}

/** Tracks RTK Query pending/fulfilled/rejected for the global top loader. */
export const rtkLoadingMiddleware: Middleware = (api) => (next) => (action) => {
  const type = (action as { type?: string }).type ?? '';
  const isApi = type.startsWith('api/');
  const endpoint = isApi ? getEndpointName(action) : undefined;
  const silent = endpoint && SILENT_ENDPOINTS.has(endpoint);

  if (isApi && type.endsWith('/pending') && !silent) {
    api.dispatch(apiPendingIncrement());
  }

  const result = next(action);

  if (isApi && (type.endsWith('/fulfilled') || type.endsWith('/rejected')) && !silent) {
    api.dispatch(apiPendingDecrement());
  }

  return result;
};

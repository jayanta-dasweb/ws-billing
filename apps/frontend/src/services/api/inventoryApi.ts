import type { CreateStockAdjustmentDto, StockAdjustmentReasonDto } from '@billing/shared';
import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';

export interface StockAdjustmentRow {
  id: string;
  adjNo: string | null;
  batchId: string;
  batchNumber: string;
  productName: string;
  qtyDelta: number;
  reason: StockAdjustmentReasonDto;
  notes: string | null;
  userName: string;
  createdAt: string;
}

export interface StockMovementRow {
  id: string;
  movementType: string;
  qtyDelta: number;
  qtyBefore: number;
  qtyAfter: number;
  referenceType: string;
  referenceId: string;
  notes: string | null;
  createdAt: string;
}

export const inventoryApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    listAdjustments: builder.query<
      { data: StockAdjustmentRow[]; total: number },
      { batchId?: string }
    >({
      query: (params) => ({ url: '/inventory/adjustments', params }),
      transformResponse: (r) =>
        unwrapApi<{ data: StockAdjustmentRow[]; total: number; page: number; limit: number }>(r),
    }),
    createAdjustment: builder.mutation<{ adjNo: string }, CreateStockAdjustmentDto>({
      query: (body) => ({ url: '/inventory/adjustments', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<{ adjNo: string; batchId: string; qtyDelta: number }>(r),
    }),
    listMovements: builder.query<StockMovementRow[], string>({
      query: (batchId) => `/inventory/batches/${batchId}/movements`,
      transformResponse: (r) => unwrapApi<StockMovementRow[]>(r),
    }),
  }),
});

export const {
  useListAdjustmentsQuery,
  useCreateAdjustmentMutation,
  useLazyListMovementsQuery,
} = inventoryApi;

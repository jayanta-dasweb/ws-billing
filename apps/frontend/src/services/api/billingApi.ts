import type {
  AddProductLineDto,
  BatchStockHoldSummaryDto,
  BillDto,
  BillSummaryDto,
  CatalogProductDto,
  CleanupEmptyDraftsResult,
  CompleteBillDto,
  CreateBillDto,
  OnlineCounterDto,
  TransferBillDto,
  TransferBillResult,
  ScanLineDto,
  SetBillCustomerDto,
  SetBillDiscountDto,
  SetBillRoundOffDto,
  UpdateLineDto,
} from '@billing/shared';
import { PaymentMode } from '@billing/shared';
import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';

export const billingApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    createBill: builder.mutation<BillDto, CreateBillDto | void>({
      query: (body) => ({
        url: '/billing/bills',
        method: 'POST',
        body: body ?? {},
      }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: ['Bill'],
    }),
    listOpenBills: builder.query<BillSummaryDto[], string | void>({
      query: (counterId) => ({
        url: '/billing/bills/open',
        params: counterId ? { counterId } : undefined,
      }),
      transformResponse: (r) => unwrapApi<BillSummaryDto[]>(r),
      providesTags: ['Bill'],
    }),
    getBill: builder.query<BillDto, string>({
      query: (id) => `/billing/bills/${id}`,
      transformResponse: (r) => unwrapApi<BillDto>(r),
      providesTags: (_r, _e, id) => [{ type: 'Bill', id }],
    }),
    searchCatalog: builder.query<CatalogProductDto[], string>({
      query: (q) => ({
        url: '/billing/catalog/search',
        params: { q, limit: 20 },
      }),
      transformResponse: (r) => unwrapApi<CatalogProductDto[]>(r),
    }),
    getBatchStockHolds: builder.query<BatchStockHoldSummaryDto, string>({
      query: (batchId) => `/billing/batches/${batchId}/holds`,
      transformResponse: (r) => unwrapApi<BatchStockHoldSummaryDto>(r),
      providesTags: (_r, _e, batchId) => [{ type: 'Batch', id: batchId }],
    }),
    addProductLine: builder.mutation<BillDto, { billId: string; body: AddProductLineDto }>({
      query: ({ billId, body }) => ({
        url: `/billing/bills/${billId}/lines`,
        method: 'POST',
        body,
      }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: ['Bill'],
    }),
    scanBarcode: builder.mutation<BillDto, { billId: string; body: ScanLineDto }>({
      query: ({ billId, body }) => ({
        url: `/billing/bills/${billId}/scan`,
        method: 'POST',
        body,
      }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: ['Bill'],
    }),
    publishShortageAlert: builder.mutation<
      { ok: boolean },
      { billId: string; lineId: string; attemptedQty: number }
    >({
      query: ({ billId, lineId, attemptedQty }) => ({
        url: `/billing/bills/${billId}/lines/${lineId}/shortage-alert`,
        method: 'POST',
        body: { attemptedQty },
      }),
      transformResponse: (r) => unwrapApi<{ ok: boolean }>(r),
    }),
    updateLine: builder.mutation<BillDto, { billId: string; lineId: string; body: UpdateLineDto }>({
      query: ({ billId, lineId, body }) => ({
        url: `/billing/bills/${billId}/lines/${lineId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: (result, _e, { billId }) => {
        const batchIds =
          result?.items?.map((i) => i.batchId).filter((id): id is string => Boolean(id)) ?? [];
        return [
          { type: 'Bill', id: billId },
          'Bill',
          ...batchIds.map((id) => ({ type: 'Batch' as const, id })),
        ];
      },
    }),
    removeLine: builder.mutation<BillDto, { billId: string; lineId: string }>({
      query: ({ billId, lineId }) => ({
        url: `/billing/bills/${billId}/lines/${lineId}`,
        method: 'DELETE',
      }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: (_r, _e, { billId }) => [{ type: 'Bill', id: billId }, 'Bill'],
    }),
    setBillDiscount: builder.mutation<BillDto, { billId: string; body: SetBillDiscountDto }>({
      query: ({ billId, body }) => ({
        url: `/billing/bills/${billId}/discount`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: (_r, _e, { billId }) => [{ type: 'Bill', id: billId }, 'Bill'],
    }),
    setBillRoundOff: builder.mutation<BillDto, { billId: string; body: SetBillRoundOffDto }>({
      query: ({ billId, body }) => ({
        url: `/billing/bills/${billId}/round-off`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: (_r, _e, { billId }) => [{ type: 'Bill', id: billId }, 'Bill'],
    }),
    setBillCustomer: builder.mutation<BillDto, { billId: string; body: SetBillCustomerDto }>({
      query: ({ billId, body }) => ({
        url: `/billing/bills/${billId}/customer`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: (_r, _e, { billId }) => [{ type: 'Bill', id: billId }, 'Bill'],
    }),
    holdBill: builder.mutation<BillDto, string>({
      query: (billId) => ({ url: `/billing/bills/${billId}/hold`, method: 'POST' }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: ['Bill'],
    }),
    resumeBill: builder.mutation<BillDto, string>({
      query: (billId) => ({ url: `/billing/bills/${billId}/resume`, method: 'POST' }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: ['Bill'],
    }),
    billHeartbeat: builder.mutation<{ ok: boolean; billId: string; expiresInSec: number }, string>({
      query: (billId) => ({
        url: `/billing/bills/${billId}/heartbeat`,
        method: 'POST',
      }),
      transformResponse: (r) => unwrapApi<{ ok: boolean; billId: string; expiresInSec: number }>(r),
    }),
    completeBill: builder.mutation<
      BillDto & { queue?: { waiting: number; active: number } },
      { billId: string; body: CompleteBillDto; idempotencyKey?: string }
    >({
      query: ({ billId, body, idempotencyKey }) => ({
        url: `/billing/bills/${billId}/complete`,
        method: 'POST',
        body,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      }),
      transformResponse: (r) =>
        unwrapApi<BillDto & { queue?: { waiting: number; active: number } }>(r),
      invalidatesTags: ['Bill'],
    }),
    cancelBill: builder.mutation<BillDto, string>({
      query: (billId) => ({ url: `/billing/bills/${billId}/cancel`, method: 'POST' }),
      transformResponse: (r) => unwrapApi<BillDto>(r),
      invalidatesTags: ['Bill'],
    }),
    listOnlineCounters: builder.query<OnlineCounterDto[], string | void>({
      query: (counterId) => ({
        url: '/billing/counters/online',
        params: counterId ? { counterId } : undefined,
      }),
      transformResponse: (r) => unwrapApi<OnlineCounterDto[]>(r),
    }),
    transferBill: builder.mutation<
      TransferBillResult,
      { billId: string; body: TransferBillDto }
    >({
      query: ({ billId, body }) => ({
        url: `/billing/bills/${billId}/transfer`,
        method: 'POST',
        body,
      }),
      transformResponse: (r) => unwrapApi<TransferBillResult>(r),
      invalidatesTags: ['Bill'],
    }),
    cleanupEmptyDrafts: builder.mutation<
      CleanupEmptyDraftsResult,
      { counterId?: string; keepBillId?: string }
    >({
      query: ({ counterId, keepBillId }) => ({
        url: '/billing/bills/cleanup-empty',
        method: 'POST',
        params: {
          ...(counterId ? { counterId } : {}),
          ...(keepBillId ? { keepBillId } : {}),
        },
      }),
      transformResponse: (r) => unwrapApi<CleanupEmptyDraftsResult>(r),
      invalidatesTags: ['Bill'],
    }),
  }),
});

export const {
  useCreateBillMutation,
  useListOpenBillsQuery,
  useGetBillQuery,
  useLazySearchCatalogQuery,
  useGetBatchStockHoldsQuery,
  useAddProductLineMutation,
  useScanBarcodeMutation,
  usePublishShortageAlertMutation,
  useUpdateLineMutation,
  useRemoveLineMutation,
  useSetBillDiscountMutation,
  useSetBillRoundOffMutation,
  useSetBillCustomerMutation,
  useHoldBillMutation,
  useResumeBillMutation,
  useBillHeartbeatMutation,
  useCompleteBillMutation,
  useCancelBillMutation,
  useCleanupEmptyDraftsMutation,
  useListOnlineCountersQuery,
  useTransferBillMutation,
} = billingApi;

export { PaymentMode };

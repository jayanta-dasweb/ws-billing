import type {
  CreateReturnDto,
  ReturnableBillDto,
  SalesReturnDto,
} from '@billing/shared';
import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';

export const returnsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    lookupReturnBill: builder.query<
      ReturnableBillDto,
      { invoiceNo?: string; billId?: string }
    >({
      query: (params) => ({ url: '/returns/lookup', params }),
      transformResponse: (r) => unwrapApi<ReturnableBillDto>(r),
    }),
    listReturns: builder.query<SalesReturnDto[], void>({
      query: () => '/returns',
      transformResponse: (r) => unwrapApi<SalesReturnDto[]>(r),
    }),
    createReturn: builder.mutation<SalesReturnDto, CreateReturnDto>({
      query: (body) => ({ url: '/returns', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<SalesReturnDto>(r),
    }),
    completeReturn: builder.mutation<SalesReturnDto, { id: string; refundNote?: string }>({
      query: ({ id, ...body }) => ({
        url: `/returns/${id}/complete`,
        method: 'POST',
        body,
      }),
      transformResponse: (r) => unwrapApi<SalesReturnDto>(r),
    }),
  }),
});

export const {
  useLazyLookupReturnBillQuery,
  useListReturnsQuery,
  useCreateReturnMutation,
  useCompleteReturnMutation,
} = returnsApi;

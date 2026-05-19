import type { InvoiceDetailDto, InvoiceLookupDto } from '@billing/shared';
import { getApiBaseUrl } from '@/lib/apiBase';
import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';

export const invoiceApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getInvoiceByBill: builder.query<InvoiceDetailDto, string>({
      query: (billId) => `/invoices/bill/${billId}`,
      transformResponse: (r) => unwrapApi<InvoiceDetailDto>(r),
    }),
    getInvoiceByNo: builder.query<InvoiceDetailDto, string>({
      query: (invoiceNo) => ({
        url: '/invoices/search',
        params: { invoiceNo },
      }),
      transformResponse: (r) => unwrapApi<InvoiceDetailDto>(r),
    }),
    lookupInvoices: builder.query<InvoiceLookupDto[], { q: string; counterId?: string }>({
      query: ({ q, counterId }) => ({
        url: '/invoices/lookup',
        params: { q, counterId },
      }),
      transformResponse: (r) => unwrapApi<InvoiceLookupDto[]>(r),
    }),
  }),
});

export const {
  useGetInvoiceByBillQuery,
  useLazyGetInvoiceByBillQuery,
  useLazyGetInvoiceByNoQuery,
  useLazyLookupInvoicesQuery,
} = invoiceApi;

export function invoicePdfUrl(billId: string): string {
  return `${getApiBaseUrl()}/invoices/bill/${billId}/pdf`;
}

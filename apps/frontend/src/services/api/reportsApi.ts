import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';

export interface DaySummaryDto {
  date: string;
  sales: { billCount: number; grossTotal: number };
  returns: { count: number; refundTotal: number };
  netSales: number;
  openBills: number;
  adjustmentsToday: number;
  byCounter: {
    counterId: string | null;
    counterName: string;
    billCount: number;
    grossTotal: number;
  }[];
}

export const reportsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getDaySummary: builder.query<DaySummaryDto, void>({
      query: () => '/reports/day-summary',
      transformResponse: (r) => unwrapApi<DaySummaryDto>(r),
    }),
  }),
});

export const { useGetDaySummaryQuery } = reportsApi;

import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';

export const healthApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getHealth: builder.query<{ status: string; services: Record<string, unknown> }, void>({
      query: () => '/health',
      transformResponse: (r) =>
        unwrapApi<{ status: string; services: Record<string, unknown> }>(r),
      providesTags: ['Health'],
    }),
  }),
});

export const { useGetHealthQuery } = healthApi;

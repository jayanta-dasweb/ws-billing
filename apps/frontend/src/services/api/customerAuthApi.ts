import type {
  CustomerBillSummaryDto,
  CustomerDashboardDto,
  InvoiceDetailDto,
} from '@billing/shared';
import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';
import { setCustomerCredentials, logout } from '@/redux/slices/authSlice';
import type { CustomerProfile } from '@/redux/slices/authSlice';

export type CustomerBillRow = CustomerBillSummaryDto;

interface CustomerAuthResponse {
  accessToken: string;
  customer: CustomerProfile & { needsPassword?: boolean };
}

export const customerAuthApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    customerLookup: builder.mutation<{ name: string; needsPassword: boolean }, { mobile: string }>({
      query: (body) => ({ url: '/customer-auth/lookup', method: 'POST', body }),
      transformResponse: (r: unknown) =>
        unwrapApi<{ name: string; needsPassword: boolean }>(r),
    }),
    customerSetPassword: builder.mutation<
      CustomerAuthResponse,
      { mobile: string; password: string }
    >({
      query: (body) => ({ url: '/customer-auth/set-password', method: 'POST', body }),
      transformResponse: (r: unknown) => unwrapApi<CustomerAuthResponse>(r),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            setCustomerCredentials({
              accessToken: data.accessToken,
              customer: {
                id: data.customer.id,
                name: data.customer.name,
                mobile: data.customer.mobile,
              },
            }),
          );
        } catch {
          /* handled in UI */
        }
      },
    }),
    customerForgotPassword: builder.mutation<
      { message: string; expiresInSeconds: number; devOtp?: string },
      { mobile: string }
    >({
      query: (body) => ({ url: '/customer-auth/forgot-password', method: 'POST', body }),
      transformResponse: (r: unknown) =>
        unwrapApi<{ message: string; expiresInSeconds: number; devOtp?: string }>(r),
    }),
    customerResetPassword: builder.mutation<
      CustomerAuthResponse,
      { mobile: string; otp: string; password: string }
    >({
      query: (body) => ({ url: '/customer-auth/reset-password', method: 'POST', body }),
      transformResponse: (r: unknown) => unwrapApi<CustomerAuthResponse>(r),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            setCustomerCredentials({
              accessToken: data.accessToken,
              customer: {
                id: data.customer.id,
                name: data.customer.name,
                mobile: data.customer.mobile,
              },
            }),
          );
        } catch {
          /* handled in UI */
        }
      },
    }),
    customerLogin: builder.mutation<CustomerAuthResponse, { mobile: string; password: string }>({
      query: (body) => ({ url: '/customer-auth/login', method: 'POST', body }),
      transformResponse: (r: unknown) => unwrapApi<CustomerAuthResponse>(r),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            setCustomerCredentials({
              accessToken: data.accessToken,
              customer: {
                id: data.customer.id,
                name: data.customer.name,
                mobile: data.customer.mobile,
              },
            }),
          );
        } catch {
          /* handled in UI */
        }
      },
    }),
    customerLogout: builder.mutation<{ message: string }, void>({
      query: () => ({ url: '/customer-auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(logout());
          dispatch(baseApi.util.resetApiState());
        }
      },
    }),
    getCustomerMe: builder.query<CustomerProfile, void>({
      query: () => '/customer-auth/me',
      transformResponse: (r: unknown) => unwrapApi<CustomerProfile>(r),
      providesTags: ['CustomerAuth'],
    }),
    getCustomerDashboard: builder.query<CustomerDashboardDto, void>({
      query: () => '/customer-auth/dashboard',
      transformResponse: (r: unknown) => unwrapApi<CustomerDashboardDto>(r),
      providesTags: ['CustomerAuth'],
    }),
    getCustomerBills: builder.query<CustomerBillRow[], void>({
      query: () => '/customer-auth/bills',
      transformResponse: (r: unknown) => unwrapApi<CustomerBillRow[]>(r),
      providesTags: ['CustomerAuth'],
    }),
    getCustomerBillDetail: builder.query<InvoiceDetailDto, string>({
      query: (billId) => `/customer-auth/bills/${billId}`,
      transformResponse: (r: unknown) => unwrapApi<InvoiceDetailDto>(r),
      providesTags: (_r, _e, billId) => [{ type: 'CustomerAuth', id: billId }],
    }),
  }),
});

export const {
  useCustomerLookupMutation,
  useCustomerSetPasswordMutation,
  useCustomerForgotPasswordMutation,
  useCustomerResetPasswordMutation,
  useCustomerLoginMutation,
  useCustomerLogoutMutation,
  useGetCustomerMeQuery,
  useGetCustomerDashboardQuery,
  useGetCustomerBillsQuery,
  useGetCustomerBillDetailQuery,
} = customerAuthApi;

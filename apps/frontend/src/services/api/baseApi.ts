import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/redux/store';
import {
  setAccessToken,
  setCredentials,
  setCustomerCredentials,
  setRefreshing,
  logout,
} from '@/redux/slices/authSlice';
import { getCsrfToken, getCustomerCsrfToken } from '@/utils/csrf';
import type { CustomerProfile } from '@/redux/slices/authSlice';
import { unwrapApi } from '@/utils/api';
import { getApiBaseUrl } from '@/lib/apiBase';
import { mapAuthUserDto, type AuthUserDto } from './authDto';

let refreshPromise: Promise<boolean> | null = null;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: 'include',
  prepareHeaders: (headers, { getState, type }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);

    if (type === 'mutation') {
      const state = getState() as RootState;
      const csrf =
        state.auth.principal === 'customer' ? getCustomerCsrfToken() : getCsrfToken();
      if (csrf) headers.set('X-CSRF-Token', csrf);
    }
    return headers;
  },
});

function getRequestUrl(args: string | FetchArgs): string {
  return typeof args === 'string' ? args : (args.url ?? '');
}

async function tryRefresh(
  api: Parameters<BaseQueryFn>[1],
  kind: 'staff' | 'customer',
): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    api.dispatch(setRefreshing(true));
    try {
      const isCustomer = kind === 'customer';
      const csrf = isCustomer ? getCustomerCsrfToken() : getCsrfToken();
      const path = isCustomer ? '/customer-auth/refresh' : '/auth/refresh';
      const res = await fetch(`${getApiBaseUrl()}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
      });
      if (!res.ok) return false;

      const body = await res.json();
      if (isCustomer) {
        const data = unwrapApi<{ accessToken: string; customer: CustomerProfile }>(body);
        api.dispatch(
          setCustomerCredentials({
            accessToken: data.accessToken,
            customer: data.customer,
          }),
        );
      } else {
        const data = unwrapApi<{ accessToken: string; user: AuthUserDto }>(body);
        api.dispatch(
          setCredentials({
            accessToken: data.accessToken,
            user: mapAuthUserDto(data.user),
          }),
        );
      }
      return true;
    } catch {
      return false;
    } finally {
      api.dispatch(setRefreshing(false));
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  const url = getRequestUrl(args);

  const state = api.getState() as RootState;
  const principal = state.auth.principal;
  const isCustomerUrl = url.includes('/customer-auth/');

  if (
    result.error?.status === 401 &&
    !url.includes('/auth/login') &&
    !url.includes('/auth/refresh') &&
    !url.includes('/customer-auth/login') &&
    !url.includes('/customer-auth/set-password') &&
    !url.includes('/customer-auth/lookup') &&
    !url.includes('/customer-auth/forgot-password') &&
    !url.includes('/customer-auth/reset-password') &&
    !url.includes('/customer-auth/refresh')
  ) {
    const kind =
      principal === 'customer' || isCustomerUrl ? 'customer' : 'staff';
    const refreshed = await tryRefresh(api, kind);
    if (refreshed) {
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Health',
    'Auth',
    'Bill',
    'Product',
    'Customer',
    'Company',
    'Counter',
    'Tax',
    'Batch',
    'User',
    'PaymentMode',
    'Security',
    'Rbac',
    'CustomerAuth',
    'Audit',
  ],
  endpoints: () => ({}),
});

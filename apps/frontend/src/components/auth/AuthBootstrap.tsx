'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { PageSpinner } from '@/components/loading/PageSpinner';
import { setBootstrapped, setCredentials, setCustomerCredentials } from '@/redux/slices/authSlice';
import type { RootState } from '@/redux/store';
import { getCsrfToken, getCustomerCsrfToken } from '@/utils/csrf';
import { unwrapApi } from '@/utils/api';
import { getApiBaseUrl } from '@/lib/apiBase';
import { mapAuthUserDto, type AuthUserDto } from '@/services/api/authApi';
import type { CustomerProfile } from '@/redux/slices/authSlice';

const BOOTSTRAP_TIMEOUT_MS = 8000;

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const isBootstrapped = useSelector((s: RootState) => s.auth.isBootstrapped);

  useEffect(() => {
    if (isBootstrapped) return;

    let cancelled = false;
    let done = false;

    const markDone = () => {
      if (cancelled || done) return;
      done = true;
      window.clearTimeout(safetyTimer);
      dispatch(setBootstrapped(true));
    };

    const safetyTimer = window.setTimeout(() => {
      markDone();
    }, BOOTSTRAP_TIMEOUT_MS);

    async function refreshSession(
      path: '/auth/refresh' | '/customer-auth/refresh',
      csrf: string | null,
    ) {
      const controller = new AbortController();
      const fetchTimer = window.setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS - 500);
      try {
        const res = await fetch(`${getApiBaseUrl()}${path}`, {
          method: 'POST',
          credentials: 'include',
          headers: csrf ? { 'X-CSRF-Token': csrf } : {},
          signal: controller.signal,
        });
        return res;
      } finally {
        window.clearTimeout(fetchTimer);
      }
    }

    async function restoreSession() {
      try {
        // Refresh token is HttpOnly — always call API with credentials (do not gate on document.cookie).
        const staffRes = await refreshSession('/auth/refresh', getCsrfToken());
        if (cancelled) return;
        if (staffRes.ok) {
          const data = unwrapApi<{ accessToken: string; user: AuthUserDto }>(await staffRes.json());
          dispatch(
            setCredentials({
              accessToken: data.accessToken,
              user: mapAuthUserDto(data.user),
            }),
          );
          return;
        }

        const customerRes = await refreshSession('/customer-auth/refresh', getCustomerCsrfToken());
        if (cancelled) return;
        if (customerRes.ok) {
          const data = unwrapApi<{ accessToken: string; customer: CustomerProfile }>(
            await customerRes.json(),
          );
          dispatch(
            setCustomerCredentials({
              accessToken: data.accessToken,
              customer: data.customer,
            }),
          );
        }
      } catch {
        /* expired session, backend down, timeout, or aborted */
      } finally {
        markDone();
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
    };
  }, [dispatch, isBootstrapped]);

  if (!isBootstrapped) {
    return <PageSpinner message="Restoring your session…" />;
  }

  return <>{children}</>;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { PageSpinner } from '@/components/loading/PageSpinner';
import { PortalLanding } from '@/components/auth/PortalLanding';
import type { RootState } from '@/redux/store';
import { startRouteLoading } from '@/redux/slices/uiSlice';
import { getHomeRouteForUser } from '@/utils/roles';

export function HomeRedirect() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated, isBootstrapped, user, principal } = useSelector(
    (s: RootState) => s.auth,
  );

  useEffect(() => {
    if (!isBootstrapped) return;
    if (!isAuthenticated) return;

    dispatch(startRouteLoading('Redirecting…'));
    if (principal === 'customer') {
      router.replace('/customer/dashboard');
      return;
    }
    if (!user) {
      router.replace('/login');
      return;
    }
    router.replace(getHomeRouteForUser(user));
  }, [isBootstrapped, isAuthenticated, user, principal, router, dispatch]);

  if (!isBootstrapped) {
    return <PageSpinner message="Loading…" />;
  }

  if (!isAuthenticated) {
    return <PortalLanding />;
  }

  return <PageSpinner message="Redirecting…" />;
}

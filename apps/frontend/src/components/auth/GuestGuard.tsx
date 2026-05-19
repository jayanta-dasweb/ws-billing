'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { PageSpinner } from '@/components/loading/PageSpinner';
import type { RootState } from '@/redux/store';
import { startRouteLoading } from '@/redux/slices/uiSlice';
import { getHomeRouteForUser } from '@/utils/roles';

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated, isBootstrapped, user } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (isBootstrapped && isAuthenticated && user) {
      dispatch(startRouteLoading('Redirecting…'));
      router.replace(getHomeRouteForUser(user));
    }
  }, [isBootstrapped, isAuthenticated, user, router, dispatch]);

  if (!isBootstrapped) {
    return <PageSpinner message="Loading…" />;
  }

  if (isAuthenticated) {
    return <PageSpinner message="Redirecting to your workspace…" />;
  }

  return <>{children}</>;
}

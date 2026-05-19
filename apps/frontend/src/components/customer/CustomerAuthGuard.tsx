'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';
import { PageSpinner } from '@/components/loading/PageSpinner';

export function CustomerAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isBootstrapped, principal } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (!isBootstrapped) return;
    if (!isAuthenticated || principal !== 'customer') {
      router.replace('/customer/login');
    }
  }, [isBootstrapped, isAuthenticated, principal, router]);

  if (!isBootstrapped) {
    return <PageSpinner message="Loading…" />;
  }

  if (!isAuthenticated || principal !== 'customer') {
    return <PageSpinner message="Redirecting…" />;
  }

  return <>{children}</>;
}

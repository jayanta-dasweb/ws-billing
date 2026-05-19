'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { UserRole } from '@billing/shared';
import { PageSpinner } from '@/components/loading/PageSpinner';
import type { RootState } from '@/redux/store';
import { startRouteLoading } from '@/redux/slices/uiSlice';
import { canAccessAdminArea } from '@/utils/permissions';
import { canAccessBilling, getEffectiveRole, getHomeRouteForUser } from '@/utils/roles';

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: UserRole[];
  requireCounter?: boolean;
  adminOnly?: boolean;
}

export function AuthGuard({
  children,
  roles,
  requireCounter,
  adminOnly,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { isAuthenticated, isBootstrapped, user } = useSelector((s: RootState) => s.auth);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!isBootstrapped) return;

    let target: string | null = null;

    if (!isAuthenticated || !user) {
      target = `/login?redirect=${encodeURIComponent(pathname)}`;
    } else if (adminOnly && !canAccessAdminArea(user)) {
      target = getHomeRouteForUser(user);
    } else if (
      (pathname.startsWith('/dashboard') ||
        pathname.startsWith('/masters') ||
        pathname.startsWith('/inventory')) &&
      !canAccessAdminArea(user)
    ) {
      target = '/billing';
    } else if (roles?.length && !roles.includes(getEffectiveRole(user))) {
      target = getHomeRouteForUser(user);
    }

    if (target) {
      setRedirecting(true);
      dispatch(startRouteLoading('Redirecting…'));
      router.replace(target);
    } else {
      setRedirecting(false);
    }
  }, [isBootstrapped, isAuthenticated, user, roles, adminOnly, router, pathname, dispatch]);

  if (!isBootstrapped) {
    return <PageSpinner message="Loading…" />;
  }

  if (!isAuthenticated || !user || redirecting) {
    return <PageSpinner message="Redirecting…" fullScreen={false} />;
  }

  if (adminOnly && !canAccessAdminArea(user)) {
    return <PageSpinner message="Redirecting…" fullScreen={false} />;
  }

  if (
    (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/masters') ||
      pathname.startsWith('/inventory')) &&
    !canAccessAdminArea(user)
  ) {
    return <PageSpinner message="Redirecting…" fullScreen={false} />;
  }

  if (roles?.length && !roles.includes(getEffectiveRole(user))) {
    return <PageSpinner message="Redirecting…" fullScreen={false} />;
  }

  if (requireCounter && !canAccessBilling(user)) {
    return (
      <div className="alert alert-warning m-4">
        <h5>Cannot bill from this location</h5>
        <p className="mb-0">
          No counter was matched for your account at this IP address, or another user is already
          signed in on this counter. Use the correct counter PC, or ask an administrator to assign
          you and configure IP rules.
        </p>
        <button
          type="button"
          className="btn btn-outline-danger btn-sm mt-3"
          onClick={() => {
            dispatch(startRouteLoading('Redirecting…'));
            router.replace('/login');
          }}
        >
          Back to login
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useLogoutMutation } from '@/services/api/authApi';
import type { RootState } from '@/redux/store';
import { hasNonCounterAccess } from '@/utils/permissions';
import { useAppLoading } from '@/hooks/useAppLoading';

export function BillingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useSelector((s: RootState) => s.auth.user);
  const isRefreshing = useSelector((s: RootState) => s.auth.isRefreshing);
  const wsConnected = useSelector((s: RootState) => s.websocket.connected);
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();
  const { showOverlay, hideOverlay, startNavigation } = useAppLoading();

  const showBack = user && hasNonCounterAccess(user);

  const handleLogout = async () => {
    showOverlay('Signing out…');
    try {
      await logout().unwrap();
    } catch {
      /* ignore */
    } finally {
      hideOverlay();
      startNavigation('Redirecting to login…');
      router.replace('/login');
    }
  };

  return (
    <div className="billing-fullscreen">
      <nav className="navbar navbar-dark bg-primary py-1">
        {showBack ? (
          <Link href="/dashboard" className="btn btn-link text-white p-0 mr-3" title="Back to home">
            <i className="fas fa-arrow-left" />
          </Link>
        ) : (
          <span className="text-white-50 px-2 mr-1">
            <i className="fas fa-cash-register" />
          </span>
        )}
        <span className="navbar-text text-white font-weight-bold mb-0">
          {user?.counterName ?? 'Billing Counter'}
        </span>
        <span className="ml-auto d-flex align-items-center">
          <span className="text-white-50 small mr-3 d-none d-md-inline">
            <i className={`fas fa-circle mr-1 ${wsConnected ? 'text-success' : 'text-warning'}`} />
            {wsConnected ? 'Live' : 'Connecting'}
            {isRefreshing && ' · Session refresh'}
          </span>
          <span className="text-white small mr-2">{user?.username}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            Logout
          </button>
        </span>
      </nav>
      <main>{children}</main>
    </div>
  );
}

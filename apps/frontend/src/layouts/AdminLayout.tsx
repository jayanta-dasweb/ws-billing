'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLogoutMutation } from '@/services/api/authApi';
import type { RootState } from '@/redux/store';
import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav';
import { canAccessAdminArea, getAdminLandingRoute } from '@/utils/permissions';
import { canAccessBilling, getRoleLabel } from '@/utils/roles';
import { getEffectiveRole, isAdminUser } from '@/utils/role-utils';
import { useAppLoading } from '@/hooks/useAppLoading';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useSelector((s: RootState) => s.auth.user);
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { showOverlay, hideOverlay, startNavigation } = useAppLoading();

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapse', sidebarCollapsed);
    return () => document.body.classList.remove('sidebar-collapse');
  }, [sidebarCollapsed]);

  const showBillingLink = Boolean(user && canAccessBilling(user));
  const showAdminNav = Boolean(user && canAccessAdminArea(user));
  const isFullAdmin = Boolean(user && isAdminUser(user));
  const roleLabel = user ? user.roleName || getRoleLabel(getEffectiveRole(user)) : '';

  const handleLogout = async () => {
    showOverlay('Signing out…');
    try {
      await logout().unwrap();
    } catch {
      /* server may have cleared session */
    } finally {
      hideOverlay();
      startNavigation('Redirecting to login…');
      router.replace('/login');
    }
  };

  return (
    <div className="admin-shell wrapper">
      <nav className="main-header navbar navbar-expand navbar-white navbar-light border-bottom">
        <ul className="navbar-nav">
          <li className="nav-item">
            <button
              type="button"
              className="nav-link btn btn-link"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label="Toggle sidebar"
            >
              <i className="fas fa-bars" />
            </button>
          </li>
        </ul>
        <ul className="navbar-nav ml-auto align-items-center">
          <li className="nav-item mr-2">
            <span className="badge badge-primary">{roleLabel}</span>
          </li>
          <li className="nav-item">
            <span className="nav-link py-1">
              <i className="fas fa-user mr-1" />
              {user?.username}
              {user?.counterName && (
                <small className="text-muted ml-1">· {user.counterName}</small>
              )}
            </span>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <i className="fas fa-sign-out-alt" /> Logout
            </button>
          </li>
        </ul>
      </nav>

      <aside className="main-sidebar sidebar-dark-primary elevation-4">
        <Link
          href={isFullAdmin ? '/dashboard' : user ? getAdminLandingRoute(user) : '/billing'}
          className="brand-link text-center"
        >
          <span className="brand-text font-weight-light">Billing POS</span>
        </Link>
        <div className="sidebar">
          <nav className="mt-2">
            {showAdminNav ? (
              <AdminSidebarNav showBillingLink={showBillingLink} />
            ) : (
              <ul className="nav nav-pills nav-sidebar flex-column" role="menu">
                {showBillingLink && (
                  <li className="nav-item">
                    <Link href="/billing" className="nav-link">
                      <i className="nav-icon fas fa-cash-register" />
                      <p>Billing Counter</p>
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </nav>
        </div>
      </aside>

      <div className="content-wrapper">
        <section className="content pt-3">
          <div className="container-fluid">{children}</div>
        </section>
      </div>
    </div>
  );
}

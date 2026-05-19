'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import {
  ADMIN_INVENTORY_LINKS,
  ADMIN_MASTER_LINKS,
  ADMIN_SECURITY_LINKS,
  filterNavForUser,
  type AdminNavItem,
} from '@/config/adminNav';
import type { RootState } from '@/redux/store';
import { canAccessAdminArea } from '@/utils/permissions';

function isActive(pathname: string, item: AdminNavItem): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SubLinks({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => (
        <li key={item.href} className="nav-item ml-3">
          <Link
            href={item.href}
            className={`nav-link py-1 ${isActive(pathname, item) ? 'active' : ''}`}
          >
            <p className="text-sm mb-0">{item.label}</p>
          </Link>
        </li>
      ))}
    </>
  );
}

export function AdminSidebarNav({ showBillingLink }: { showBillingLink: boolean }) {
  const pathname = usePathname();
  const user = useSelector((s: RootState) => s.auth.user);
  const masterLinks = user ? filterNavForUser(user, ADMIN_MASTER_LINKS) : [];
  const inventoryLinks = user ? filterNavForUser(user, ADMIN_INVENTORY_LINKS) : [];
  const securityLinks = user ? filterNavForUser(user, ADMIN_SECURITY_LINKS) : [];
  const showDashboard = Boolean(user && canAccessAdminArea(user));

  return (
    <ul className="nav nav-pills nav-sidebar flex-column" role="menu">
      {showDashboard && (
        <li className="nav-item">
          <Link
            href="/dashboard"
            className={`nav-link ${pathname.startsWith('/dashboard') ? 'active' : ''}`}
          >
            <i className="nav-icon fas fa-tachometer-alt" />
            <p>Admin Dashboard</p>
          </Link>
        </li>
      )}

      {masterLinks.length > 0 && (
        <>
          <li className="nav-header">Masters</li>
          <SubLinks items={masterLinks} />
        </>
      )}

      {inventoryLinks.length > 0 && (
        <>
          <li className="nav-header">Inventory</li>
          <SubLinks items={inventoryLinks} />
        </>
      )}

      {securityLinks.length > 0 && (
        <>
          <li className="nav-header">Security</li>
          <SubLinks items={securityLinks} />
        </>
      )}

      {showBillingLink && (
        <>
          <li className="nav-header">Operations</li>
          <li className="nav-item">
            <Link
              href="/billing"
              className={`nav-link ${pathname.startsWith('/billing') ? 'active' : ''}`}
            >
              <i className="nav-icon fas fa-cash-register" />
              <p>Billing Counter</p>
            </Link>
          </li>
        </>
      )}
    </ul>
  );
}

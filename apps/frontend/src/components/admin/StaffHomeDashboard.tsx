'use client';

import Link from 'next/link';
import {
  ADMIN_INVENTORY_LINKS,
  ADMIN_MASTER_LINKS,
  ADMIN_SECURITY_LINKS,
  filterNavForUser,
} from '@/config/adminNav';
import type { AuthUser } from '@/redux/slices/authSlice';
import { canAccessBilling, getEffectiveRole, getRoleLabel } from '@/utils/roles';

const TILE_ICONS: Record<string, string> = {
  product: 'fa-box',
  batch: 'fa-layer-group',
  customer: 'fa-user',
  company: 'fa-building',
  counter: 'fa-store',
  user: 'fa-users',
  tax: 'fa-percent',
  payment_mode: 'fa-credit-card',
  return: 'fa-undo',
  adjustment: 'fa-sliders',
  movement: 'fa-truck',
  log: 'fa-clipboard-list',
  ip: 'fa-shield',
  permission: 'fa-key',
};

function Tile({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <div className="col-sm-6 col-lg-4 col-xl-3 mb-3">
      <Link href={href} className="staff-home-tile">
        <i className={`fas ${icon} staff-home-tile__icon`} aria-hidden />
        <span className="staff-home-tile__label">{label}</span>
      </Link>
    </div>
  );
}

export function StaffHomeDashboard({ user }: { user: AuthUser }) {
  const master = filterNavForUser(user, ADMIN_MASTER_LINKS);
  const inventory = filterNavForUser(user, ADMIN_INVENTORY_LINKS);
  const security = filterNavForUser(user, ADMIN_SECURITY_LINKS);
  const showBilling = canAccessBilling(user);

  const tiles = [
    ...(showBilling
      ? [{ href: '/billing', label: 'Billing counter', icon: 'fa-cash-register' }]
      : []),
    ...master.map((item) => ({
      href: item.href,
      label: item.label,
      icon: TILE_ICONS[item.permissionResource ?? ''] ?? 'fa-folder',
    })),
    ...inventory.map((item) => ({
      href: item.href,
      label: item.label,
      icon: TILE_ICONS[item.permissionResource ?? ''] ?? 'fa-warehouse',
    })),
    ...security.map((item) => ({
      href: item.href,
      label: item.label,
      icon: TILE_ICONS[item.permissionResource ?? ''] ?? 'fa-lock',
    })),
  ];

  return (
    <>
      <header className="content-header">
        <div className="container-fluid">
          <h1 className="m-0">Home</h1>
          <p className="text-muted mb-0">
            {user.username} · {user.roleName || getRoleLabel(getEffectiveRole(user))}
            {user.counterName ? ` · ${user.counterName}` : ''}
          </p>
        </div>
      </header>

      <section className="row">
        {tiles.map((t) => (
          <Tile key={t.href} href={t.href} label={t.label} icon={t.icon} />
        ))}
      </section>

      {tiles.length === 0 && (
        <p className="text-muted">No modules assigned. Ask an administrator for permissions.</p>
      )}
    </>
  );
}

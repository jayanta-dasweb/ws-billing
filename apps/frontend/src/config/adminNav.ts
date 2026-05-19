import type { AuthUser } from '@/redux/slices/authSlice';
import { hasPermission } from '@/utils/permissions';
import { isAdminUser } from '@/utils/roles';

export type AdminNavItem = {
  href: string;
  label: string;
  icon?: string;
  match?: (pathname: string) => boolean;
  /** master.product, inventory.return, audit.log, … */
  permissionResource?: string;
  permissionGroup?: 'master' | 'inventory' | 'audit' | 'reports' | 'security';
};

export const ADMIN_MASTER_LINKS: AdminNavItem[] = [
  { href: '/masters/company', label: 'Company', permissionGroup: 'master', permissionResource: 'company' },
  { href: '/masters/counters', label: 'Counters', permissionGroup: 'master', permissionResource: 'counter' },
  { href: '/masters/users', label: 'Users', permissionGroup: 'master', permissionResource: 'user' },
  { href: '/masters/customers', label: 'Customers', permissionGroup: 'master', permissionResource: 'customer' },
  { href: '/masters/products', label: 'Products', permissionGroup: 'master', permissionResource: 'product' },
  { href: '/masters/batches', label: 'Batches', permissionGroup: 'master', permissionResource: 'batch' },
  { href: '/masters/taxes', label: 'Tax', permissionGroup: 'master', permissionResource: 'tax' },
  {
    href: '/masters/payment-modes',
    label: 'Payment Modes',
    permissionGroup: 'master',
    permissionResource: 'payment_mode',
  },
  {
    href: '/masters/roles',
    label: 'Roles & Permissions',
    permissionGroup: 'security',
    permissionResource: 'permission',
    match: (p) => p.startsWith('/masters/roles') || p.startsWith('/masters/security/permissions'),
  },
];

export const ADMIN_INVENTORY_LINKS: AdminNavItem[] = [
  {
    href: '/inventory/returns',
    label: 'Sales Returns',
    permissionGroup: 'inventory',
    permissionResource: 'return',
    match: (p) => p.startsWith('/inventory/returns'),
  },
  {
    href: '/inventory/adjustments',
    label: 'Stock Adjustments',
    permissionGroup: 'inventory',
    permissionResource: 'adjustment',
    match: (p) => p.startsWith('/inventory/adjustments'),
  },
  {
    href: '/inventory/movements',
    label: 'Stock Movements',
    permissionGroup: 'inventory',
    permissionResource: 'movement',
    match: (p) => p.startsWith('/inventory/movements'),
  },
];

export const ADMIN_SECURITY_LINKS: AdminNavItem[] = [
  {
    href: '/masters/security/audit',
    label: 'Audit Trail',
    permissionGroup: 'audit',
    permissionResource: 'log',
    match: (p) =>
      p.startsWith('/masters/security/audit') || p.startsWith('/inventory/audit'),
  },
  {
    href: '/masters/security/ip',
    label: 'IP Allowlist',
    permissionGroup: 'security',
    permissionResource: 'ip',
  },
];

export function canAccessNavItem(user: AuthUser, item: AdminNavItem): boolean {
  if (isAdminUser(user)) return true;
  if (!item.permissionGroup || !item.permissionResource) return false;
  return hasPermission(user, `${item.permissionGroup}.${item.permissionResource}.view`);
}

export function filterNavForUser(user: AuthUser, items: AdminNavItem[]): AdminNavItem[] {
  if (isAdminUser(user)) return items;
  return items.filter((item) => canAccessNavItem(user, item));
}

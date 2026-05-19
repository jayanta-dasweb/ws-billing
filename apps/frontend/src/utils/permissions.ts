import { PermissionCode, UserRole } from '@billing/shared';
import type { AuthUser } from '@/redux/slices/authSlice';
import { getEffectiveRole, isAdminUser } from '@/utils/role-utils';

/** Customer master perms are for billing search only — not the admin masters area. */
function isAdminMasterPermission(code: string): boolean {
  if (!code.startsWith('master.')) return false;
  return !code.startsWith('master.customer.');
}

export function hasPermission(user: AuthUser | null | undefined, code: PermissionCode | string) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return user.permissions?.includes(code) ?? false;
}

/** Dashboard, users, products, inventory, etc. (not billing-only customer lookup). */
export function hasNonCounterAccess(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;

  const perms = user.permissions ?? [];
  return perms.some(
    (p) =>
      isAdminMasterPermission(p) ||
      p.startsWith('inventory.') ||
      p.startsWith('audit.') ||
      p.startsWith('reports.') ||
      p.startsWith('security.'),
  );
}

export function canViewMasterResource(
  user: AuthUser | null | undefined,
  resource: string,
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return hasPermission(user, `master.${resource}.view`);
}

/** Opens billing counter on login; no admin sidebar. */
export function isCounterOnlyUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return false;
  if (hasNonCounterAccess(user)) return false;
  if (getEffectiveRole(user) === UserRole.CASHIER) return true;
  return (
    hasPermission(user, PermissionCode.BILLING_ACCESS) ||
    Boolean(user.counterId)
  );
}

export function canAccessAdminArea(user: AuthUser | null | undefined): boolean {
  return hasNonCounterAccess(user);
}

/** Home for staff with extra permissions (simple dashboard). */
export function getAdminLandingRoute(user: AuthUser | null | undefined): string {
  if (!user) return '/billing';
  if (hasNonCounterAccess(user)) return '/dashboard';
  return '/billing';
}

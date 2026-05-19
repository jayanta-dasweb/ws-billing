import { UserRole } from '@billing/shared';
import type { AuthUser } from '@/redux/slices/authSlice';
import { canAccessAdminArea, getAdminLandingRoute, isCounterOnlyUser } from '@/utils/permissions';

/** Prefer RBAC role key when legacy `role` column is out of sync. */
export function getEffectiveRole(user: Pick<AuthUser, 'role' | 'roleKey'>): UserRole {
  switch (user.roleKey) {
    case 'super_admin':
      return UserRole.SUPER_ADMIN;
    case 'admin':
      return UserRole.ADMIN;
    case 'cashier':
      return UserRole.CASHIER;
    default:
      return user.role;
  }
}

export function getHomeRoute(role: UserRole): string {
  if (role === UserRole.CASHIER) return '/billing';
  return '/dashboard';
}

/** Counter-only staff → billing; everyone else with admin access → dashboard. */
export function getHomeRouteForUser(
  user: Pick<AuthUser, 'role' | 'roleKey' | 'permissions' | 'counterId'>,
): string {
  if (isCounterOnlyUser(user as AuthUser)) return '/billing';
  if (canAccessAdminArea(user as AuthUser)) return getAdminLandingRoute(user as AuthUser);
  return getHomeRoute(getEffectiveRole(user));
}

export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

export function isAdminUser(user: Pick<AuthUser, 'role' | 'roleKey'>): boolean {
  return isAdminRole(getEffectiveRole(user));
}

export function canAccessDashboard(role: UserRole): boolean {
  return isAdminRole(role);
}

export function canAccessDashboardUser(user: Pick<AuthUser, 'role' | 'roleKey'>): boolean {
  return canAccessDashboard(getEffectiveRole(user));
}

export function canAccessBilling(user: Pick<AuthUser, 'role' | 'counterId'>): boolean {
  if (user.role === UserRole.CASHIER) return Boolean(user.counterId);
  return true;
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 'Super Admin';
    case UserRole.ADMIN:
      return 'Admin';
    case UserRole.CASHIER:
      return 'Cashier';
    default:
      return role;
  }
}

export function resolvePostLoginPath(
  user: Pick<AuthUser, 'role' | 'roleKey' | 'permissions' | 'counterId'>,
  requestedRedirect: string | null,
): string {
  const home = getHomeRouteForUser(user);
  if (!requestedRedirect || requestedRedirect === '/' || requestedRedirect === '/login') {
    return home;
  }
  if (
    (requestedRedirect.startsWith('/dashboard') ||
      requestedRedirect.startsWith('/masters') ||
      requestedRedirect.startsWith('/inventory')) &&
    !canAccessAdminArea(user as AuthUser)
  ) {
    return home;
  }
  if (requestedRedirect.startsWith('/billing') && isCounterOnlyUser(user as AuthUser)) {
    return '/billing';
  }
  return requestedRedirect;
}

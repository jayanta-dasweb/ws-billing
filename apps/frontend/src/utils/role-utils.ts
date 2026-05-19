import { UserRole } from '@billing/shared';
import type { AuthUser } from '@/redux/slices/authSlice';

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

export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

export function isAdminUser(user: Pick<AuthUser, 'role' | 'roleKey'>): boolean {
  return isAdminRole(getEffectiveRole(user));
}

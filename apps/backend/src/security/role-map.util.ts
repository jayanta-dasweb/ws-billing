import { UserRole } from '@prisma/client';
import { SystemRoleKey } from '@billing/shared';

export const LEGACY_ROLE_TO_ID: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'role-super-admin',
  [UserRole.ADMIN]: 'role-admin',
  [UserRole.CASHIER]: 'role-cashier',
};

export function legacyRoleToKey(role: UserRole): string {
  const map: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: SystemRoleKey.SUPER_ADMIN,
    [UserRole.ADMIN]: SystemRoleKey.ADMIN,
    [UserRole.CASHIER]: SystemRoleKey.CASHIER,
  };
  return map[role];
}

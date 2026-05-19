import { UserRole } from '@prisma/client';
import type { AuthUserPayload } from '../auth/types/auth-principal.type';

export function isCashierUser(user: AuthUserPayload): boolean {
  if (user.roleKey === 'cashier') return true;
  return user.role === UserRole.CASHIER;
}

export function isAdminBillingUser(user: AuthUserPayload): boolean {
  if (user.roleKey === 'super_admin' || user.roleKey === 'admin') return true;
  return user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;
}

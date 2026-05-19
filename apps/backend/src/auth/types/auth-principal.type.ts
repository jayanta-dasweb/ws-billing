import { UserRole } from '@prisma/client';

export type AuthPrincipalType = 'staff' | 'customer';

/** Staff JWT payload (billing / admin). */
export interface AuthUserPayload {
  principal: 'staff';
  sub: string;
  username: string;
  role: UserRole;
  roleId?: string | null;
  roleKey?: string | null;
  counterId?: string | null;
  counterIds?: string[];
  permissions?: string[];
}

/** Customer portal JWT payload. */
export interface CustomerAuthPayload {
  principal: 'customer';
  sub: string;
  mobile: string;
  name: string;
}

export type JwtPayload = AuthUserPayload | CustomerAuthPayload;

export function isCustomerAuth(user: JwtPayload): user is CustomerAuthPayload {
  return user.principal === 'customer';
}

export function isStaffAuth(user: JwtPayload): user is AuthUserPayload {
  return user.principal === 'staff';
}

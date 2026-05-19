import { UserRole } from '@prisma/client';

export const MASTER_WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;

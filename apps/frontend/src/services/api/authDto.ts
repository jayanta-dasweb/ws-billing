import type { UserRole } from '@billing/shared';

export interface AuthUserCounterDto {
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface AuthUserDto {
  id: string;
  username: string;
  role: UserRole;
  roleKey?: string | null;
  roleName?: string | null;
  counterId: string | null;
  counterName: string | null;
  counters?: AuthUserCounterDto[];
  permissions?: string[];
}

export function mapAuthUserDto(dto: AuthUserDto) {
  return {
    id: dto.id,
    username: dto.username,
    role: dto.role,
    roleKey: dto.roleKey ?? undefined,
    roleName: dto.roleName ?? undefined,
    counterId: dto.counterId ?? undefined,
    counterName: dto.counterName ?? undefined,
    counters: dto.counters,
    permissions: dto.permissions,
  };
}

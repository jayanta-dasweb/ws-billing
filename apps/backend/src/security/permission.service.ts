import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ALL_PERMISSION_CODES, PERMISSION_CATALOG, SystemRoleKey } from '@billing/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { groupPermissionsByModule } from './permission-catalog.util';

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async syncCatalog() {
    for (let i = 0; i < PERMISSION_CATALOG.length; i++) {
      const p = PERMISSION_CATALOG[i];
      await this.prisma.permission.upsert({
        where: { code: p.code },
        update: {
          groupKey: p.group,
          resource: p.resource,
          action: p.action,
          name: p.name,
          description: p.description,
          sortOrder: i,
        },
        create: {
          code: p.code,
          groupKey: p.group,
          resource: p.resource,
          action: p.action,
          name: p.name,
          description: p.description,
          sortOrder: i,
        },
      });
    }
  }

  async getCatalog() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ groupKey: 'asc' }, { resource: 'asc' }, { sortOrder: 'asc' }],
    });
    return {
      permissions,
      grouped: groupPermissionsByModule(
        permissions.map((p) => ({
          code: p.code,
          group: p.groupKey,
          resource: p.resource,
          action: p.action,
          name: p.name,
          description: p.description ?? undefined,
        })),
      ),
    };
  }

  async getPermissionsForUser(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        rbacRole: { include: { permissions: { select: { permissionCode: true } } } },
        permissions: true,
      },
    });
    if (!user) return [];

    if (
      user.rbacRole?.key === SystemRoleKey.SUPER_ADMIN ||
      user.role === UserRole.SUPER_ADMIN
    ) {
      return ALL_PERMISSION_CODES;
    }

    const set = new Set<string>();
    for (const rp of user.rbacRole?.permissions ?? []) {
      set.add(rp.permissionCode);
    }
    for (const up of user.permissions) {
      if (up.granted) set.add(up.permissionCode);
      else set.delete(up.permissionCode);
    }
    return [...set];
  }

  async getPermissionsForRoleKey(roleKey: string): Promise<string[]> {
    if (roleKey === SystemRoleKey.SUPER_ADMIN) return ALL_PERMISSION_CODES;
    const role = await this.prisma.role.findUnique({
      where: { key: roleKey },
      include: { permissions: { select: { permissionCode: true } } },
    });
    return role?.permissions.map((p) => p.permissionCode) ?? [];
  }

  async hasPermission(userId: string, code: string): Promise<boolean> {
    const perms = await this.getPermissionsForUser(userId);
    return perms.includes(code);
  }

  async getUserPermissionDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        rbacRole: {
          include: { permissions: { select: { permissionCode: true } } },
        },
        permissions: true,
      },
    });
    if (!user) return null;

    const fromRole = user.rbacRole?.permissions.map((p) => p.permissionCode) ?? [];
    const directGrants = user.permissions.filter((p) => p.granted).map((p) => p.permissionCode);
    const directRevokes = user.permissions.filter((p) => !p.granted).map((p) => p.permissionCode);
    const effective = await this.getPermissionsForUser(userId);

    return {
      userId,
      roleId: user.roleId,
      roleKey: user.rbacRole?.key ?? null,
      roleName: user.rbacRole?.name ?? null,
      fromRole,
      directGrants,
      directRevokes,
      effective,
    };
  }

  async setUserPermissionOverrides(
    userId: string,
    grants: string[],
    revokes: string[],
    actorId: string,
    ip?: string,
  ) {
    await this.prisma.userPermission.deleteMany({ where: { userId } });
    const rows = [
      ...grants.map((permissionCode) => ({ userId, permissionCode, granted: true })),
      ...revokes.map((permissionCode) => ({ userId, permissionCode, granted: false })),
    ];
    if (rows.length) {
      await this.prisma.userPermission.createMany({ data: rows, skipDuplicates: true });
    }
    await this.audit.log({
      userId: actorId,
      action: 'UPDATE_USER_PERMISSIONS',
      entity: 'UserPermission',
      entityId: userId,
      metadata: { grants, revokes },
      ipAddress: ip,
    });
    return this.getUserPermissionDetail(userId);
  }
}

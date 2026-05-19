import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SystemRoleKey } from '@billing/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { PaginationQueryDto, paginated } from '../masters/common/pagination.dto';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.RoleWhereInput = {};
    if (query.activeOnly) where.isActive = true;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { key: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        include: {
          _count: { select: { users: true, permissions: true } },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return paginated(
      items.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        isActive: r.isActive,
        userCount: r._count.users,
        permissionCount: r._count.permissions,
      })),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string) {
    const row = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { select: { permissionCode: true } },
        _count: { select: { users: true } },
      },
    });
    if (!row) throw new NotFoundException('Role not found');
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      isSystem: row.isSystem,
      isActive: row.isActive,
      userCount: row._count.users,
      permissionCodes: row.permissions.map((p) => p.permissionCode),
    };
  }

  async create(dto: CreateRoleDto, actorId: string, ip?: string) {
    const key = dto.key.trim().toLowerCase().replace(/\s+/g, '_');
    const exists = await this.prisma.role.findUnique({ where: { key } });
    if (exists) throw new ConflictException('Role key already exists');

    const row = await this.prisma.role.create({
      data: {
        key,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        isSystem: false,
      },
    });

    if (dto.permissionCodes?.length) {
      await this.setPermissions(row.id, dto.permissionCodes, actorId, ip, false);
    }

    await this.audit.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'Role',
      entityId: row.id,
      metadata: { key },
      ipAddress: ip,
    });
    return this.findOne(row.id);
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string, ip?: string) {
    const role = await this.findOne(id);
    if (role.isSystem && dto.key && dto.key !== role.key) {
      throw new ForbiddenException('Cannot change key of a system role');
    }

    const row = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
      },
    });

    if (dto.permissionCodes) {
      await this.setPermissions(id, dto.permissionCodes, actorId, ip, false);
    }

    await this.audit.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'Role',
      entityId: id,
      ipAddress: ip,
    });
    return this.findOne(row.id);
  }

  async setPermissions(
    roleId: string,
    codes: string[],
    actorId: string,
    ip?: string,
    audit = true,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.key === SystemRoleKey.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin role has all permissions automatically');
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: codes.map((permissionCode) => ({ roleId, permissionCode })),
        skipDuplicates: true,
      }),
    ]);

    if (audit) {
      await this.audit.log({
        userId: actorId,
        action: 'UPDATE_ROLE_PERMISSIONS',
        entity: 'Role',
        entityId: roleId,
        metadata: { codes },
        ipAddress: ip,
      });
    }
    return this.findOne(roleId);
  }
}

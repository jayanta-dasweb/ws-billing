import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { UserCounterService } from '../../security/user-counter.service';
import { LEGACY_ROLE_TO_ID } from '../../security/role-map.util';
import { PaginationQueryDto, paginated } from '../common/pagination.dto';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const userSelect = {
  id: true,
  username: true,
  role: true,
  roleId: true,
  counterId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  counter: { select: { id: true, name: true } },
  rbacRole: { select: { id: true, key: true, name: true } },
  userCounters: {
    select: {
      isPrimary: true,
      counter: { select: { id: true, name: true, isActive: true } },
    },
    orderBy: { isPrimary: 'desc' as const },
  },
} satisfies Prisma.UserSelect;

function mapUser(row: Prisma.UserGetPayload<{ select: typeof userSelect }>) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    counterId: row.counterId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    counter: row.counter,
    roleId: row.roleId,
    rbacRole: row.rbacRole,
    counters: row.userCounters.map((uc) => ({
      id: uc.counter.id,
      name: uc.counter.name,
      isPrimary: uc.isPrimary,
      isActive: uc.counter.isActive,
    })),
  };
}

@Injectable()
export class UserMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly userCounters: UserCounterService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = {};

    if (query.activeOnly) where.isActive = true;
    if (query.search) where.username = { contains: query.search };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { username: 'asc' },
        select: userSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginated(rows.map(mapUser), total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!row) throw new NotFoundException('User not found');
    return mapUser(row);
  }

  async create(dto: CreateUserDto, userId: string, ip?: string) {
    const exists = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (exists) throw new ConflictException('Username already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const roleId =
      dto.roleId ?? (dto.role ? LEGACY_ROLE_TO_ID[dto.role] : LEGACY_ROLE_TO_ID.CASHIER);
    const legacyRole =
      dto.role ??
      (roleId === LEGACY_ROLE_TO_ID.SUPER_ADMIN
        ? 'SUPER_ADMIN'
        : roleId === LEGACY_ROLE_TO_ID.ADMIN
          ? 'ADMIN'
          : 'CASHIER');

    const counterIds = dto.counterIds?.length
      ? dto.counterIds
      : dto.counterId
        ? [dto.counterId]
        : [];
    const primary = dto.primaryCounterId ?? dto.counterId ?? counterIds[0];

    const row = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        role: legacyRole,
        rbacRole: { connect: { id: roleId } },
        ...(primary ? { counter: { connect: { id: primary } } } : {}),
        isActive: dto.isActive ?? true,
      },
      select: userSelect,
    });

    if (counterIds.length) {
      await this.userCounters.setAssignments(row.id, counterIds, primary);
    }

    const full = await this.findOne(row.id);
    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'User',
      entityId: row.id,
      metadata: { username: row.username, role: row.role },
      ipAddress: ip,
    });
    return full;
  }

  async update(id: string, dto: UpdateUserDto, userId: string, ip?: string) {
    await this.findOne(id);

    if (dto.username) {
      const clash = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id } },
      });
      if (clash) throw new ConflictException('Username already exists');
    }

    const data: Prisma.UserUpdateInput = {
      username: dto.username,
      isActive: dto.isActive,
    };

    if (dto.roleId) {
      data.rbacRole = { connect: { id: dto.roleId } };
      data.role =
        dto.roleId === LEGACY_ROLE_TO_ID.SUPER_ADMIN
          ? 'SUPER_ADMIN'
          : dto.roleId === LEGACY_ROLE_TO_ID.ADMIN
            ? 'ADMIN'
            : 'CASHIER';
    } else if (dto.role) {
      data.role = dto.role;
      data.rbacRole = { connect: { id: LEGACY_ROLE_TO_ID[dto.role] } };
    }

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    await this.prisma.user.update({ where: { id }, data });

    if (dto.counterIds !== undefined) {
      await this.userCounters.setAssignments(
        id,
        dto.counterIds,
        dto.primaryCounterId ?? dto.counterId,
      );
    } else if (dto.counterId !== undefined) {
      await this.userCounters.setAssignments(
        id,
        dto.counterId ? [dto.counterId] : [],
        dto.counterId,
      );
    }

    const full = await this.findOne(id);
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      ipAddress: ip,
    });
    return full;
  }
}

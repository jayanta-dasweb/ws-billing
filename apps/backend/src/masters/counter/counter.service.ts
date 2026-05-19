import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginationQueryDto, paginated } from '../common/pagination.dto';
import { CreateCounterDto, UpdateCounterDto } from './dto/counter.dto';

@Injectable()
export class CounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CounterWhereInput = {};

    if (query.activeOnly) where.isActive = true;
    if (query.search) where.name = { contains: query.search };

    const [items, total] = await Promise.all([
      this.prisma.counter.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.counter.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.counter.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Counter not found');
    return row;
  }

  async create(dto: CreateCounterDto, userId: string, ip?: string) {
    const row = await this.prisma.counter.create({ data: dto });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'Counter',
      entityId: row.id,
      ipAddress: ip,
    });
    return row;
  }

  async update(id: string, dto: UpdateCounterDto, userId: string, ip?: string) {
    await this.findOne(id);
    const row = await this.prisma.counter.update({ where: { id }, data: dto });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'Counter',
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }
}

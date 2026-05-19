import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginationQueryDto, paginated } from '../common/pagination.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CustomerWhereInput = {};

    if (query.activeOnly) where.isActive = true;
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term } },
        { mobile: { contains: term } },
        { gstNumber: { contains: term } },
        { panNumber: { contains: term } },
        { email: { contains: term } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.customer.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Customer not found');
    return row;
  }

  async create(dto: CreateCustomerDto, userId: string, ip?: string) {
    const row = await this.prisma.customer.create({ data: dto });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'Customer',
      entityId: row.id,
      ipAddress: ip,
    });
    return row;
  }

  async update(id: string, dto: UpdateCustomerDto, userId: string, ip?: string) {
    await this.findOne(id);
    const row = await this.prisma.customer.update({ where: { id }, data: dto });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'Customer',
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }
}

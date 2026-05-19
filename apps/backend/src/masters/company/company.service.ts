import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginationQueryDto, paginated } from '../common/pagination.dto';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CompanyWhereInput = {};

    if (query.activeOnly) where.isActive = true;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { gstin: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Company not found');
    return row;
  }

  async create(dto: CreateCompanyDto, userId: string, ip?: string) {
    const row = await this.prisma.company.create({ data: dto });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'Company',
      entityId: row.id,
      ipAddress: ip,
    });
    return row;
  }

  async update(id: string, dto: UpdateCompanyDto, userId: string, ip?: string) {
    await this.findOne(id);
    const row = await this.prisma.company.update({ where: { id }, data: dto });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'Company',
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }
}

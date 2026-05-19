import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginationQueryDto, paginated } from '../common/pagination.dto';
import { CreateTaxDto, UpdateTaxDto } from './dto/tax.dto';

function resolveTaxPercents(dto: CreateTaxDto): CreateTaxDto & {
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
};
function resolveTaxPercents(dto: UpdateTaxDto): UpdateTaxDto;
function resolveTaxPercents(dto: CreateTaxDto | UpdateTaxDto) {
  const gst = dto.gstPercent;
  if (gst === undefined) return dto;

  const half = Number(gst) / 2;
  return {
    ...dto,
    cgstPercent: dto.cgstPercent ?? half,
    sgstPercent: dto.sgstPercent ?? half,
    igstPercent: dto.igstPercent ?? Number(gst),
  };
}

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TaxMasterWhereInput = {};

    if (query.activeOnly) where.isActive = true;
    if (query.search) where.name = { contains: query.search };

    const [items, total] = await Promise.all([
      this.prisma.taxMaster.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.taxMaster.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.taxMaster.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Tax master not found');
    return row;
  }

  async create(dto: CreateTaxDto, userId: string, ip?: string) {
    const data = resolveTaxPercents(dto);
    const row = await this.prisma.taxMaster.create({ data });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'TaxMaster',
      entityId: row.id,
      ipAddress: ip,
    });
    return row;
  }

  async update(id: string, dto: UpdateTaxDto, userId: string, ip?: string) {
    await this.findOne(id);
    const data = resolveTaxPercents(dto);
    const row = await this.prisma.taxMaster.update({ where: { id }, data });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'TaxMaster',
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }
}

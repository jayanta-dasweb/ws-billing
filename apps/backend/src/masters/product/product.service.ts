import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginationQueryDto, paginated } from '../common/pagination.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

const productInclude = { taxMaster: { select: { id: true, name: true, gstPercent: true } } };

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProductWhereInput = {};

    if (query.activeOnly) where.isActive = true;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { barcode: { contains: query.search } },
        { sku: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: productInclude,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  async create(dto: CreateProductDto, userId: string, ip?: string) {
    const row = await this.prisma.product.create({
      data: dto,
      include: productInclude,
    });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'Product',
      entityId: row.id,
      ipAddress: ip,
    });
    return row;
  }

  async update(id: string, dto: UpdateProductDto, userId: string, ip?: string) {
    await this.findOne(id);
    const row = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: productInclude,
    });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'Product',
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }
}

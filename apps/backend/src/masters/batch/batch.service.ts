import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuditAction } from '../../common/audit/audit-actions';
import { PaginationQueryDto, paginated } from '../common/pagination.dto';
import { CreateBatchDto, UpdateBatchDto } from './dto/batch.dto';

function mapBatch<T extends { stockQty: unknown; pendingQty: unknown }>(row: T) {
  const stock = Number(row.stockQty);
  const pending = Number(row.pendingQty);
  return {
    ...row,
    availableQty: stock - pending,
  };
}

@Injectable()
export class BatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto & { productId?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BatchStockWhereInput = {};

    if (query.activeOnly) where.isActive = true;
    if (query.productId) where.productId = query.productId;
    if (query.search) {
      where.OR = [
        { batchNumber: { contains: query.search } },
        { product: { name: { contains: query.search } } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.batchStock.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ expiryDate: 'asc' }, { batchNumber: 'asc' }],
        include: { product: { select: { id: true, name: true, barcode: true } } },
      }),
      this.prisma.batchStock.count({ where }),
    ]);

    return paginated(rows.map(mapBatch), total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.batchStock.findUnique({
      where: { id },
      include: { product: { select: { id: true, name: true, barcode: true } } },
    });
    if (!row) throw new NotFoundException('Batch not found');
    return mapBatch(row);
  }

  async create(dto: CreateBatchDto, userId: string, ip?: string) {
    const { expiryDate, ...rest } = dto;
    const row = await this.prisma.batchStock.create({
      data: {
        ...rest,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      },
      include: { product: { select: { id: true, name: true, barcode: true } } },
    });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'BatchStock',
      entityId: row.id,
      ipAddress: ip,
    });
    return mapBatch(row);
  }

  async update(id: string, dto: UpdateBatchDto, userId: string, ip?: string) {
    const before = await this.prisma.batchStock.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Batch not found');
    const { expiryDate, ...rest } = dto;
    const row = await this.prisma.batchStock.update({
      where: { id },
      data: {
        ...rest,
        ...(expiryDate !== undefined
          ? { expiryDate: expiryDate ? new Date(expiryDate) : null }
          : {}),
      },
      include: { product: { select: { id: true, name: true, barcode: true } } },
    });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'BatchStock',
      entityId: id,
      ipAddress: ip,
    });
    if (
      dto.sellingPrice !== undefined &&
      Math.abs(Number(before.sellingPrice) - Number(row.sellingPrice)) > 0.001
    ) {
      await this.audit.log({
        userId,
        action: AuditAction.RATE_CHANGED,
        entity: 'BatchStock',
        entityId: id,
        metadata: {
          batchNumber: row.batchNumber,
          from: Number(before.sellingPrice),
          to: Number(row.sellingPrice),
        },
        ipAddress: ip,
      });
    }
    return mapBatch(row);
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockAdjustmentReason, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction } from '../common/audit/audit-actions';
import { StockMovementService } from './stock-movement.service';
import { CreateStockAdjustmentDto } from './dto/stock-adjustment.dto';

@Injectable()
export class StockAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly movements: StockMovementService,
  ) {}

  async list(query: { batchId?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.StockAdjustmentWhereInput = {};
    if (query.batchId) where.batchId = query.batchId;

    const [rows, total] = await Promise.all([
      this.prisma.stockAdjustment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          batch: { select: { batchNumber: true } },
          product: { select: { name: true } },
          user: { select: { username: true } },
        },
      }),
      this.prisma.stockAdjustment.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        adjNo: r.adjNo,
        batchId: r.batchId,
        batchNumber: r.batch.batchNumber,
        productName: r.product.name,
        qtyDelta: Number(r.qtyDelta),
        reason: r.reason,
        notes: r.notes,
        userName: r.user.username,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async listMovements(batchId: string, limit = 50) {
    const rows = await this.prisma.stockMovement.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((m) => ({
      id: m.id,
      movementType: m.movementType,
      qtyDelta: Number(m.qtyDelta),
      qtyBefore: Number(m.qtyBefore),
      qtyAfter: Number(m.qtyAfter),
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async create(userId: string, dto: CreateStockAdjustmentDto, ip?: string) {
    if (Math.abs(dto.qtyDelta) < 0.0001) {
      throw new BadRequestException('qtyDelta cannot be zero');
    }

    const batch = await this.prisma.batchStock.findUnique({
      where: { id: dto.batchId },
      include: { product: { select: { id: true, name: true } } },
    });
    if (!batch || !batch.isActive) throw new NotFoundException('Batch not found or inactive');

    const movementType =
      dto.qtyDelta > 0
        ? dto.reason === StockAdjustmentReason.DAMAGE
          ? StockMovementType.DAMAGE
          : StockMovementType.ADJUSTMENT_IN
        : StockMovementType.ADJUSTMENT_OUT;

    const adjNo = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const count = await tx.stockAdjustment.count({
        where: { createdAt: { gte: startOfYear } },
      });
      const no = `ADJ/${year}/${String(count + 1).padStart(5, '0')}`;

      const adj = await tx.stockAdjustment.create({
        data: {
          adjNo: no,
          batchId: batch.id,
          productId: batch.productId,
          qtyDelta: dto.qtyDelta,
          reason: dto.reason,
          notes: dto.notes?.trim() || null,
          userId,
        },
      });

      await this.movements.recordInTransaction(tx, {
        batchId: batch.id,
        productId: batch.productId,
        movementType,
        qtyDelta: dto.qtyDelta,
        referenceType: 'StockAdjustment',
        referenceId: adj.id,
        userId,
        notes: dto.notes,
      });

      return no;
    });

    await this.movements.publishBatchReconcile(batch.id, batch.productId);

    await this.audit.log({
      userId,
      action: AuditAction.STOCK_ADJUSTED,
      entity: 'StockAdjustment',
      entityId: adjNo,
      metadata: {
        batchId: batch.id,
        productName: batch.product.name,
        qtyDelta: dto.qtyDelta,
        reason: dto.reason,
      },
      ipAddress: ip,
    });

    return { adjNo, batchId: batch.id, qtyDelta: dto.qtyDelta };
  }
}

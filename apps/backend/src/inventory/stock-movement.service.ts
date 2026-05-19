import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction } from '../common/audit/audit-actions';
import { StockReservationService } from '../stock/stock-reservation.service';

export interface RecordMovementParams {
  batchId: string;
  productId: string;
  movementType: StockMovementType;
  qtyDelta: number;
  referenceType: string;
  referenceId: string;
  userId?: string;
  notes?: string;
  ipAddress?: string;
}

type TxClient = Prisma.TransactionClient;

@Injectable()
export class StockMovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reservations: StockReservationService,
  ) {}

  async recordInTransaction(tx: TxClient, params: RecordMovementParams) {
    const rows = await tx.$queryRaw<
      { id: string; stock_qty: Prisma.Decimal; pending_qty: Prisma.Decimal }[]
    >`
      SELECT id, stock_qty, pending_qty FROM batch_stock WHERE id = ${params.batchId} FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw new Error(`Batch not found: ${params.batchId}`);

    const qtyBefore = Number(row.stock_qty);
    const qtyAfter = qtyBefore + params.qtyDelta;
    if (qtyAfter < -0.0001) {
      throw new Error(`Stock cannot go negative (batch ${params.batchId})`);
    }

    await tx.batchStock.update({
      where: { id: params.batchId },
      data: { stockQty: { increment: params.qtyDelta } },
    });

    const movement = await tx.stockMovement.create({
      data: {
        batchId: params.batchId,
        productId: params.productId,
        movementType: params.movementType,
        qtyDelta: params.qtyDelta,
        qtyBefore,
        qtyAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        userId: params.userId,
        notes: params.notes,
      },
    });

    return { movement, qtyBefore, qtyAfter };
  }

  async record(params: RecordMovementParams) {
    const result = await this.prisma.$transaction((tx) => this.recordInTransaction(tx, params));

    await this.reservations.reconcileBatch(params.batchId, params.productId);

    await this.audit.log({
      userId: params.userId,
      action: AuditAction.STOCK_MOVEMENT,
      entity: 'StockMovement',
      entityId: result.movement.id,
      metadata: {
        batchId: params.batchId,
        movementType: params.movementType,
        qtyDelta: params.qtyDelta,
        qtyBefore: result.qtyBefore,
        qtyAfter: result.qtyAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
      ipAddress: params.ipAddress,
    });

    return result.movement;
  }

  async publishBatchReconcile(batchId: string, productId: string) {
    await this.reservations.reconcileBatch(batchId, productId);
  }

  /** Log immutable movement when stock was already updated in the same transaction. */
  async logMovementOnly(
    tx: TxClient,
    params: Omit<RecordMovementParams, 'qtyDelta'> & {
      qtyDelta: number;
      qtyBefore: number;
      qtyAfter: number;
    },
  ) {
    return tx.stockMovement.create({
      data: {
        batchId: params.batchId,
        productId: params.productId,
        movementType: params.movementType,
        qtyDelta: params.qtyDelta,
        qtyBefore: params.qtyBefore,
        qtyAfter: params.qtyAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        userId: params.userId,
        notes: params.notes,
      },
    });
  }
}

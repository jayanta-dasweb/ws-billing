import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillStatus,
  Prisma,
  ReturnStatus,
  ReturnType,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction } from '../common/audit/audit-actions';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { StockMovementService } from '../inventory/stock-movement.service';
import { CompleteReturnDto, CreateReturnDto } from './dto/returns.dto';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly movements: StockMovementService,
  ) {}

  async lookupBill(invoiceNo: string | undefined, billId: string | undefined) {
    let bill;
    if (invoiceNo) {
      const inv = await this.prisma.invoice.findUnique({
        where: { invoiceNo },
        include: { bill: { include: { items: true, invoice: true, customer: true } } },
      });
      if (!inv) throw new NotFoundException('Invoice not found');
      bill = inv.bill;
    } else if (billId) {
      bill = await this.prisma.bill.findUnique({
        where: { id: billId },
        include: { items: true, invoice: true, customer: true },
      });
    } else {
      throw new BadRequestException('invoiceNo or billId required');
    }

    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status !== BillStatus.COMPLETED) {
      throw new BadRequestException('Returns only allowed on completed bills');
    }

    const returnable = await this.computeReturnableQty(bill.items.map((i) => i.id));

    return {
      billId: bill.id,
      billNo: bill.billNo,
      invoiceNo: bill.invoice?.invoiceNo ?? null,
      customerName: bill.customer?.name ?? null,
      grandTotal: Number(bill.grandTotal),
      items: bill.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        batchId: item.batchId,
        batchNumber: item.batchNumber,
        soldQty: Number(item.qty),
        returnableQty: returnable.get(item.id) ?? 0,
        rate: Number(item.rate),
        lineTotal: Number(item.lineTotal),
      })),
    };
  }

  async listReturns(limit = 30) {
    const rows = await this.prisma.salesReturn.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        bill: { include: { invoice: { select: { invoiceNo: true } } } },
        items: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      returnNo: r.returnNo,
      status: r.status,
      returnType: r.returnType,
      billId: r.billId,
      invoiceNo: r.bill.invoice?.invoiceNo ?? null,
      refundTotal: Number(r.refundTotal),
      itemCount: r.items.length,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    }));
  }

  async getReturn(id: string) {
    const row = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: {
        items: true,
        bill: { include: { invoice: { select: { invoiceNo: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Return not found');
    return this.mapReturn(row);
  }

  async createReturn(user: AuthUserPayload, dto: CreateReturnDto, ip?: string) {
    const lookup = await this.lookupBill(undefined, dto.billId);
    const bill = await this.prisma.bill.findUniqueOrThrow({
      where: { id: lookup.billId },
      include: { items: true },
    });

    const returnable = await this.computeReturnableQty(bill.items.map((i) => i.id));
    const lines = this.validateReturnLines(dto, bill.items, returnable);

    const refundTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const returnType =
      dto.returnType === ReturnType.FULL
        ? ReturnType.FULL
        : lines.length === bill.items.length &&
            lines.every((l) => {
              const item = bill.items.find((i) => i.id === l.billItemId);
              return item && l.qty >= Number(item.qty);
            })
          ? ReturnType.FULL
          : ReturnType.PARTIAL;

    const salesReturn = await this.prisma.salesReturn.create({
      data: {
        status: ReturnStatus.DRAFT,
        returnType,
        billId: bill.id,
        counterId: bill.counterId,
        userId: user.sub,
        customerId: bill.customerId,
        refundTotal,
        refundMode: dto.refundMode ?? null,
        refundNote: dto.refundNote?.trim() || null,
        items: {
          create: lines.map((l) => ({
            billItemId: l.billItemId,
            productId: l.productId,
            batchId: l.batchId,
            productName: l.productName,
            batchNumber: l.batchNumber,
            qty: l.qty,
            rate: l.rate,
            lineTotal: l.lineTotal,
            reason: l.reason,
          })),
        },
      },
      include: { items: true, bill: { include: { invoice: true } } },
    });

    await this.audit.log({
      userId: user.sub,
      action: AuditAction.RETURN_CREATED,
      entity: 'SalesReturn',
      entityId: salesReturn.id,
      metadata: { billId: bill.id, returnType, refundTotal, lineCount: lines.length },
      ipAddress: ip,
    });

    return this.mapReturn(salesReturn);
  }

  async completeReturn(id: string, user: AuthUserPayload, dto: CompleteReturnDto, ip?: string) {
    const existing = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: { items: true, bill: true },
    });
    if (!existing) throw new NotFoundException('Return not found');
    if (existing.status !== ReturnStatus.DRAFT) {
      throw new BadRequestException(`Return is ${existing.status}`);
    }

    const returnable = await this.computeReturnableQty(
      existing.items.map((i) => i.billItemId),
      id,
    );

    for (const item of existing.items) {
      const max = returnable.get(item.billItemId) ?? 0;
      if (Number(item.qty) > max + 0.0001) {
        throw new BadRequestException(
          `Return qty exceeds returnable for ${item.productName} (max ${max})`,
        );
      }
      if (!item.batchId) {
        throw new BadRequestException(`Batch required to return ${item.productName}`);
      }
    }

    const returnNo = await this.prisma.$transaction(async (tx) => {
      const no = await this.nextReturnNo(tx);

      for (const item of existing.items) {
        if (!item.batchId) continue;
        await this.movements.recordInTransaction(tx, {
          batchId: item.batchId,
          productId: item.productId,
          movementType: StockMovementType.SALE_RETURN,
          qtyDelta: Number(item.qty),
          referenceType: 'SalesReturn',
          referenceId: id,
          userId: user.sub,
          notes: item.reason ?? undefined,
        });
      }

      await tx.salesReturn.update({
        where: { id },
        data: {
          status: ReturnStatus.COMPLETED,
          returnNo: no,
          completedAt: new Date(),
          refundMode: dto.refundMode ?? existing.refundMode,
          refundNote: dto.refundNote?.trim() ?? existing.refundNote,
        },
      });

      return no;
    });

    for (const item of existing.items) {
      if (item.batchId) {
        await this.movements.publishBatchReconcile(item.batchId, item.productId);
      }
    }

    await this.audit.log({
      userId: user.sub,
      action: AuditAction.RETURN_COMPLETED,
      entity: 'SalesReturn',
      entityId: id,
      metadata: { returnNo, refundTotal: Number(existing.refundTotal) },
      ipAddress: ip,
    });

    return this.getReturn(id);
  }

  async cancelReturn(id: string, user: AuthUserPayload, ip?: string) {
    const row = await this.prisma.salesReturn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Return not found');
    if (row.status !== ReturnStatus.DRAFT) {
      throw new BadRequestException('Only draft returns can be cancelled');
    }
    await this.prisma.salesReturn.update({
      where: { id },
      data: { status: ReturnStatus.CANCELLED },
    });
    await this.audit.log({
      userId: user.sub,
      action: AuditAction.RETURN_CANCELLED,
      entity: 'SalesReturn',
      entityId: id,
      ipAddress: ip,
    });
    return { id, status: ReturnStatus.CANCELLED };
  }

  private async computeReturnableQty(billItemIds: string[], excludeReturnId?: string) {
    const sold = await this.prisma.billItem.findMany({
      where: { id: { in: billItemIds } },
      select: { id: true, qty: true },
    });

    const returned = await this.prisma.salesReturnItem.groupBy({
      by: ['billItemId'],
      where: {
        billItemId: { in: billItemIds },
        salesReturn: {
          status: ReturnStatus.COMPLETED,
          ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
        },
      },
      _sum: { qty: true },
    });

    const returnedMap = new Map(
      returned.map((r) => [r.billItemId, Number(r._sum.qty ?? 0)]),
    );

    const map = new Map<string, number>();
    for (const item of sold) {
      const soldQty = Number(item.qty);
      const already = returnedMap.get(item.id) ?? 0;
      map.set(item.id, Math.max(0, soldQty - already));
    }
    return map;
  }

  private validateReturnLines(
    dto: CreateReturnDto,
    billItems: { id: string; productId: string; batchId: string | null; productName: string; batchNumber: string | null; qty: Prisma.Decimal; rate: Prisma.Decimal }[],
    returnable: Map<string, number>,
  ) {
    const lines: {
      billItemId: string;
      productId: string;
      batchId: string | null;
      productName: string;
      batchNumber: string | null;
      qty: number;
      rate: number;
      lineTotal: number;
      reason?: string;
    }[] = [];

    for (const line of dto.lines) {
      const item = billItems.find((i) => i.id === line.billItemId);
      if (!item) throw new BadRequestException(`Invalid bill line ${line.billItemId}`);
      const max = returnable.get(item.id) ?? 0;
      if (line.qty > max + 0.0001) {
        throw new BadRequestException(
          `Cannot return ${line.qty} of ${item.productName}; max returnable ${max}`,
        );
      }
      const rate = Number(item.rate);
      lines.push({
        billItemId: item.id,
        productId: item.productId,
        batchId: item.batchId,
        productName: item.productName,
        batchNumber: item.batchNumber,
        qty: line.qty,
        rate,
        lineTotal: Math.round(line.qty * rate * 100) / 100,
        reason: line.reason,
      });
    }

    if (dto.returnType === ReturnType.FULL) {
      const allReturnable = billItems.every((i) => {
        const req = lines.find((l) => l.billItemId === i.id);
        const max = returnable.get(i.id) ?? 0;
        return req && req.qty >= max - 0.0001;
      });
      if (!allReturnable) {
        throw new BadRequestException('Full return must include all returnable quantities');
      }
    }

    return lines;
  }

  private async nextReturnNo(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const seq = await tx.returnSequence.upsert({
      where: { id: 'default' },
      create: { id: 'default', year, lastNo: 1, prefix: 'RET' },
      update: { lastNo: { increment: 1 }, year },
    });
    return `${seq.prefix}/${year}/${String(seq.lastNo).padStart(5, '0')}`;
  }

  private mapReturn(
    row: {
      id: string;
      returnNo: string | null;
      status: ReturnStatus;
      returnType: ReturnType;
      billId: string;
      refundTotal: Prisma.Decimal;
      refundMode: import('@prisma/client').PaymentMode | null;
      refundNote: string | null;
      createdAt: Date;
      completedAt: Date | null;
      items: {
        id: string;
        billItemId: string;
        productName: string;
        batchNumber: string | null;
        qty: Prisma.Decimal;
        rate: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        reason: string | null;
      }[];
      bill: { invoice?: { invoiceNo: string } | null };
    },
  ) {
    return {
      id: row.id,
      returnNo: row.returnNo,
      status: row.status,
      returnType: row.returnType,
      billId: row.billId,
      invoiceNo: row.bill.invoice?.invoiceNo ?? null,
      refundTotal: Number(row.refundTotal),
      refundMode: row.refundMode,
      refundNote: row.refundNote,
      items: row.items.map((i) => ({
        id: i.id,
        billItemId: i.billItemId,
        productName: i.productName,
        batchNumber: i.batchNumber,
        qty: Number(i.qty),
        rate: Number(i.rate),
        lineTotal: Number(i.lineTotal),
        reason: i.reason,
      })),
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}

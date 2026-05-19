import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillStatus, PaymentMode, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BillingGateway } from '../websocket/billing.gateway';
import { BillCommitProducer } from '../queue/bill-commit.producer';
import { StockReservationService } from '../stock/stock-reservation.service';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction } from '../common/audit/audit-actions';
import { AuditModule } from '@billing/shared';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import {
  calcMasterLineDiscount,
  discountFromPercent,
  scaleLineDiscount,
} from '@billing/shared';
import { applyRoundToNearestRupee, calcBillTotals, calcLineAmounts, round2 } from './billing-calc.util';
import { resolvePayments } from './billing-payment.util';
import {
  CompleteBillDto,
  CreateBillDto,
  ScanLineDto,
  SetBillCustomerDto,
  SetBillDiscountDto,
  SetBillRoundOffDto,
  UpdateLineDto,
  UpdateLineQtyDto,
} from './dto/billing.dto';
import { mergeCatalogProducts } from './catalog-merge.util';
import { startOfLocalDay } from './billing-tabs.util';
import { isCashierUser } from './billing-user.util';
import { CounterSessionService } from '../security/counter-session.service';
import { TransferBillDto } from './dto/billing.dto';

const WALK_IN_CUSTOMER_ID = 'seed-walkin';
const EDITABLE: BillStatus[] = [BillStatus.DRAFT, BillStatus.HOLD];

type BillWithItems = Prisma.BillGetPayload<{
  include: {
    items: { orderBy: { sortOrder: 'asc' } };
    customer: {
      select: {
        id: true;
        name: true;
        mobile: true;
        gstNumber: true;
        panNumber: true;
        email: true;
        billingAddress: true;
      };
    };
    invoice: { select: { invoiceNo: true } };
    payments: { orderBy: { sortOrder: 'asc' } };
  };
}>;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: BillingGateway,
    private readonly commitProducer: BillCommitProducer,
    private readonly reservations: StockReservationService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly counterSessions: CounterSessionService,
  ) {}

  async createDraft(user: AuthUserPayload, dto: CreateBillDto) {
    const counterId = this.resolveCounterId(user, dto.counterId);
    const customerId = dto.customerId ?? WALK_IN_CUSTOMER_ID;

    if (!dto.customerId) {
      const existing = await this.prisma.bill.findFirst({
        where: {
          counterId,
          ...(isCashierUser(user) ? { userId: user.sub } : {}),
          status: BillStatus.DRAFT,
          customerId: WALK_IN_CUSTOMER_ID,
          items: { none: {} },
        },
        orderBy: { updatedAt: 'desc' },
        include: this.billInclude(),
      });
      if (existing) {
        return this.mapBill(existing);
      }
    }

    const bill = await this.prisma.bill.create({
      data: {
        status: BillStatus.DRAFT,
        counterId,
        userId: user.sub,
        customerId,
      },
      include: this.billInclude(),
    });

    return this.mapBill(bill);
  }

  async getBill(id: string, user: AuthUserPayload) {
    const bill = await this.loadBill(id);
    this.assertBillAccess(user, bill);
    if (EDITABLE.includes(bill.status) && bill.items.length > 0) {
      await this.reservations.touchSession(bill.id);
    }
    return this.mapBill(bill);
  }

  async heartbeatBill(billId: string, user: AuthUserPayload) {
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);
    await this.reservations.touchSession(billId);
    await this.prisma.bill.update({
      where: { id: billId },
      data: { updatedAt: new Date() },
    });
    return { ok: true, billId, expiresInSec: this.redis.reservationTtlSec() };
  }

  async listOpenBills(user: AuthUserPayload, counterId?: string) {
    const cid = this.resolveCounterId(user, counterId);
    const todayStart = startOfLocalDay();

    /** Workspace tabs: only today's draft + parked bills (not completed / processing). */
    const open = await this.prisma.bill.findMany({
      where: {
        counterId: cid,
        ...(isCashierUser(user) ? { userId: user.sub } : {}),
        status: { in: [BillStatus.DRAFT, BillStatus.HOLD] },
        updatedAt: { gte: todayStart },
      },
      include: {
        customer: { select: { name: true } },
        invoice: { select: { invoiceNo: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 30,
    });

    return open.map((b) => ({
      id: b.id,
      status: b.status,
      customerName: b.customer?.name,
      itemCount: b._count.items,
      grandTotal: Number(b.grandTotal),
      invoiceNo: b.invoice?.invoiceNo ?? null,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));
  }

  async cleanupEmptyDrafts(user: AuthUserPayload, counterId?: string, keepBillId?: string) {
    const cid = this.resolveCounterId(user, counterId);

    const empties = await this.prisma.bill.findMany({
      where: {
        counterId: cid,
        ...(isCashierUser(user) ? { userId: user.sub } : {}),
        status: BillStatus.DRAFT,
        items: { none: {} },
        ...(keepBillId ? { id: { not: keepBillId } } : {}),
      },
      select: { id: true },
    });

    if (empties.length === 0) {
      return { cancelled: 0 };
    }

    await this.prisma.bill.updateMany({
      where: { id: { in: empties.map((b) => b.id) } },
      data: { status: BillStatus.CANCELLED },
    });

    for (const b of empties) {
      this.gateway.emitBillCancelled({ billId: b.id, counterId: cid });
    }

    return { cancelled: empties.length };
  }

  /** Counters with an active session, excluding the caller's counter. */
  async listTransferTargets(user: AuthUserPayload, counterId?: string) {
    const cid = this.resolveCounterId(user, counterId);
    const online = await this.counterSessions.listOnlineCounters();
    const ids = online.map((o) => o.counterId).filter((id) => id !== cid);
    if (ids.length === 0) return [];

    const counters = await this.prisma.counter.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true },
    });
    const nameById = new Map(counters.map((c) => [c.id, c.name]));

    return online
      .filter((o) => o.counterId !== cid && nameById.has(o.counterId))
      .map((o) => ({
        counterId: o.counterId,
        counterName: nameById.get(o.counterId)!,
        userId: o.userId,
        username: o.username,
      }));
  }

  async transferBill(billId: string, user: AuthUserPayload, dto: TransferBillDto) {
    const bill = await this.loadBill(billId);
    this.assertBillAccess(user, bill);
    this.assertEditable(bill);

    if (bill.items.length === 0) {
      throw new BadRequestException('Add items before transferring this bill');
    }

    const fromCounterId = bill.counterId;
    if (dto.targetCounterId === fromCounterId) {
      throw new BadRequestException('Choose a different counter');
    }

    const holder = await this.counterSessions.getHolder(dto.targetCounterId);
    if (!holder) {
      throw new BadRequestException('That counter is not online. Transfer only when a cashier is signed in there.');
    }

    const targetCounter = await this.prisma.counter.findFirst({
      where: { id: dto.targetCounterId, isActive: true },
    });
    if (!targetCounter) {
      throw new NotFoundException('Counter not found');
    }

    await this.prisma.bill.update({
      where: { id: billId },
      data: {
        counterId: dto.targetCounterId,
        userId: holder.userId,
      },
    });

    await this.audit.activity({
      action: AuditAction.BILL_TRANSFERRED,
      module: AuditModule.BILLING,
      subjectType: 'Bill',
      subjectId: billId,
      userId: user.sub,
      description: `Bill transferred to ${targetCounter.name}`,
      referenceType: 'Bill',
      referenceId: billId,
      before: { counterId: fromCounterId, userId: bill.userId },
      after: {
        counterId: dto.targetCounterId,
        userId: holder.userId,
        assignedTo: holder.username,
      },
    });

    this.gateway.emitBillTransferred({
      billId,
      fromCounterId,
      toCounterId: dto.targetCounterId,
      toUserId: holder.userId,
      toUsername: holder.username,
    });

    for (const item of bill.items) {
      if (!item.batchId) continue;
      await this.reservations.reconcileBatch(item.batchId, item.productId);
    }

    return {
      billId,
      counterId: dto.targetCounterId,
      counterName: targetCounter.name,
      assignedToUsername: holder.username,
    };
  }

  async setBillCustomer(billId: string, user: AuthUserPayload, dto: SetBillCustomerDto) {
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, isActive: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.bill.update({
      where: { id: billId },
      data: { customerId: customer.id },
    });

    return this.getBill(billId, user);
  }

  async setBillDiscount(billId: string, user: AuthUserPayload, dto: SetBillDiscountDto) {
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);

    const rawGrand = round2(
      bill.items.reduce((s, i) => s + Number(i.lineTotal), 0),
    );

    let amount = 0;
    if (dto.percent !== undefined) {
      amount = discountFromPercent(rawGrand, dto.percent);
    } else if (dto.amount !== undefined) {
      amount = dto.amount;
    }

    if (amount > rawGrand + 0.001) {
      throw new BadRequestException(
        `Bill discount cannot exceed bill total before discount (₹${rawGrand})`,
      );
    }

    const prevDiscount = Number(bill.discountTotal);
    await this.prisma.bill.update({
      where: { id: billId },
      data: { discountTotal: amount },
    });
    await this.recalcBill(billId);
    if (Math.abs(prevDiscount - amount) > 0.001) {
      await this.audit.activity({
        action: AuditAction.BILL_DISCOUNT_CHANGED,
        module: AuditModule.BILLING,
        subjectType: 'Bill',
        subjectId: billId,
        userId: user.sub,
        description: 'Bill discount changed',
        referenceType: 'Bill',
        referenceId: billId,
        before: { discountTotal: prevDiscount },
        after: { discountTotal: amount, percent: dto.percent },
      });
    }
    return this.getBill(billId, user);
  }

  async setBillRoundOff(billId: string, user: AuthUserPayload, dto: SetBillRoundOffDto) {
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);

    const items = await this.prisma.billItem.findMany({ where: { billId } });
    const billDiscount = Number(bill.discountTotal ?? 0);
    const base = calcBillTotals(
      items.map((i) => ({
        taxableAmount: Number(i.taxableAmount),
        cgstAmount: Number(i.cgstAmount),
        sgstAmount: Number(i.sgstAmount),
        igstAmount: Number(i.igstAmount),
        lineTotal: Number(i.lineTotal),
        discount: Number(i.discount),
      })),
      billDiscount,
    );

    let roundOff = 0;
    let grandTotal = base.rawAfterBillDiscount;
    if (dto.mode === 'nearest') {
      const rounded = applyRoundToNearestRupee(base.rawAfterBillDiscount);
      roundOff = rounded.roundOff;
      grandTotal = rounded.grandTotal;
    }

    await this.prisma.bill.update({
      where: { id: billId },
      data: { roundOff, grandTotal },
    });

    return this.getBill(billId, user);
  }

  async searchCatalog(query: string, limit = 20) {
    const term = query.trim();
    if (!term) return [];

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: term } },
          { barcode: { contains: term } },
          { sku: { contains: term } },
          { batches: { some: { batchNumber: { contains: term }, isActive: true } } },
        ],
      },
      take: Math.min(limit, 30),
      orderBy: { name: 'asc' },
      include: {
        taxMaster: true,
        batches: {
          where: { isActive: true },
          orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    const mapped = products.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      sku: p.sku,
      hsnCode: p.hsnCode,
      gstPercent: Number(p.taxMaster?.gstPercent ?? 0),
      batches: p.batches
        .map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate?.toISOString().slice(0, 10) ?? null,
          mrp: Number(b.mrp),
          sellingPrice: Number(b.sellingPrice),
          discountPercent: Number(b.discountPercent ?? 0),
          discountPerUnit: Number(b.discountPerUnit ?? 0),
          stockQty: Number(b.stockQty),
          pendingQty: Number(b.pendingQty),
          availableQty: Number(b.stockQty) - Number(b.pendingQty),
        }))
        .filter((b) => b.availableQty > 0.0001),
    }));

    return mergeCatalogProducts(mapped);
  }

  async addProductLine(
    billId: string,
    user: AuthUserPayload,
    dto: { productId: string; batchId?: string; qty?: number },
  ) {
    const qty = dto.qty ?? 1;
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, isActive: true },
      include: { taxMaster: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const batch = await this.resolveBatch(product.id, qty, dto.batchId);
    if (!batch) {
      throw new BadRequestException(`Insufficient stock for ${product.name}`);
    }

    return this.appendBillLine(billId, bill, product, batch, qty, user);
  }

  async scanLine(billId: string, user: AuthUserPayload, dto: ScanLineDto) {
    const qty = dto.qty ?? 1;
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);

    const product = await this.prisma.product.findFirst({
      where: { barcode: dto.barcode.trim(), isActive: true },
      include: { taxMaster: true },
    });
    if (!product) {
      throw new NotFoundException(`Product not found for barcode: ${dto.barcode}`);
    }

    const batch = await this.resolveBatch(product.id, qty);
    if (!batch) {
      throw new BadRequestException(`Insufficient stock for ${product.name}`);
    }

    return this.appendBillLine(billId, bill, product, batch, qty, user);
  }

  private async appendBillLine(
    billId: string,
    bill: BillWithItems,
    product: {
      id: string;
      name: string;
      hsnCode: string | null;
      discountPercent: unknown;
      discountPerUnit: unknown;
      taxMaster: { gstPercent: unknown; cgstPercent: unknown; sgstPercent: unknown } | null;
    },
    batch: {
      id: string;
      batchNumber: string;
      sellingPrice: unknown;
      discountPercent: unknown;
      discountPerUnit: unknown;
    },
    qty: number,
    user: AuthUserPayload,
  ) {
    const existing = bill.items.find((i) => i.batchId === batch.id);
    if (existing) {
      return this.changeLineQty(billId, existing.id, user, { qty: Number(existing.qty) + qty });
    }

    const gstPercent = Number(product.taxMaster?.gstPercent ?? 0);
    const cgstPercent = Number(product.taxMaster?.cgstPercent ?? gstPercent / 2);
    const sgstPercent = Number(product.taxMaster?.sgstPercent ?? gstPercent / 2);
    const rate = Number(batch.sellingPrice);
    const productDisc = {
      discountPercent: Number(product.discountPercent ?? 0),
      discountPerUnit: Number(product.discountPerUnit ?? 0),
    };
    const batchDisc = {
      discountPercent: Number(batch.discountPercent ?? 0),
      discountPerUnit: Number(batch.discountPerUnit ?? 0),
    };
    const discount = calcMasterLineDiscount(qty, rate, productDisc, batchDisc);
    const amounts = calcLineAmounts({
      qty,
      rate,
      discount,
      gstPercent,
      cgstPercent,
      sgstPercent,
    });

    await this.reservations.reserve(
      batch.id,
      billId,
      product.id,
      qty,
      bill.counterId,
      qty,
    );

    await this.prisma.billItem.create({
      data: {
        billId,
        productId: product.id,
        batchId: batch.id,
        productName: product.name,
        hsnCode: product.hsnCode,
        batchNumber: batch.batchNumber,
        qty,
        rate,
        discount,
        gstPercent,
        ...amounts,
        sortOrder: bill.items.length,
      },
    });

    await this.recalcBill(billId);
    return this.getBill(billId, user);
  }

  async updateLineQty(
    billId: string,
    lineId: string,
    user: AuthUserPayload,
    dto: UpdateLineQtyDto,
  ) {
    return this.changeLineQty(billId, lineId, user, dto);
  }

  async updateLine(
    billId: string,
    lineId: string,
    user: AuthUserPayload,
    dto: UpdateLineDto,
  ) {
    if (dto.qty !== undefined) {
      return this.changeLineQty(billId, lineId, user, { qty: dto.qty });
    }
    if (dto.discount !== undefined || dto.discountPercent !== undefined) {
      const bill = await this.loadBill(billId);
      const line = bill.items.find((i) => i.id === lineId);
      if (!line) throw new NotFoundException('Line not found');
      const gross = Number(line.qty) * Number(line.rate);
      let discount = dto.discount;
      if (dto.discountPercent !== undefined) {
        discount = round2((gross * dto.discountPercent) / 100);
      }
      if (discount === undefined) {
        throw new BadRequestException('Provide discount or discountPercent');
      }
      if (discount > gross + 0.001) {
        throw new BadRequestException('Line discount cannot exceed line amount');
      }
      return this.changeLineDiscount(billId, lineId, user, discount);
    }
    throw new BadRequestException('Provide qty, discount, or discountPercent to update');
  }

  async removeLine(billId: string, lineId: string, user: AuthUserPayload) {
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);

    const line = bill.items.find((i) => i.id === lineId);
    if (!line) throw new NotFoundException('Line not found');
    const counter = await this.prisma.counter.findUnique({
      where: { id: bill.counterId },
      select: { name: true },
    });
    if (line.batchId) {
      await this.reservations.release(
        line.batchId,
        billId,
        line.productId,
        Number(line.qty),
        bill.counterId,
        { lineId, counterName: counter?.name ?? 'Counter', lineQtyHint: 0 },
      );
    }

    await this.prisma.billItem.delete({ where: { id: lineId } });
    await this.recalcBill(billId);
    await this.audit.activity({
      action: AuditAction.LINE_REMOVED,
      module: AuditModule.BILLING,
      subjectType: 'BillItem',
      subjectId: lineId,
      userId: user.sub,
      description: `Line removed: ${line.productName}`,
      referenceType: 'Bill',
      referenceId: billId,
      before: {
        productName: line.productName,
        qty: Number(line.qty),
        rate: Number(line.rate),
      },
    });
    return this.getBill(billId, user);
  }

  async holdBill(billId: string, user: AuthUserPayload) {
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);
    if (bill.items.length === 0) {
      throw new BadRequestException('Cannot hold an empty bill');
    }

    await this.prisma.bill.update({
      where: { id: billId },
      data: { status: BillStatus.HOLD },
    });

    return this.getBill(billId, user);
  }

  async resumeBill(billId: string, user: AuthUserPayload) {
    const bill = await this.loadBill(billId);
    if (bill.status !== BillStatus.HOLD) {
      throw new BadRequestException('Bill is not on hold');
    }
    this.assertBillAccess(user, bill);

    await this.prisma.bill.update({
      where: { id: billId },
      data: { status: BillStatus.DRAFT },
    });

    return this.getBill(billId, user);
  }

  async cancelBill(billId: string, user: AuthUserPayload) {
    const bill = await this.loadBill(billId);
    if (!EDITABLE.includes(bill.status) && bill.status !== BillStatus.PENDING_COMMIT) {
      throw new BadRequestException('Bill cannot be cancelled');
    }
    this.assertBillAccess(user, bill);

    await this.reservations.releaseAllForBill(
      billId,
      bill.items.map((i) => ({
        batchId: i.batchId,
        productId: i.productId,
        qty: Number(i.qty),
      })),
      bill.counterId,
    );

    await this.prisma.bill.update({
      where: { id: billId },
      data: { status: BillStatus.CANCELLED },
    });

    await this.audit.activity({
      action: AuditAction.BILL_CANCELLED,
      module: AuditModule.BILLING,
      subjectType: 'Bill',
      subjectId: billId,
      userId: user.sub,
      description: 'Bill cancelled',
      referenceType: 'Bill',
      referenceId: billId,
      before: { status: bill.status, grandTotal: Number(bill.grandTotal) },
      after: { status: BillStatus.CANCELLED },
      properties: { itemCount: bill.items.length },
    });

    this.gateway.emitBillCancelled({ billId, counterId: bill.counterId });
    return this.getBill(billId, user);
  }

  async completeBill(
    billId: string,
    user: AuthUserPayload,
    dto: CompleteBillDto,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const cached = await this.redis.getIdempotencyResult<Record<string, unknown>>(
        'complete',
        `${billId}:${idempotencyKey}`,
      );
      if (cached) return cached;
    }

    const bill = await this.loadBill(billId);
    if (!EDITABLE.includes(bill.status)) {
      throw new BadRequestException(`Cannot complete bill in status ${bill.status}`);
    }
    this.assertBillAccess(user, bill);
    if (bill.items.length === 0) {
      throw new BadRequestException('Bill has no items');
    }

    const grandTotal = Number(bill.grandTotal);
    const payment = resolvePayments(dto, grandTotal);

    if (payment.paymentMode === PaymentMode.CREDIT) {
      if (!bill.customerId || bill.customerId === WALK_IN_CUSTOMER_ID) {
        throw new BadRequestException('Credit sale requires a registered customer (not walk-in)');
      }
      const customer = await this.prisma.customer.findUnique({ where: { id: bill.customerId } });
      if (!customer?.isActive) {
        throw new BadRequestException('Customer not found or inactive');
      }
      const limit = Number(customer.creditLimit);
      if (limit > 0 && grandTotal > limit + 0.01) {
        throw new BadRequestException(
          `Bill total ₹${grandTotal} exceeds customer credit limit ₹${limit}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.billPayment.deleteMany({ where: { billId } });
      await tx.bill.update({
        where: { id: billId },
        data: {
          status: BillStatus.PENDING_COMMIT,
          paymentMode: payment.paymentMode,
          cashReceived: payment.cashReceived,
          balanceReturn: payment.balanceReturn,
          isCredit: payment.paymentMode === PaymentMode.CREDIT,
          creditNote: dto.creditNote?.trim() || null,
          queuedAt: new Date(),
        },
      });
      if (payment.lines.length) {
        await tx.billPayment.createMany({
          data: payment.lines.map((line, idx) => ({
            billId,
            mode: line.mode,
            amount: line.amount,
            reference: line.reference,
            auditJson: line.auditJson
              ? (JSON.parse(JSON.stringify(line.auditJson)) as object)
              : undefined,
            sortOrder: idx,
          })),
        });
      }
    });

    await this.commitProducer.enqueue({
      billId,
      counterId: bill.counterId,
      userId: user.sub,
    });
    const stats = await this.commitProducer.getQueueStats();
    this.gateway.emitQueueStatus({
      waiting: stats.waiting,
      active: stats.active,
    });

    const updated = await this.getBill(billId, user);
    const result = { ...updated, queue: { waiting: stats.waiting, active: stats.active } };
    if (idempotencyKey) {
      await this.redis.setIdempotencyResult('complete', `${billId}:${idempotencyKey}`, result);
    }
    return result;
  }

  private async changeLineQty(
    billId: string,
    lineId: string,
    user: AuthUserPayload,
    dto: UpdateLineQtyDto,
  ) {
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);

    const line = bill.items.find((i) => i.id === lineId);
    if (!line || !line.batchId) throw new NotFoundException('Line not found');

    const counter = await this.prisma.counter.findUnique({
      where: { id: bill.counterId },
      select: { name: true },
    });
    const counterName = counter?.name ?? 'Counter';

    const oldQty = Number(line.qty);
    const newQty = dto.qty;

    if (oldQty > 0.001) {
      await this.reservations.release(
        line.batchId,
        billId,
        line.productId,
        oldQty,
        bill.counterId,
        { lineId, counterName, lineQtyHint: 0, suppressBroadcast: true },
      );
    }

    let reservedForLine = 0;
    if (newQty > 0.001) {
      try {
        await this.reservations.reserve(
          line.batchId,
          billId,
          line.productId,
          newQty,
          bill.counterId,
          newQty,
        );
        reservedForLine = newQty;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('Insufficient stock')) throw e;
        reservedForLine = await this.reservations.reserveAvailable(
          line.batchId,
          billId,
          line.productId,
          bill.counterId,
          newQty,
          { lineId, counterName },
        );
      }
    }

    const product = await this.prisma.product.findUnique({
      where: { id: line.productId },
      include: { taxMaster: true },
    });
    const gstPercent = Number(line.gstPercent);
    const cgstPercent = Number(product?.taxMaster?.cgstPercent ?? gstPercent / 2);
    const sgstPercent = Number(product?.taxMaster?.sgstPercent ?? gstPercent / 2);
    const discount = await this.resolveLineDiscountForQty(line, newQty);
    const amounts = calcLineAmounts({
      qty: newQty,
      rate: Number(line.rate),
      discount,
      gstPercent,
      cgstPercent,
      sgstPercent,
    });

    await this.prisma.billItem.update({
      where: { id: lineId },
      data: { qty: newQty, discount, ...amounts },
    });

    await this.recalcBill(billId);

    await this.reservations.publishLineStockState(line.batchId, line.productId, {
      billId,
      lineId,
      counterId: bill.counterId,
      counterName,
      lineQty: newQty,
      reservedForLine,
    });

    if (Math.abs(oldQty - newQty) > 0.001) {
      await this.audit.activity({
        action: AuditAction.LINE_QTY_CHANGED,
        module: AuditModule.BILLING,
        subjectType: 'BillItem',
        subjectId: lineId,
        userId: user.sub,
        description: `Qty changed: ${line.productName}`,
        referenceType: 'Bill',
        referenceId: billId,
        before: { qty: oldQty },
        after: { qty: newQty },
      });
    }
    return this.getBill(billId, user);
  }

  private async changeLineDiscount(
    billId: string,
    lineId: string,
    user: AuthUserPayload,
    discount: number,
  ) {
    const bill = await this.loadBill(billId);
    this.assertEditable(bill);
    this.assertBillAccess(user, bill);

    const line = bill.items.find((i) => i.id === lineId);
    if (!line) throw new NotFoundException('Line not found');

    const prevDiscount = Number(line.discount);

    const product = await this.prisma.product.findUnique({
      where: { id: line.productId },
      include: { taxMaster: true },
    });
    const gstPercent = Number(line.gstPercent);
    const cgstPercent = Number(product?.taxMaster?.cgstPercent ?? gstPercent / 2);
    const sgstPercent = Number(product?.taxMaster?.sgstPercent ?? gstPercent / 2);
    const amounts = calcLineAmounts({
      qty: Number(line.qty),
      rate: Number(line.rate),
      discount,
      gstPercent,
      cgstPercent,
      sgstPercent,
    });

    await this.prisma.billItem.update({
      where: { id: lineId },
      data: { discount, ...amounts },
    });

    await this.recalcBill(billId);
    if (Math.abs(prevDiscount - discount) > 0.001) {
      await this.audit.activity({
        action: AuditAction.LINE_DISCOUNT_CHANGED,
        module: AuditModule.BILLING,
        subjectType: 'BillItem',
        subjectId: lineId,
        userId: user.sub,
        description: `Line discount: ${line.productName}`,
        referenceType: 'Bill',
        referenceId: billId,
        before: { discount: prevDiscount },
        after: { discount },
      });
    }
    return this.getBill(billId, user);
  }

  private async pickFifoBatch(productId: string, qty: number) {
    const blockExpired = this.config.get<string>('BATCH_BLOCK_EXPIRED', 'true') !== 'false';
    const now = new Date();
    const batches = await this.prisma.batchStock.findMany({
      where: { productId, isActive: true },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
    return (
      batches.find((b) => {
        if (blockExpired && b.expiryDate && b.expiryDate < now) return false;
        return Number(b.stockQty) - Number(b.pendingQty) >= qty;
      }) ?? null
    );
  }

  private assertBatchSellable(batch: { expiryDate: Date | null; isActive: boolean; batchNumber: string }) {
    if (!batch.isActive) {
      throw new BadRequestException(`Batch ${batch.batchNumber} is inactive`);
    }
    const blockExpired = this.config.get<string>('BATCH_BLOCK_EXPIRED', 'true') !== 'false';
    if (blockExpired && batch.expiryDate && batch.expiryDate < new Date()) {
      throw new BadRequestException(`Batch ${batch.batchNumber} has expired`);
    }
  }

  private async resolveLineDiscountForQty(
    line: {
      productId: string;
      batchId: string | null;
      qty: unknown;
      rate: unknown;
      discount: unknown;
    },
    newQty: number,
  ): Promise<number> {
    const oldQty = Number(line.qty);
    const rate = Number(line.rate);
    const current = Number(line.discount);

    const [product, batch] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: line.productId },
        select: { discountPercent: true, discountPerUnit: true },
      }),
      line.batchId
        ? this.prisma.batchStock.findUnique({
            where: { id: line.batchId },
            select: { discountPercent: true, discountPerUnit: true },
          })
        : Promise.resolve(null),
    ]);

    const productSrc = {
      discountPercent: Number(product?.discountPercent ?? 0),
      discountPerUnit: Number(product?.discountPerUnit ?? 0),
    };
    const batchSrc = batch
      ? {
          discountPercent: Number(batch.discountPercent ?? 0),
          discountPerUnit: Number(batch.discountPerUnit ?? 0),
        }
      : undefined;

    const oldMaster =
      oldQty > 0 ? calcMasterLineDiscount(oldQty, rate, productSrc, batchSrc) : 0;
    const newMaster = calcMasterLineDiscount(newQty, rate, productSrc, batchSrc);

    if (oldQty > 0 && Math.abs(current - oldMaster) < 0.02) {
      return newMaster;
    }
    if (oldQty > 0) {
      return scaleLineDiscount(current, oldQty, newQty);
    }
    return newMaster;
  }

  private async resolveBatch(productId: string, qty: number, batchId?: string) {
    if (batchId) {
      const batch = await this.prisma.batchStock.findFirst({
        where: { id: batchId, productId, isActive: true },
      });
      if (!batch) throw new NotFoundException('Batch not found for this product');
      this.assertBatchSellable(batch);
      const available = Number(batch.stockQty) - Number(batch.pendingQty);
      if (available + 0.0001 < qty) {
        throw new BadRequestException(
          `Insufficient stock in batch ${batch.batchNumber} (available ${available})`,
        );
      }
      return batch;
    }
    return this.pickFifoBatch(productId, qty);
  }

  private async recalcBill(billId: string) {
    const bill = await this.prisma.bill.findUnique({ where: { id: billId } });
    const items = await this.prisma.billItem.findMany({ where: { billId } });
    const billDiscount = Number(bill?.discountTotal ?? 0);
    const totals = calcBillTotals(
      items.map((i) => ({
        taxableAmount: Number(i.taxableAmount),
        cgstAmount: Number(i.cgstAmount),
        sgstAmount: Number(i.sgstAmount),
        igstAmount: Number(i.igstAmount),
        lineTotal: Number(i.lineTotal),
        discount: Number(i.discount),
      })),
      billDiscount,
    );

    await this.prisma.bill.update({
      where: { id: billId },
      data: {
        subtotal: totals.subtotal,
        discountTotal: totals.billDiscount,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
      },
    });
  }

  private billInclude() {
    return {
      items: { orderBy: { sortOrder: 'asc' as const } },
      customer: {
        select: {
          id: true,
          name: true,
          mobile: true,
          gstNumber: true,
          panNumber: true,
          email: true,
          billingAddress: true,
        },
      },
      invoice: { select: { invoiceNo: true } },
      payments: { orderBy: { sortOrder: 'asc' as const } },
    };
  }

  private async loadBill(id: string): Promise<BillWithItems> {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: this.billInclude(),
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  private assertEditable(bill: BillWithItems) {
    if (!EDITABLE.includes(bill.status)) {
      throw new BadRequestException(`Bill is ${bill.status} and cannot be edited`);
    }
  }

  private resolveCounterId(user: AuthUserPayload, counterId?: string): string {
    if (isCashierUser(user)) {
      if (!user.counterId) {
        throw new ForbiddenException('Cashier has no counter assigned');
      }
      return user.counterId;
    }
    if (!counterId) {
      throw new BadRequestException('counterId is required for this user');
    }
    return counterId;
  }

  private assertCounterAccess(user: AuthUserPayload, billCounterId: string) {
    if (!isCashierUser(user)) return;

    const assigned = user.counterIds ?? [];
    if (!user.counterId || user.counterId !== billCounterId) {
      throw new ForbiddenException('Bill belongs to another counter');
    }
    if (assigned.length > 0 && !assigned.includes(billCounterId)) {
      throw new ForbiddenException('You are not assigned to this counter');
    }
  }

  private assertBillOwner(
    user: AuthUserPayload,
    bill: { userId: string },
  ) {
    if (!isCashierUser(user)) return;
    if (bill.userId !== user.sub) {
      throw new ForbiddenException('This bill belongs to another cashier');
    }
  }

  private assertBillAccess(
    user: AuthUserPayload,
    bill: { counterId: string; userId: string },
  ) {
    this.assertCounterAccess(user, bill.counterId);
    this.assertBillOwner(user, bill);
  }

  private async mapBill(bill: BillWithItems) {
    const billReserves = await this.redis.getBillReservations(bill.id);
    const linesPerBatch = new Map<string, number>();
    for (const item of bill.items) {
      if (item.batchId) {
        linesPerBatch.set(item.batchId, (linesPerBatch.get(item.batchId) ?? 0) + 1);
      }
    }

    const items = await Promise.all(
      bill.items.map(async (item) => {
        let availableQty: number | undefined;
        let pendingQty: number | undefined;
        let stockQty: number | undefined;
        let reservedQty: number | undefined;
        let shortageQty: number | undefined;
        const lineQty = Number(item.qty);
        if (item.batchId) {
          const batch = await this.prisma.batchStock.findUnique({
            where: { id: item.batchId },
          });
          if (batch) {
            stockQty = Number(batch.stockQty);
            pendingQty = Number(batch.pendingQty);
            const billReserved = round2(billReserves[item.batchId] ?? 0);
            if ((linesPerBatch.get(item.batchId) ?? 0) === 1) {
              reservedQty = billReserved;
            } else {
              reservedQty = round2(Math.min(lineQty, billReserved));
            }
            shortageQty = round2(Math.max(0, lineQty - reservedQty));
            availableQty = stockQty - pendingQty + reservedQty;
          }
        }
        return {
          id: item.id,
          productId: item.productId,
          batchId: item.batchId,
          productName: item.productName,
          batchNumber: item.batchNumber,
          hsnCode: item.hsnCode,
          qty: lineQty,
          rate: Number(item.rate),
          discount: Number(item.discount),
          gstPercent: Number(item.gstPercent),
          cgstAmount: Number(item.cgstAmount),
          sgstAmount: Number(item.sgstAmount),
          igstAmount: Number(item.igstAmount),
          lineTotal: Number(item.lineTotal),
          stockQty,
          availableQty,
          pendingQty,
          reservedQty,
          shortageQty,
        };
      }),
    );

    const lineDiscountTotal = round2(items.reduce((s, i) => s + i.discount, 0));
    const rawGrandTotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));

    return {
      id: bill.id,
      billNo: bill.billNo,
      status: bill.status,
      counterId: bill.counterId,
      customerId: bill.customerId,
      customerName: bill.customer?.name,
      customerMobile: bill.customer?.mobile ?? null,
      customerGst: bill.customer?.gstNumber ?? null,
      customerPan: bill.customer?.panNumber ?? null,
      customerEmail: bill.customer?.email ?? null,
      customerAddress: bill.customer?.billingAddress ?? null,
      subtotal: Number(bill.subtotal),
      lineDiscountTotal,
      discountTotal: Number(bill.discountTotal),
      cgstTotal: Number(bill.cgstTotal),
      sgstTotal: Number(bill.sgstTotal),
      igstTotal: Number(bill.igstTotal),
      rawGrandTotal,
      roundOff: Number(bill.roundOff),
      grandTotal: Number(bill.grandTotal),
      paymentMode: bill.paymentMode,
      cashReceived: bill.cashReceived !== null ? Number(bill.cashReceived) : null,
      balanceReturn: bill.balanceReturn !== null ? Number(bill.balanceReturn) : null,
      payments: bill.payments?.map((p) => ({
        id: p.id,
        mode: p.mode,
        amount: Number(p.amount),
        reference: p.reference,
        audit: (p.auditJson as Record<string, unknown> | null) ?? null,
      })),
      items,
      invoiceNo: bill.invoice?.invoiceNo ?? null,
      commitError: bill.commitError,
    };
  }

  /** Reserved qty on a batch across all open bills, grouped by counter (for multi-counter shortage UI). */
  async getBatchStockHolds(batchId: string) {
    const batch = await this.prisma.batchStock.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        batchNumber: true,
        stockQty: true,
        pendingQty: true,
        isActive: true,
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const lines = await this.prisma.billItem.findMany({
      where: {
        batchId,
        bill: { status: { in: [BillStatus.DRAFT, BillStatus.HOLD] } },
      },
      select: {
        qty: true,
        bill: {
          select: {
            counterId: true,
            counter: { select: { id: true, name: true } },
          },
        },
      },
    });

    const byCounter = new Map<string, { counterId: string; counterName: string; reservedQty: number }>();
    for (const line of lines) {
      const cid = line.bill.counterId;
      const name = line.bill.counter?.name ?? 'Counter';
      const prev = byCounter.get(cid);
      const add = Number(line.qty);
      if (prev) prev.reservedQty += add;
      else byCounter.set(cid, { counterId: cid, counterName: name, reservedQty: add });
    }

    const stockQty = Number(batch.stockQty);
    const pendingQty = Number(batch.pendingQty);

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      stockQty,
      pendingQty,
      availableQty: stockQty - pendingQty,
      counters: [...byCounter.values()].sort((a, b) => b.reservedQty - a.reservedQty),
    };
  }

  async publishLineShortageAlert(
    billId: string,
    lineId: string,
    user: AuthUserPayload,
    attemptedQty: number,
  ) {
    const bill = await this.loadBill(billId);
    this.assertBillAccess(user, bill);
    const line = bill.items.find((i) => i.id === lineId);
    if (!line?.batchId) throw new NotFoundException('Line not found');

    const counter = await this.prisma.counter.findUnique({
      where: { id: bill.counterId },
      select: { name: true },
    });

    await this.reservations.publishShortageAlert(line.batchId, line.productId, {
      billId,
      lineId,
      counterId: bill.counterId,
      counterName: counter?.name ?? 'Counter',
      attemptedQty,
      currentLineQty: Number(line.qty),
    });

    return { ok: true };
  }

}

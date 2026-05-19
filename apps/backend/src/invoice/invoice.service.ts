import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillStatus, UserRole } from '@prisma/client';
import type { InvoiceDetailDto, InvoicePrintFormat, InvoiceTaxSummaryRow } from '@billing/shared';
import { PaymentMode } from '@billing/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { InvoicePdfService } from './invoice-pdf.service';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: InvoicePdfService,
  ) {}

  async getByBillId(billId: string, user: AuthUserPayload): Promise<InvoiceDetailDto> {
    const bill = await this.loadBillWithInvoice(billId);
    this.assertCounterAccess(user, bill.counterId);
    if (!bill.invoice) {
      throw new NotFoundException('Invoice not yet generated for this bill');
    }
    return this.mapDetail(bill);
  }

  async getByInvoiceNo(invoiceNo: string, user: AuthUserPayload): Promise<InvoiceDetailDto> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { bill: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.getByBillId(invoice.billId, user);
  }

  async lookupCompleted(
    q: string,
    user: AuthUserPayload,
    counterId?: string,
  ): Promise<
    {
      billId: string;
      invoiceNo: string;
      invoiceDate: string;
      customerName: string;
      customerMobile: string | null;
      grandTotal: number;
    }[]
  > {
    const term = q.trim();
    if (term.length < 2) return [];

    const cid =
      user.role === UserRole.CASHIER
        ? user.counterId
        : counterId ?? user.counterId;
    if (!cid) return [];

    const invoices = await this.prisma.invoice.findMany({
      where: {
        bill: {
          counterId: cid,
          status: BillStatus.COMPLETED,
        },
        OR: [
          { invoiceNo: { contains: term } },
          { bill: { customer: { name: { contains: term } } } },
          { bill: { customer: { mobile: { contains: term } } } },
        ],
      },
      include: {
        bill: { include: { customer: { select: { name: true, mobile: true } } } },
      },
      orderBy: { invoiceDate: 'desc' },
      take: 20,
    });

    return invoices.map((inv) => ({
      billId: inv.billId,
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv.invoiceDate.toISOString(),
      customerName: inv.bill.customer?.name ?? 'Walk-in Customer',
      customerMobile: inv.bill.customer?.mobile ?? null,
      grandTotal: Number(inv.bill.grandTotal),
    }));
  }

  async ensurePdf(
    billId: string,
    user: AuthUserPayload,
    format: InvoicePrintFormat = 'a4',
  ): Promise<Buffer> {
    const bill = await this.loadBillWithInvoice(billId);
    this.assertCounterAccess(user, bill.counterId);
    if (!bill.invoice) {
      throw new NotFoundException('Invoice not found');
    }

    let buffer = this.pdf.readIfExists(bill.invoice.id, format);
    if (!buffer) {
      const detail = this.mapDetail(bill);
      const filePath = await this.pdf.generate(detail, bill.invoice.id, format);
      if (format === 'a4') {
        await this.prisma.invoice.update({
          where: { id: bill.invoice.id },
          data: { pdfPath: filePath },
        });
      }
      buffer = this.pdf.readIfExists(bill.invoice.id, format);
    }

    if (!buffer) throw new NotFoundException('Could not generate PDF');
    return buffer;
  }

  async generatePdfForBill(billId: string): Promise<void> {
    const bill = await this.loadBillWithInvoice(billId);
    if (!bill.invoice || bill.status !== BillStatus.COMPLETED) return;

    const detail = this.mapDetail(bill);
    const a4Path = await this.pdf.generate(detail, bill.invoice.id, 'a4');
    await this.pdf.generate(detail, bill.invoice.id, 'thermal');
    await this.prisma.invoice.update({
      where: { id: bill.invoice.id },
      data: { pdfPath: a4Path },
    });
  }

  private async loadBillWithInvoice(billId: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id: billId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        customer: true,
        counter: true,
        invoice: { include: { company: true } },
        payments: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  private buildTaxSummary(
    items: { gstPercent: unknown; taxableAmount: unknown; cgstAmount: unknown; sgstAmount: unknown; igstAmount: unknown }[],
  ): InvoiceTaxSummaryRow[] {
    const map = new Map<number, InvoiceTaxSummaryRow>();
    for (const i of items) {
      const gst = Number(i.gstPercent);
      const row = map.get(gst) ?? { gstPercent: gst, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      row.taxable += Number(i.taxableAmount);
      row.cgst += Number(i.cgstAmount);
      row.sgst += Number(i.sgstAmount);
      row.igst += Number(i.igstAmount);
      map.set(gst, row);
    }
    return [...map.values()].sort((a, b) => a.gstPercent - b.gstPercent);
  }

  private mapDetail(
    bill: NonNullable<Awaited<ReturnType<InvoiceService['loadBillWithInvoice']>>>,
  ): InvoiceDetailDto {
    const company = bill.invoice!.company;
    const lineDiscountTotal = bill.items.reduce((s, i) => s + Number(i.discount), 0);
    const items = bill.items.map((i) => {
      const gstPercent = Number(i.gstPercent);
      return {
        productName: i.productName,
        hsnCode: i.hsnCode,
        batchNumber: i.batchNumber,
        qty: Number(i.qty),
        rate: Number(i.rate),
        discount: Number(i.discount),
        gstPercent,
        cgstPercent: gstPercent / 2,
        sgstPercent: gstPercent / 2,
        taxableAmount: Number(i.taxableAmount),
        cgstAmount: Number(i.cgstAmount),
        sgstAmount: Number(i.sgstAmount),
        igstAmount: Number(i.igstAmount),
        lineTotal: Number(i.lineTotal),
      };
    });

    return {
      billId: bill.id,
      invoiceNo: bill.invoice!.invoiceNo,
      invoiceDate: bill.invoice!.invoiceDate.toISOString(),
      isCredit: bill.isCredit,
      company: {
        name: company.name,
        address: company.address,
        gstin: company.gstin,
        pan: company.pan,
        phone: company.phone,
        email: company.email,
        footer: company.invoiceFooter,
        terms: company.invoiceTerms,
      },
      counterName: bill.counter.name,
      customer: {
        name: bill.customer?.name ?? 'Walk-in Customer',
        mobile: bill.customer?.mobile ?? null,
        email: bill.customer?.email ?? null,
        gstNumber: bill.customer?.gstNumber ?? null,
        panNumber: bill.customer?.panNumber ?? null,
        billingAddress: bill.customer?.billingAddress ?? null,
      },
      items,
      taxSummary: this.buildTaxSummary(bill.items),
      subtotal: Number(bill.subtotal),
      lineDiscountTotal,
      billDiscount: Number(bill.discountTotal),
      cgstTotal: Number(bill.cgstTotal),
      sgstTotal: Number(bill.sgstTotal),
      igstTotal: Number(bill.igstTotal),
      roundOff: Number(bill.roundOff),
      grandTotal: Number(bill.grandTotal),
      paymentMode: bill.paymentMode as PaymentMode | null,
      cashReceived: bill.cashReceived !== null ? Number(bill.cashReceived) : null,
      balanceReturn: bill.balanceReturn !== null ? Number(bill.balanceReturn) : null,
      payments: bill.payments.map((p) => ({
        mode: p.mode as PaymentMode,
        amount: Number(p.amount),
        reference: p.reference,
      })),
      pdfAvailable: Boolean(bill.invoice?.pdfPath && this.pdf.readIfExists(bill.invoice.id, 'a4')),
    };
  }

  private assertCounterAccess(user: AuthUserPayload, billCounterId: string) {
    if (user.role !== UserRole.CASHIER) return;
    if (!user.counterId || user.counterId !== billCounterId) {
      throw new ForbiddenException('Invoice belongs to another counter');
    }
  }

  private assertCustomerOwnership(
    bill: { customerId: string | null; status: BillStatus },
    customerId: string,
  ) {
    if (bill.customerId !== customerId) {
      throw new ForbiddenException('This invoice does not belong to your account');
    }
    if (bill.status !== BillStatus.COMPLETED) {
      throw new NotFoundException('Invoice not available');
    }
  }

  async getByBillIdForCustomer(
    billId: string,
    customerId: string,
  ): Promise<InvoiceDetailDto> {
    const bill = await this.loadBillWithInvoice(billId);
    this.assertCustomerOwnership(bill, customerId);
    if (!bill.invoice) {
      throw new NotFoundException('Invoice not yet generated for this bill');
    }
    return this.mapDetail(bill);
  }

  async ensurePdfForCustomer(
    billId: string,
    customerId: string,
    format: InvoicePrintFormat = 'a4',
  ): Promise<Buffer> {
    const bill = await this.loadBillWithInvoice(billId);
    this.assertCustomerOwnership(bill, customerId);
    if (!bill.invoice) {
      throw new NotFoundException('Invoice not found');
    }

    let buffer = this.pdf.readIfExists(bill.invoice.id, format);
    if (!buffer) {
      const detail = this.mapDetail(bill);
      const filePath = await this.pdf.generate(detail, bill.invoice.id, format);
      if (format === 'a4') {
        await this.prisma.invoice.update({
          where: { id: bill.invoice.id },
          data: { pdfPath: filePath },
        });
      }
      buffer = this.pdf.readIfExists(bill.invoice.id, format);
    }

    if (!buffer) throw new NotFoundException('Could not generate PDF');
    return buffer;
  }
}

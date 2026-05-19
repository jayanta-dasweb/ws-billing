import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BillStatus, CustomerType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import {
  CUSTOMER_CSRF_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  WALK_IN_CUSTOMER_ID,
} from '../auth/auth.constants';
import { CustomerAuthPayload } from '../auth/types/auth-principal.type';
import type {
  CustomerBillSummaryDto as SharedBillSummary,
  CustomerDashboardDto,
} from '@billing/shared';
import { CustomerOtpService } from './customer-otp.service';
import { InvoiceService } from '../invoice/invoice.service';

export interface SanitizedCustomer {
  id: string;
  name: string;
  mobile: string;
  needsPassword: boolean;
}

export interface CustomerAuthTokensResult {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  customer: SanitizedCustomer;
}

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly customerOtp: CustomerOtpService,
    private readonly invoices: InvoiceService,
  ) {}

  normalizeMobile(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return digits;
  }

  async lookup(mobile: string): Promise<{ name: string; needsPassword: boolean }> {
    const customer = await this.findPortalCustomer(mobile);
    if (!customer) {
      throw new NotFoundException(
        'No account for this mobile. Ask the store to add your number when you purchase.',
      );
    }
    return {
      name: customer.name,
      needsPassword: !customer.passwordHash,
    };
  }

  async setPassword(mobile: string, password: string, ipAddress?: string) {
    const customer = await this.findPortalCustomer(mobile);
    if (!customer) {
      throw new NotFoundException('No account for this mobile');
    }
    if (customer.passwordHash) {
      throw new BadRequestException('Password already set. Please sign in.');
    }
    if (!customer.mobile) {
      throw new BadRequestException('Mobile number required on your account');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash },
    });

    await this.audit.log({
      action: 'CUSTOMER_PASSWORD_SET',
      entity: 'Customer',
      entityId: customer.id,
      metadata: { mobile: updated.mobile },
      ipAddress,
    });

    return this.issueTokenPair(updated);
  }

  async requestForgotPasswordOtp(mobile: string, ipAddress?: string) {
    const customer = await this.findPortalCustomer(mobile);
    if (!customer) {
      throw new NotFoundException(
        'No account for this mobile. Ask the store to add your number when you purchase.',
      );
    }
    if (!customer.passwordHash) {
      throw new BadRequestException(
        'You have not set a password yet. Sign in with your mobile and create one on first visit.',
      );
    }
    if (!customer.mobile) {
      throw new BadRequestException('Mobile number required on your account');
    }

    const { expiresInSeconds, devOtp } = await this.customerOtp.sendPasswordResetOtp(
      customer.id,
      customer.mobile,
    );

    await this.audit.log({
      action: 'CUSTOMER_PASSWORD_RESET_OTP',
      entity: 'Customer',
      entityId: customer.id,
      metadata: { mobile: customer.mobile },
      ipAddress,
    });

    return {
      message: 'A verification code has been sent to your registered mobile number.',
      expiresInSeconds,
      ...(devOtp ? { devOtp } : {}),
    };
  }

  async resetPasswordWithOtp(
    mobile: string,
    otp: string,
    password: string,
    ipAddress?: string,
  ) {
    const customer = await this.findPortalCustomer(mobile);
    if (!customer) {
      throw new NotFoundException('No account for this mobile');
    }
    if (!customer.mobile) {
      throw new BadRequestException('Mobile number required on your account');
    }

    await this.customerOtp.verifyPasswordResetOtp(customer.id, otp);

    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash },
    });

    await this.prisma.customerRefreshToken.updateMany({
      where: { customerId: customer.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      action: 'CUSTOMER_PASSWORD_RESET',
      entity: 'Customer',
      entityId: customer.id,
      metadata: { mobile: updated.mobile },
      ipAddress,
    });

    return this.issueTokenPair(updated);
  }

  async login(mobile: string, password: string, ipAddress?: string) {
    const customer = await this.findPortalCustomer(mobile);
    if (!customer) {
      throw new UnauthorizedException('Invalid mobile or password');
    }
    if (!customer.passwordHash) {
      throw new BadRequestException('Create your password first (use the setup step).');
    }

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      await this.audit.log({
        action: 'CUSTOMER_LOGIN_FAILED',
        entity: 'Customer',
        entityId: customer.id,
        metadata: { reason: 'invalid_password' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid mobile or password');
    }

    const tokens = await this.issueTokenPair(customer);

    await this.audit.log({
      action: 'CUSTOMER_LOGIN',
      entity: 'Customer',
      entityId: customer.id,
      ipAddress,
    });

    return tokens;
  }

  async refresh(refreshTokenPlain: string, ipAddress?: string) {
    const tokenHash = this.hashToken(refreshTokenPlain);

    const stored = await this.prisma.customerRefreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { customer: true },
    });

    if (!stored || !stored.customer.isActive || !stored.customer.passwordHash) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    await this.prisma.customerRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokenPair(stored.customer);

    await this.audit.log({
      action: 'CUSTOMER_REFRESH',
      entity: 'Customer',
      entityId: stored.customer.id,
      ipAddress,
    });

    return tokens;
  }

  async logout(refreshTokenPlain: string | undefined, customerId?: string, ipAddress?: string) {
    if (refreshTokenPlain) {
      const tokenHash = this.hashToken(refreshTokenPlain);
      await this.prisma.customerRefreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (customerId) {
      await this.audit.log({
        action: 'CUSTOMER_LOGOUT',
        entity: 'Customer',
        entityId: customerId,
        ipAddress,
      });
    }
  }

  async getProfile(customerId: string): Promise<SanitizedCustomer> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !customer.isActive || customer.id === WALK_IN_CUSTOMER_ID) {
      throw new UnauthorizedException();
    }
    return this.sanitize(customer);
  }

  private completedBillWhere(customerId: string) {
    return {
      customerId,
      status: BillStatus.COMPLETED,
    };
  }

  async listBills(customerId: string, limit = 50): Promise<SharedBillSummary[]> {
    const bills = await this.prisma.bill.findMany({
      where: this.completedBillWhere(customerId),
      include: {
        invoice: { select: { invoiceNo: true } },
        _count: { select: { items: true } },
      },
      orderBy: { committedAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return bills.map((b) => this.mapBillSummary(b));
  }

  async getDashboard(customerId: string): Promise<CustomerDashboardDto> {
    const where = this.completedBillWhere(customerId);

    const [bills, itemGroups, recentRows] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        select: { grandTotal: true, committedAt: true, createdAt: true },
        orderBy: { committedAt: 'asc' },
      }),
      this.prisma.billItem.groupBy({
        by: ['productId', 'productName'],
        where: { bill: where },
        _sum: { qty: true, lineTotal: true },
        _count: { _all: true },
      }),
      this.prisma.bill.findMany({
        where,
        include: {
          invoice: { select: { invoiceNo: true } },
          _count: { select: { items: true } },
        },
        orderBy: { committedAt: 'desc' },
        take: 5,
      }),
    ]);

    const totalSpend = bills.reduce((s, b) => s + Number(b.grandTotal), 0);
    const totalBills = bills.length;
    const dates = bills
      .map((b) => b.committedAt ?? b.createdAt)
      .filter((d): d is Date => d != null);

    const topMapped = itemGroups.map((g) => ({
      productId: g.productId,
      productName: g.productName,
      totalQty: Number(g._sum.qty ?? 0),
      totalSpend: Number(g._sum.lineTotal ?? 0),
      orderCount: g._count._all,
    }));

    const topByQuantity = [...topMapped]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 8);
    const topBySpend = [...topMapped]
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 8);

    const monthMap = new Map<string, { total: number; billCount: number }>();
    for (const b of bills) {
      const d = b.committedAt ?? b.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = monthMap.get(key) ?? { total: 0, billCount: 0 };
      row.total += Number(b.grandTotal);
      row.billCount += 1;
      monthMap.set(key, row);
    }

    const monthlySpend = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, row]) => {
        const [y, m] = month.split('-').map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        });
        return {
          month,
          label,
          total: Math.round(row.total * 100) / 100,
          billCount: row.billCount,
        };
      });

    return {
      summary: {
        totalBills,
        totalSpend: Math.round(totalSpend * 100) / 100,
        averageBill: totalBills > 0 ? Math.round((totalSpend / totalBills) * 100) / 100 : 0,
        firstPurchaseAt: dates[0]?.toISOString() ?? null,
        lastPurchaseAt: dates[dates.length - 1]?.toISOString() ?? null,
      },
      topByQuantity,
      topBySpend,
      monthlySpend,
      recentBills: recentRows.map((b) => this.mapBillSummary(b)),
    };
  }

  getBillDetail(customerId: string, billId: string) {
    return this.invoices.getByBillIdForCustomer(billId, customerId);
  }

  ensureBillPdf(customerId: string, billId: string, format: 'a4' | 'thermal' = 'a4') {
    return this.invoices.ensurePdfForCustomer(billId, customerId, format);
  }

  private mapBillSummary(b: {
    id: string;
    billNo: string | null;
    status: BillStatus;
    grandTotal: unknown;
    committedAt: Date | null;
    createdAt: Date;
    invoice?: { invoiceNo: string } | null;
    _count: { items: number };
  }): SharedBillSummary {
    return {
      id: b.id,
      invoiceNo: b.invoice?.invoiceNo ?? b.billNo,
      status: b.status,
      grandTotal: Number(b.grandTotal),
      committedAt: b.committedAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
      itemCount: b._count.items,
    };
  }

  setCustomerAuthCookies(res: Response, refreshToken: string, csrfToken: string) {
    const secure = this.config.get<string>('COOKIE_SECURE', 'false') === 'true';
    const maxAge = this.parseExpiryMs(this.config.get<string>('JWT_REFRESH_EXPIRY', '7d'));

    res.cookie(CUSTOMER_REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    res.cookie(CUSTOMER_CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
  }

  clearCustomerAuthCookies(res: Response) {
    res.clearCookie(CUSTOMER_REFRESH_COOKIE, { path: '/' });
    res.clearCookie(CUSTOMER_CSRF_COOKIE, { path: '/' });
  }

  private async findPortalCustomer(mobile: string) {
    const normalized = this.normalizeMobile(mobile);
    if (normalized.length < 8) return null;

    return this.prisma.customer.findFirst({
      where: {
        isActive: true,
        id: { not: WALK_IN_CUSTOMER_ID },
        customerType: { not: CustomerType.WALK_IN },
        OR: [{ mobile: normalized }, { mobile: { endsWith: normalized } }],
      },
    });
  }

  private async issueTokenPair(
    customer: { id: string; name: string; mobile: string | null; passwordHash: string | null },
  ): Promise<CustomerAuthTokensResult> {
    if (!customer.mobile) {
      throw new BadRequestException('Mobile number required');
    }

    const payload: CustomerAuthPayload = {
      principal: 'customer',
      sub: customer.id,
      mobile: customer.mobile,
      name: customer.name,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY', '15m') as `${number}m`,
    });

    const refreshTokenPlain = randomBytes(48).toString('hex');
    const refreshExpiry = this.parseExpiryDate(
      this.config.get<string>('JWT_REFRESH_EXPIRY', '7d'),
    );
    const csrfToken = randomBytes(32).toString('hex');

    await this.prisma.customerRefreshToken.create({
      data: {
        customerId: customer.id,
        tokenHash: this.hashToken(refreshTokenPlain),
        expiresAt: refreshExpiry,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenPlain,
      csrfToken,
      customer: this.sanitize(customer),
    };
  }

  private sanitize(customer: {
    id: string;
    name: string;
    mobile: string | null;
    passwordHash: string | null;
  }): SanitizedCustomer {
    return {
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile ?? '',
      needsPassword: !customer.passwordHash,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpiryMs(expiry: string): number {
    const match = /^(\d+)([dhms])$/.exec(expiry.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      d: 86400000,
      h: 3600000,
      m: 60000,
      s: 1000,
    };
    return n * (multipliers[unit] ?? 86400000);
  }

  private parseExpiryDate(expiry: string): Date {
    return new Date(Date.now() + this.parseExpiryMs(expiry));
  }
}

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IpAllowlistService } from '../security/ip-allowlist.service';
import { CounterSessionService } from '../security/counter-session.service';
import { PermissionService } from '../security/permission.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Response } from 'express';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '../common/audit/audit-actions';
import { AuditService } from '../common/audit/audit.service';
import { AuditModule, AuditSeverity, AuditSource } from '@billing/shared';
import { AuthUserPayload } from './types/auth-user.type';
import { CSRF_COOKIE, REFRESH_COOKIE } from './auth.constants';

export interface AuthTokensResult {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: SanitizedUser;
}

export interface UserCounterDto {
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface SanitizedUser {
  id: string;
  username: string;
  role: UserRole;
  roleId: string | null;
  roleKey: string | null;
  roleName: string | null;
  counterId: string | null;
  counterName: string | null;
  counters: UserCounterDto[];
  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly ipAllowlist: IpAllowlistService,
    private readonly counterSession: CounterSessionService,
    private readonly permissionService: PermissionService,
  ) {}

  async login(
    username: string,
    password: string,
    ipAddress?: string,
  ): Promise<AuthTokensResult> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        counter: true,
        rbacRole: true,
        userCounters: {
          include: { counter: { select: { id: true, name: true } } },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!user || !user.isActive) {
      await this.audit.activity({
        action: AuditAction.LOGIN_FAILED,
        module: AuditModule.AUTH,
        subjectType: 'User',
        description: 'Login failed — unknown or inactive user',
        severity: AuditSeverity.SECURITY_ALERT,
        source: AuditSource.API,
        success: false,
        properties: { username, reason: 'invalid_credentials' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid username or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.audit.activity({
        action: AuditAction.LOGIN_FAILED,
        module: AuditModule.AUTH,
        subjectType: 'User',
        subjectId: user.id,
        userId: user.id,
        username: user.username,
        roleKey: user.rbacRole?.key ?? undefined,
        description: 'Login failed — invalid password',
        severity: AuditSeverity.SECURITY_ALERT,
        source: AuditSource.API,
        success: false,
        properties: { reason: 'invalid_password' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid username or password');
    }

    const sessionCounter = await this.resolveSessionCounter(user, ipAddress);
    const tokens = await this.issueTokenPair(user, sessionCounter);

    await this.audit.activity({
      action: AuditAction.LOGIN,
      module: AuditModule.AUTH,
      subjectType: 'User',
      subjectId: user.id,
      userId: user.id,
      username: user.username,
      roleKey: user.rbacRole?.key ?? undefined,
      counterId: sessionCounter?.counterId ?? user.counterId ?? undefined,
      description: `User ${user.username} signed in`,
      severity: AuditSeverity.INFO,
      source: AuditSource.MANUAL,
      ipAddress,
      after: {
        counterId: sessionCounter?.counterId ?? null,
        role: user.role,
      },
    });

    return tokens;
  }

  async refresh(refreshTokenPlain: string, ipAddress?: string): Promise<AuthTokensResult> {
    const tokenHash = this.hashToken(refreshTokenPlain);

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            counter: true,
            rbacRole: true,
            userCounters: {
              include: { counter: { select: { id: true, name: true } } },
              orderBy: { isPrimary: 'desc' },
            },
          },
        },
      },
    });

    if (!stored || !stored.user.isActive) {
      await this.audit.activity({
        action: AuditAction.SESSION_TIMEOUT,
        module: AuditModule.AUTH,
        subjectType: 'RefreshToken',
        description: 'Token refresh failed',
        severity: AuditSeverity.WARNING,
        success: false,
        properties: { reason: 'invalid_or_expired' },
        ipAddress,
      });
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const sessionCounter = await this.resolveSessionCounter(stored.user, ipAddress);
    const tokens = await this.issueTokenPair(stored.user, sessionCounter);

    await this.audit.activity({
      action: AuditAction.TOKEN_REFRESH,
      module: AuditModule.AUTH,
      subjectType: 'User',
      subjectId: stored.user.id,
      userId: stored.user.id,
      username: stored.user.username,
      description: 'Access token refreshed',
      source: AuditSource.API,
      ipAddress,
    });

    return tokens;
  }

  async logout(refreshTokenPlain: string | undefined, userId?: string, ipAddress?: string) {
    if (refreshTokenPlain) {
      const tokenHash = this.hashToken(refreshTokenPlain);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    if (userId) {
      await this.counterSession.releaseForUser(userId);
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { rbacRole: true },
      });
      await this.audit.activity({
        action: AuditAction.LOGOUT,
        module: AuditModule.AUTH,
        subjectType: 'User',
        subjectId: userId,
        userId,
        username: u?.username,
        roleKey: u?.rbacRole?.key ?? undefined,
        description: u ? `User ${u.username} signed out` : 'User signed out',
        source: AuditSource.MANUAL,
        ipAddress,
      });
    }
  }

  async getProfile(userId: string, activeCounterId?: string | null): Promise<SanitizedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        counter: true,
        rbacRole: true,
        userCounters: {
          include: { counter: { select: { id: true, name: true } } },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return await this.sanitizeUser(user, activeCounterId);
  }

  setAuthCookies(res: Response, refreshToken: string, csrfToken: string) {
    const secure = this.config.get<string>('COOKIE_SECURE', 'false') === 'true';
    const maxAge = this.parseExpiryMs(
      this.config.get<string>('JWT_REFRESH_EXPIRY', '7d'),
    );

    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    res.clearCookie(CSRF_COOKIE, { path: '/' });
  }

  generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
  }

  validateCsrf(cookieToken: string | undefined, headerToken: string | undefined) {
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Invalid CSRF token');
    }
  }

  private mustUseIpCounterSession(roleKey: string | null, role: UserRole): boolean {
    if (roleKey === 'super_admin' || roleKey === 'admin') return false;
    if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) return false;
    return true;
  }

  private async resolveSessionCounter(
    user: User & {
      username: string;
      role: UserRole;
      counterId: string | null;
      rbacRole: { key: string } | null;
    },
    clientIp?: string,
  ): Promise<{ counterId: string; counterName: string } | undefined> {
    const roleKey = user.rbacRole?.key ?? null;
    if (!this.mustUseIpCounterSession(roleKey, user.role)) {
      return undefined;
    }

    const resolved = await this.ipAllowlist.resolveCounterForSession(user.id, clientIp);
    if (!resolved) {
      throw new ForbiddenException(
        'No billing counter at this location. Use a counter PC on the correct network, or ask admin to assign you to this counter.',
      );
    }

    await this.counterSession.acquire(user.id, user.username, resolved.counterId);
    return resolved;
  }

  private async issueTokenPair(
    user: User & {
      counter: { name: string } | null;
      rbacRole: { id: string; key: string; name: string } | null;
      userCounters: { counterId: string; isPrimary: boolean; counter: { id: string; name: string } }[];
    },
    sessionCounter?: { counterId: string; counterName: string },
  ): Promise<AuthTokensResult> {
    const permissions = await this.permissionService.getPermissionsForUser(user.id);
    const counterIds = user.userCounters.map((uc) => uc.counterId);
    const activeCounterId = sessionCounter?.counterId ?? user.counterId;

    const payload: AuthUserPayload = {
      principal: 'staff',
      sub: user.id,
      username: user.username,
      role: user.role,
      roleId: user.roleId,
      roleKey: user.rbacRole?.key ?? null,
      counterId: activeCounterId,
      counterIds,
      permissions,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY', '15m') as `${number}m`,
    });

    const refreshTokenPlain = randomBytes(48).toString('hex');
    const refreshExpiry = this.parseExpiryDate(
      this.config.get<string>('JWT_REFRESH_EXPIRY', '7d'),
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshTokenPlain),
        expiresAt: refreshExpiry,
      },
    });

    const csrfToken = this.generateCsrfToken();

    return {
      accessToken,
      refreshToken: refreshTokenPlain,
      csrfToken,
      user: await this.sanitizeUser(user, activeCounterId ?? undefined, sessionCounter?.counterName),
    };
  }

  private async sanitizeUser(
    user: User & {
      counter: { name: string } | null;
      rbacRole?: { id: string; key: string; name: string } | null;
      userCounters?: { counterId: string; isPrimary: boolean; counter: { id: string; name: string } }[];
    },
    activeCounterId?: string | null,
    activeCounterName?: string | null,
  ): Promise<SanitizedUser> {
    const permissions = await this.permissionService.getPermissionsForUser(user.id);
    const counters =
      user.userCounters?.map((uc) => ({
        id: uc.counter.id,
        name: uc.counter.name,
        isPrimary: uc.isPrimary,
      })) ??
      (user.counter
        ? [{ id: user.counterId!, name: user.counter.name, isPrimary: true }]
        : []);

    const assignedIds = counters.map((c) => c.id);
    let counterId = user.counterId;
    let counterName = user.counter?.name ?? counters.find((c) => c.isPrimary)?.name ?? null;

    if (activeCounterId && assignedIds.includes(activeCounterId)) {
      counterId = activeCounterId;
      counterName =
        activeCounterName ?? counters.find((c) => c.id === activeCounterId)?.name ?? counterName;
    } else if (activeCounterId) {
      const row = await this.prisma.counter.findUnique({
        where: { id: activeCounterId },
        select: { name: true },
      });
      if (row) {
        counterId = activeCounterId;
        counterName = activeCounterName ?? row.name;
      }
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      roleId: user.roleId,
      roleKey: user.rbacRole?.key ?? null,
      roleName: user.rbacRole?.name ?? null,
      counterId,
      counterName,
      counters,
      permissions,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpiryMs(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] ?? multipliers.d);
  }

  private parseExpiryDate(expiry: string): Date {
    return new Date(Date.now() + this.parseExpiryMs(expiry));
  }
}

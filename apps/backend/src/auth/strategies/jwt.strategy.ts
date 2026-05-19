import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionService } from '../../security/permission.service';
import { CounterSessionService } from '../../security/counter-session.service';
import {
  AuthUserPayload,
  CustomerAuthPayload,
  isCustomerAuth,
  JwtPayload,
} from '../types/auth-principal.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly counterSession: CounterSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  private usesIpCounterSession(roleKey: string | null | undefined, role: UserRole): boolean {
    if (roleKey === 'super_admin' || roleKey === 'admin') return false;
    if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) return false;
    return true;
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (isCustomerAuth(payload)) {
      return this.validateCustomer(payload);
    }
    return this.validateStaff(payload);
  }

  private async validateCustomer(payload: CustomerAuthPayload): Promise<CustomerAuthPayload> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.sub },
    });
    if (!customer || !customer.isActive || !customer.passwordHash || !customer.mobile) {
      throw new UnauthorizedException();
    }
    return {
      principal: 'customer',
      sub: customer.id,
      mobile: customer.mobile,
      name: customer.name,
    };
  }

  private async validateStaff(payload: AuthUserPayload): Promise<AuthUserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        rbacRole: true,
        userCounters: { select: { counterId: true } },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const permissions = await this.permissionService.getPermissionsForUser(user.id);
    const counterIds = user.userCounters.map((uc) => uc.counterId);
    const roleKey = user.rbacRole?.key ?? payload.roleKey ?? null;

    let counterId = payload.counterId ?? user.counterId;

    if (this.usesIpCounterSession(roleKey, user.role)) {
      if (!counterId || !counterIds.includes(counterId)) {
        throw new UnauthorizedException('Invalid counter session. Please sign in again.');
      }
      await this.counterSession.assertHolder(counterId, user.id);
      await this.counterSession.refresh(counterId, user.id);
    }

    return {
      principal: 'staff',
      sub: user.id,
      username: user.username,
      role: user.role,
      roleId: user.roleId,
      roleKey,
      counterId,
      counterIds,
      permissions,
    };
  }
}

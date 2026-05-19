import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { IS_CUSTOMER_ONLY_KEY } from '../../common/decorators/customer-only.decorator';
import { isCustomerAuth, type JwtPayload } from '../types/auth-principal.type';

@Injectable()
export class StaffOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isCustomerOnly = this.reflector.getAllAndOverride<boolean>(IS_CUSTOMER_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isCustomerOnly) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (user && isCustomerAuth(user)) {
      throw new ForbiddenException('Staff access only');
    }
    return true;
  }
}

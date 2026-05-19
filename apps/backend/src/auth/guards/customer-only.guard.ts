import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isCustomerAuth, type JwtPayload } from '../types/auth-principal.type';

@Injectable()
export class CustomerOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!user || !isCustomerAuth(user)) {
      throw new ForbiddenException('Customer sign-in required');
    }
    return true;
  }
}

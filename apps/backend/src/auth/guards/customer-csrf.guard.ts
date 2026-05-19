import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { CUSTOMER_CSRF_COOKIE, CSRF_HEADER } from '../auth.constants';

@Injectable()
export class CustomerCsrfGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      cookies?: Record<string, string>;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const cookieToken = req.cookies?.[CUSTOMER_CSRF_COOKIE];
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;
    this.authService.validateCsrf(cookieToken, headerToken);
    return true;
  }
}

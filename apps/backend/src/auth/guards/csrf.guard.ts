import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { CSRF_COOKIE, CSRF_HEADER, REFRESH_COOKIE } from '../auth.constants';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (!req.cookies?.[REFRESH_COOKIE]) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;
    this.authService.validateCsrf(cookieToken, headerToken);
    return true;
  }
}

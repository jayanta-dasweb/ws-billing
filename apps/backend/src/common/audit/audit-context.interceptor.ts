import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { isStaffAuth, type JwtPayload } from '../../auth/types/auth-principal.type';
import { auditContextStorage, type AuditRequestContext } from './audit-context';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const ctx: AuditRequestContext = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 512),
      requestSource: 'web_api',
    };

    const user = req.user;
    if (user && isStaffAuth(user)) {
      ctx.userId = user.sub;
      ctx.username = user.username;
      ctx.roleKey = user.roleKey ?? undefined;
      ctx.counterId = user.counterId ?? undefined;
      ctx.sessionId = user.sub;
    }

    return new Observable((subscriber) => {
      auditContextStorage.run(ctx, () => {
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/** Do not wrap binary / file downloads in `{ success, data }` JSON. */
function shouldPassThrough(data: unknown): boolean {
  if (data instanceof StreamableFile) return true;
  if (Buffer.isBuffer(data)) return true;
  return false;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (shouldPassThrough(data)) return data;
        return {
          success: true,
          message: 'OK',
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}

import { AsyncLocalStorage } from 'async_hooks';

export interface AuditRequestContext {
  ipAddress?: string;
  userAgent?: string;
  requestSource?: string;
  sessionId?: string;
  userId?: string;
  username?: string;
  roleKey?: string;
  counterId?: string;
}

export const auditContextStorage = new AsyncLocalStorage<AuditRequestContext>();

export function getAuditContext(): AuditRequestContext | undefined {
  return auditContextStorage.getStore();
}

export function runWithAuditContext<T>(ctx: AuditRequestContext, fn: () => T): T {
  return auditContextStorage.run(ctx, fn);
}

import type { AuditModule, AuditSeverity, AuditSource } from '@billing/shared';

export interface ActivityLogParams {
  action: string;
  module: AuditModule | string;
  /** Subject type (entity name), e.g. Bill, User, Product */
  subjectType: string;
  subjectId?: string;
  description?: string;
  severity?: AuditSeverity;
  source?: AuditSource;
  success?: boolean;
  userId?: string;
  username?: string;
  roleKey?: string;
  counterId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestSource?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  properties?: Record<string, unknown>;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  batchUuid?: string;
}

/** @deprecated Use ActivityLogParams — kept for existing audit.log() calls */
export interface LegacyAuditLogParams {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

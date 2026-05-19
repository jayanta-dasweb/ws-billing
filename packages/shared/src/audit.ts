/** Spatie Activity Log–style audit trail (immutable, append-only). */

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  SECURITY_ALERT = 'SECURITY_ALERT',
}

export enum AuditSource {
  MANUAL = 'MANUAL',
  SYSTEM = 'SYSTEM',
  SCHEDULED = 'SCHEDULED',
  API = 'API',
}

/** High-level module (like Spatie log name / subject area). */
export enum AuditModule {
  AUTH = 'auth',
  BILLING = 'billing',
  INVENTORY = 'inventory',
  MASTERS = 'masters',
  SECURITY = 'security',
  RETURNS = 'returns',
  INVOICE = 'invoice',
  SYSTEM = 'system',
  CUSTOMER_PORTAL = 'customer_portal',
}

export const AUDIT_SEVERITY_COLORS: Record<
  AuditSeverity,
  { badge: string; row: string; label: string }
> = {
  [AuditSeverity.INFO]: { badge: 'success', row: 'audit-row--info', label: 'Info' },
  [AuditSeverity.WARNING]: { badge: 'warning', row: 'audit-row--warning', label: 'Warning' },
  [AuditSeverity.CRITICAL]: { badge: 'danger', row: 'audit-row--critical', label: 'Critical' },
  [AuditSeverity.SECURITY_ALERT]: {
    badge: 'dark',
    row: 'audit-row--security',
    label: 'Security',
  },
};

export interface ActivityLogDto {
  id: string;
  action: string;
  module: string;
  severity: AuditSeverity;
  source: AuditSource;
  success: boolean;
  description: string | null;
  subjectType: string;
  subjectId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  userId: string | null;
  username: string | null;
  roleKey: string | null;
  counterId: string | null;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestSource: string | null;
  beforeData: unknown;
  afterData: unknown;
  properties: unknown;
  reason: string | null;
  batchUuid: string | null;
  createdAt: string;
}

export interface ActivityLogListResult {
  data: ActivityLogDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ActivityLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  module?: string;
  action?: string;
  severity?: AuditSeverity;
  source?: AuditSource;
  userId?: string;
  username?: string;
  counterId?: string;
  subjectType?: string;
  subjectId?: string;
  referenceType?: string;
  referenceId?: string;
  success?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

/** Infer default severity from action code prefix. */
export function inferAuditSeverity(action: string, success = true): AuditSeverity {
  if (!success) return AuditSeverity.WARNING;
  const a = action.toUpperCase();
  if (
    a.includes('FAILED') ||
    a.includes('BLOCKED') ||
    a.includes('SUSPICIOUS') ||
    a.includes('UNAUTHORIZED')
  ) {
    return AuditSeverity.SECURITY_ALERT;
  }
  if (
    a.includes('LOGIN_FAILED') ||
    a.includes('NEGATIVE_STOCK') ||
    a.includes('OVERRIDE') ||
    a.includes('VOID') ||
    a.includes('CANCEL')
  ) {
    return AuditSeverity.WARNING;
  }
  if (a.includes('DELETE') || a.includes('PERMISSION') || a.includes('ROLE_CHANGE')) {
    return AuditSeverity.CRITICAL;
  }
  return AuditSeverity.INFO;
}

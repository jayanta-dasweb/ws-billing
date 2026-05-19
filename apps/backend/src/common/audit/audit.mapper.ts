import type { ActivityLogDto } from '@billing/shared';
import type { AuditLog, User } from '@prisma/client';

type Row = AuditLog & { user?: Pick<User, 'username'> | null };

export function mapAuditRow(r: Row): ActivityLogDto {
  return {
    id: r.id,
    action: r.action,
    module: r.module,
    severity: r.severity as ActivityLogDto['severity'],
    source: r.source as ActivityLogDto['source'],
    success: r.success,
    description: r.description,
    subjectType: r.entity,
    subjectId: r.entityId,
    referenceType: r.referenceType,
    referenceId: r.referenceId,
    userId: r.userId,
    username: r.username ?? r.user?.username ?? null,
    roleKey: r.roleKey,
    counterId: r.counterId,
    sessionId: r.sessionId,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    requestSource: r.requestSource,
    beforeData: r.beforeData,
    afterData: r.afterData,
    properties: r.properties ?? r.metadata,
    reason: r.reason,
    batchUuid: r.batchUuid,
    createdAt: r.createdAt.toISOString(),
  };
}

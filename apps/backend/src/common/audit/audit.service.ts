import { Injectable, Logger } from '@nestjs/common';
import { AuditSeverity, AuditSource, inferAuditSeverity } from '@billing/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getAuditContext } from './audit-context';
import type { ActivityLogParams, LegacyAuditLogParams } from './activity-log.params';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Spatie-style activity log — append-only, never updated.
   */
  async activity(params: ActivityLogParams): Promise<void> {
    try {
      const ctx = getAuditContext();
      const success = params.success ?? true;
      const severity = params.severity ?? inferAuditSeverity(params.action, success);
      const module =
        typeof params.module === 'string' ? params.module : String(params.module);

      await this.prisma.auditLog.create({
        data: {
          userId: params.userId ?? ctx?.userId,
          username: params.username ?? ctx?.username,
          roleKey: params.roleKey ?? ctx?.roleKey,
          counterId: params.counterId ?? ctx?.counterId,
          sessionId: params.sessionId ?? ctx?.sessionId,
          action: params.action,
          module,
          entity: params.subjectType,
          entityId: params.subjectId,
          severity,
          source: params.source ?? AuditSource.MANUAL,
          success,
          description: params.description,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          beforeData: params.before
            ? (params.before as Prisma.InputJsonValue)
            : undefined,
          afterData: params.after ? (params.after as Prisma.InputJsonValue) : undefined,
          properties: params.properties
            ? (params.properties as Prisma.InputJsonValue)
            : undefined,
          metadata: params.properties
            ? (params.properties as Prisma.InputJsonValue)
            : undefined,
          reason: params.reason,
          ipAddress: params.ipAddress ?? ctx?.ipAddress,
          userAgent: params.userAgent ?? ctx?.userAgent,
          requestSource: params.requestSource ?? ctx?.requestSource ?? 'web_api',
          batchUuid: params.batchUuid,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write activity log', err);
    }
  }

  /** System / background job events */
  async systemActivity(
    params: Omit<ActivityLogParams, 'source' | 'userId'> & { userId?: string },
  ): Promise<void> {
    return this.activity({
      ...params,
      source: AuditSource.SYSTEM,
      requestSource: params.requestSource ?? 'system',
    });
  }

  /** Failed operation — always logged */
  async failure(params: ActivityLogParams): Promise<void> {
    return this.activity({
      ...params,
      success: false,
      severity: params.severity ?? AuditSeverity.WARNING,
    });
  }

  /** Backward-compatible wrapper for existing services */
  async log(params: LegacyAuditLogParams): Promise<void> {
    const ctx = getAuditContext();
    return this.activity({
      action: params.action,
      module: params.entity.toLowerCase(),
      subjectType: params.entity,
      subjectId: params.entityId,
      userId: params.userId,
      ipAddress: params.ipAddress,
      properties: params.metadata,
      description: `${params.action} on ${params.entity}`,
    });
  }
}

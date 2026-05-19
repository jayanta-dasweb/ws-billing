import { Prisma } from '@prisma/client';
import type { AuditQueryDto } from './dto/audit-query.dto';

export function buildAuditWhere(query: AuditQueryDto): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.module) where.module = query.module;
  if (query.action) where.action = { contains: query.action };
  if (query.severity) where.severity = query.severity;
  if (query.source) where.source = query.source;
  if (query.userId) where.userId = query.userId;
  if (query.username) where.username = { contains: query.username };
  if (query.counterId) where.counterId = query.counterId;
  if (query.subjectType) where.entity = query.subjectType;
  if (query.subjectId) where.entityId = query.subjectId;
  if (query.referenceType) where.referenceType = query.referenceType;
  if (query.referenceId) where.referenceId = query.referenceId;
  if (query.success !== undefined) where.success = query.success;

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (query.search?.trim()) {
    const s = query.search.trim();
    where.OR = [
      { action: { contains: s } },
      { description: { contains: s } },
      { entity: { contains: s } },
      { entityId: { contains: s } },
      { username: { contains: s } },
      { referenceId: { contains: s } },
      { reason: { contains: s } },
    ];
  }

  return where;
}

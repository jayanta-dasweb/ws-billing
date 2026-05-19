import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AuditQueryDto } from './dto/audit-query.dto';
import { buildAuditWhere } from './audit-query.util';
import { mapAuditRow } from './audit.mapper';

@ApiTags('Audit / Activity Log')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  @RequirePermissions('audit.log.view')
  @ApiOperation({ summary: 'Search immutable activity log (Spatie-style)' })
  async list(@Query() query: AuditQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = buildAuditWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { username: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: rows.map(mapAuditRow),
      total,
      page,
      limit,
    };
  }

  @Get('logs/export')
  @RequirePermissions('audit.log.view')
  @ApiOperation({ summary: 'Export filtered audit log as CSV' })
  async exportCsv(@Query() query: AuditQueryDto, @Res() res: Response) {
    const where = buildAuditWhere(query);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: { user: { select: { username: true } } },
    });

    const header =
      'id,createdAt,severity,source,success,module,action,description,username,roleKey,counterId,subjectType,subjectId,referenceType,referenceId,ipAddress,reason\n';
    const lines = rows.map((r) => {
      const dto = mapAuditRow(r);
      const esc = (v: string | null | undefined) =>
        `"${String(v ?? '').replace(/"/g, '""')}"`;
      return [
        dto.id,
        dto.createdAt,
        dto.severity,
        dto.source,
        dto.success,
        dto.module,
        dto.action,
        esc(dto.description),
        esc(dto.username),
        esc(dto.roleKey),
        esc(dto.counterId),
        dto.subjectType,
        esc(dto.subjectId),
        esc(dto.referenceType),
        esc(dto.referenceId),
        esc(dto.ipAddress),
        esc(dto.reason),
      ].join(',');
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-trail-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(header + lines.join('\n'));
  }

  @Get('logs/:id')
  @RequirePermissions('audit.log.view')
  async getOne(@Param('id') id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: { username: true } } },
    });
    if (!row) throw new NotFoundException('Activity log not found');
    return mapAuditRow(row);
  }

  @Get('timeline')
  @RequirePermissions('audit.log.view')
  @ApiOperation({ summary: 'Timeline for a subject (bill, user, product, etc.)' })
  async timeline(
    @Query('subjectType') subjectType: string,
    @Query('subjectId') subjectId: string,
    @Query('limit') limitStr?: string,
  ) {
    if (!subjectType || !subjectId) {
      return { data: [] };
    }
    const limit = Math.min(limitStr ? parseInt(limitStr, 10) : 100, 200);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: subjectType, entityId: subjectId },
          { referenceType: subjectType, referenceId: subjectId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { user: { select: { username: true } } },
    });
    return { data: rows.map(mapAuditRow) };
  }

  @Get('meta/filters')
  @RequirePermissions('audit.log.view')
  async filterOptions() {
    const [modules, actions] = await Promise.all([
      this.prisma.auditLog.findMany({
        distinct: ['module'],
        select: { module: true },
        orderBy: { module: 'asc' },
        take: 50,
      }),
      this.prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
        take: 100,
      }),
    ]);
    return {
      modules: modules.map((m) => m.module),
      actions: actions.map((a) => a.action),
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { ipMatchesRule } from './utils/ip-matcher.util';

@Injectable()
export class IpAllowlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  isEnforced(): boolean {
    return this.config.get<string>('IP_ALLOWLIST_ENFORCED', 'true') === 'true';
  }

  async listByCounter(counterId: string) {
    await this.assertCounter(counterId);
    return this.prisma.counterIpRule.findMany({
      where: { counterId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    counterId: string,
    data: { cidr: string; label?: string; isActive?: boolean },
    userId: string,
    ip?: string,
  ) {
    await this.assertCounter(counterId);
    const row = await this.prisma.counterIpRule.create({
      data: { counterId, cidr: data.cidr.trim(), label: data.label, isActive: data.isActive ?? true },
    });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'CounterIpRule',
      entityId: row.id,
      metadata: { counterId, cidr: row.cidr },
      ipAddress: ip,
    });
    return row;
  }

  async update(
    id: string,
    data: Prisma.CounterIpRuleUpdateInput,
    userId: string,
    ip?: string,
  ) {
    const row = await this.prisma.counterIpRule.update({ where: { id }, data });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'CounterIpRule',
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }

  async isIpAllowedForCounter(counterId: string, clientIp?: string): Promise<boolean> {
    if (!this.isEnforced()) return true;

    const rules = await this.prisma.counterIpRule.findMany({
      where: { counterId, isActive: true },
    });
    if (rules.length === 0) return true;

    const ip = clientIp ?? '';
    return rules.some((r) => ipMatchesRule(ip, r.cidr));
  }

  /** Pick the counter for this login from IP rules + user assignments. */
  async resolveCounterForSession(
    userId: string,
    clientIp?: string,
  ): Promise<{ counterId: string; counterName: string } | null> {
    const assignments = await this.prisma.userCounter.findMany({
      where: { userId },
      include: { counter: { select: { id: true, name: true, isActive: true } } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    const active = assignments.filter((a) => a.counter.isActive);

    if (active.length === 0) {
      const legacy = await this.legacyUserCounter(userId);
      if (!legacy) return null;
      if (this.isEnforced() && !(await this.isIpAllowedForCounter(legacy.counterId, clientIp))) {
        return null;
      }
      return legacy;
    }

    if (!this.isEnforced()) {
      const pick = active.find((a) => a.isPrimary) ?? active[0];
      return { counterId: pick.counterId, counterName: pick.counter.name };
    }

    const matched: typeof active = [];
    for (const a of active) {
      if (await this.isIpAllowedForCounter(a.counterId, clientIp)) {
        matched.push(a);
      }
    }

    if (matched.length === 0) {
      return null;
    }

    const pick = matched.find((a) => a.isPrimary) ?? matched[0];
    return { counterId: pick.counterId, counterName: pick.counter.name };
  }

  private async legacyUserCounter(
    userId: string,
  ): Promise<{ counterId: string; counterName: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { counter: { select: { id: true, name: true, isActive: true } } },
    });
    if (!user?.counterId || !user.counter?.isActive) return null;
    return { counterId: user.counterId, counterName: user.counter.name };
  }

  private async assertCounter(counterId: string) {
    const c = await this.prisma.counter.findUnique({ where: { id: counterId } });
    if (!c) throw new NotFoundException('Counter not found');
  }
}


import { Injectable } from '@nestjs/common';
import { BillStatus, ReturnStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDaySummary() {
    const from = startOfToday();

    const [sales, returns, openBills, adjustments] = await Promise.all([
      this.prisma.bill.aggregate({
        where: {
          status: BillStatus.COMPLETED,
          committedAt: { gte: from },
        },
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
      this.prisma.salesReturn.aggregate({
        where: {
          status: ReturnStatus.COMPLETED,
          completedAt: { gte: from },
        },
        _count: { _all: true },
        _sum: { refundTotal: true },
      }),
      this.prisma.bill.count({
        where: {
          status: {
            in: [
              BillStatus.DRAFT,
              BillStatus.HOLD,
              BillStatus.PENDING_COMMIT,
              BillStatus.COMMITTING,
            ],
          },
        },
      }),
      this.prisma.stockAdjustment.count({
        where: { createdAt: { gte: from } },
      }),
    ]);

    const salesByCounter = await this.prisma.bill.groupBy({
      by: ['counterId'],
      where: {
        status: BillStatus.COMPLETED,
        committedAt: { gte: from },
      },
      _count: { _all: true },
      _sum: { grandTotal: true },
    });

    const counterIds = salesByCounter.map((r) => r.counterId).filter(Boolean) as string[];
    const counters =
      counterIds.length > 0
        ? await this.prisma.counter.findMany({
            where: { id: { in: counterIds } },
            select: { id: true, name: true },
          })
        : [];
    const counterName = new Map(counters.map((c) => [c.id, c.name]));

    return {
      date: from.toISOString().slice(0, 10),
      sales: {
        billCount: sales._count._all,
        grossTotal: Number(sales._sum.grandTotal ?? 0),
      },
      returns: {
        count: returns._count._all,
        refundTotal: Number(returns._sum.refundTotal ?? 0),
      },
      netSales:
        Number(sales._sum.grandTotal ?? 0) - Number(returns._sum.refundTotal ?? 0),
      openBills,
      adjustmentsToday: adjustments,
      byCounter: salesByCounter.map((row) => ({
        counterId: row.counterId,
        counterName: row.counterId ? (counterName.get(row.counterId) ?? row.counterId) : '—',
        billCount: row._count._all,
        grossTotal: Number(row._sum.grandTotal ?? 0),
      })),
    };
  }
}

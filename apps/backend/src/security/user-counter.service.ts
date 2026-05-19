import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserCounterService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssignments(userId: string) {
    return this.prisma.userCounter.findMany({
      where: { userId },
      include: { counter: { select: { id: true, name: true, isActive: true } } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async setAssignments(userId: string, counterIds: string[], primaryCounterId?: string) {
    const unique = [...new Set(counterIds.filter(Boolean))];
    const primary =
      primaryCounterId && unique.includes(primaryCounterId)
        ? primaryCounterId
        : unique[0] ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.userCounter.deleteMany({ where: { userId } });
      if (unique.length) {
        await tx.userCounter.createMany({
          data: unique.map((counterId) => ({
            userId,
            counterId,
            isPrimary: counterId === primary,
          })),
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: { counterId: primary },
      });
    });

    return this.getAssignments(userId);
  }
}

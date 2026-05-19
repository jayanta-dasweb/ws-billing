import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BillCommitProducer } from '../queue/bill-commit.producer';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly billQueue: BillCommitProducer,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check — DB, Redis, Queue' })
  async check() {
    const [db, redisPing, queue] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'error'),
      this.redis.ping().then(() => 'ok').catch(() => 'error'),
      this.billQueue.getQueueStats().catch(() => null),
    ]);

    const healthy = db === 'ok' && redisPing === 'ok';

    return {
      status: healthy ? 'healthy' : 'degraded',
      services: { database: db, redis: redisPing, queue },
    };
  }
}

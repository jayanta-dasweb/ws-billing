import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

const COUNTER_KEY = (counterId: string) => `counter:active:${counterId}`;
const USER_KEY = (userId: string) => `user:counter:session:${userId}`;

interface CounterLockPayload {
  userId: string;
  username: string;
}

@Injectable()
export class CounterSessionService {
  private readonly ttlSec: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttlSec = parseInt(config.get<string>('COUNTER_SESSION_TTL_SEC', '28800'), 10);
  }

  async acquire(userId: string, username: string, counterId: string): Promise<void> {
    const client = this.redis.getClient();
    const userKey = USER_KEY(userId);
    const previousCounter = await client.get(userKey);
    if (previousCounter && previousCounter !== counterId) {
      await this.releaseCounter(previousCounter, userId);
    }

    const counterKey = COUNTER_KEY(counterId);
    const existing = await client.get(counterKey);
    if (existing) {
      const holder = JSON.parse(existing) as CounterLockPayload;
      if (holder.userId !== userId) {
        throw new ForbiddenException(
          `Counter is in use by ${holder.username}. Log out on that machine or wait for their session to end.`,
        );
      }
      await client.setex(counterKey, this.ttlSec, existing);
    } else {
      const payload: CounterLockPayload = { userId, username };
      const ok = await client.set(
        counterKey,
        JSON.stringify(payload),
        'EX',
        this.ttlSec,
        'NX',
      );
      if (ok !== 'OK') {
        const retry = await client.get(counterKey);
        if (retry) {
          const holder = JSON.parse(retry) as CounterLockPayload;
          if (holder.userId !== userId) {
            throw new ForbiddenException(
              `Counter is in use by ${holder.username}. Log out on that machine or wait for their session to end.`,
            );
          }
        }
      }
    }

    await client.setex(userKey, this.ttlSec, counterId);
  }

  async assertHolder(counterId: string, userId: string): Promise<void> {
    const client = this.redis.getClient();
    const raw = await client.get(COUNTER_KEY(counterId));
    if (!raw) {
      throw new ForbiddenException('Counter session expired. Please sign in again.');
    }
    const holder = JSON.parse(raw) as CounterLockPayload;
    if (holder.userId !== userId) {
      throw new ForbiddenException(
        `Counter is in use by ${holder.username}. Sign in again from your counter machine.`,
      );
    }
  }

  async refresh(counterId: string, userId: string): Promise<void> {
    const client = this.redis.getClient();
    const counterKey = COUNTER_KEY(counterId);
    const raw = await client.get(counterKey);
    if (!raw) return;
    const holder = JSON.parse(raw) as CounterLockPayload;
    if (holder.userId !== userId) return;
    await client.setex(counterKey, this.ttlSec, raw);
    await client.setex(USER_KEY(userId), this.ttlSec, counterId);
  }

  /** Counters with an active signed-in cashier (Redis session). */
  async listOnlineCounters(): Promise<
    { counterId: string; userId: string; username: string }[]
  > {
    const client = this.redis.getClient();
    const keys = await client.keys('counter:active:*');
    const out: { counterId: string; userId: string; username: string }[] = [];
    for (const key of keys) {
      const raw = await client.get(key);
      if (!raw) continue;
      const holder = JSON.parse(raw) as CounterLockPayload;
      const counterId = key.replace('counter:active:', '');
      out.push({
        counterId,
        userId: holder.userId,
        username: holder.username,
      });
    }
    return out;
  }

  async getHolder(
    counterId: string,
  ): Promise<{ userId: string; username: string } | null> {
    const client = this.redis.getClient();
    const raw = await client.get(COUNTER_KEY(counterId));
    if (!raw) return null;
    return JSON.parse(raw) as CounterLockPayload;
  }

  async releaseForUser(userId: string): Promise<void> {
    const client = this.redis.getClient();
    const counterId = await client.get(USER_KEY(userId));
    if (counterId) {
      await this.releaseCounter(counterId, userId);
    }
    await client.del(USER_KEY(userId));
  }

  private async releaseCounter(counterId: string, userId: string): Promise<void> {
    const client = this.redis.getClient();
    const counterKey = COUNTER_KEY(counterId);
    const raw = await client.get(counterKey);
    if (!raw) return;
    const holder = JSON.parse(raw) as CounterLockPayload;
    if (holder.userId === userId) {
      await client.del(counterKey);
    }
  }
}

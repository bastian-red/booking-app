import { Injectable } from '@nestjs/common';
import type { HealthDto } from '@booking/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const WORKER_STALE_MS = 60_000;

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthDto> {
    const [db, redis, heartbeat] = await Promise.all([
      this.checkDb(),
      this.redis.ping(),
      this.redis.workerHeartbeat().catch(() => null),
    ]);
    const worker = heartbeat != null && Date.now() - heartbeat < WORKER_STALE_MS;
    const coreUp = db && redis;
    return {
      status: coreUp && worker ? 'ok' : 'degraded',
      db,
      redis,
      worker,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

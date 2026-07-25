import { Injectable } from '@nestjs/common';
import type { HealthDto } from '@booking/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { withTimeout } from './with-timeout';

const WORKER_STALE_MS = 60_000;
const CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthDto> {
    // Each dependency check is bounded so a hung dependency can't stall /health.
    const [db, redis, heartbeat] = await Promise.all([
      withTimeout(this.checkDb(), false, CHECK_TIMEOUT_MS),
      withTimeout(this.redis.ping(), false, CHECK_TIMEOUT_MS),
      withTimeout(this.redis.workerHeartbeat(), null, CHECK_TIMEOUT_MS),
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

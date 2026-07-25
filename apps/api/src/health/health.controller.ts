import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { HealthService } from './health.service';

// Monitoring must never be rate limited — Updown and the uptime probe poll this
// on a fixed interval and a 429 would read as a false outage.
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // A green health check with a dead dependency behind it is a bug: return 503
  // whenever Postgres or Redis is unreachable, so Updown flags it.
  @Get('health')
  async check(@Res() res: Response): Promise<void> {
    const result = await this.health.check();
    const httpOk = result.db && result.redis;
    res.status(httpOk ? 200 : 503).json(result);
  }
}

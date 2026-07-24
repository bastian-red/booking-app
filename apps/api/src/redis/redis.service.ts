import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

/** Lua: delete the key only if it still holds our token (safe release). */
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end`;

export const WORKER_HEARTBEAT_KEY = 'worker:heartbeat';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(url: string) {
    // maxRetriesPerRequest: null keeps ioredis compatible with BullMQ semantics
    // and avoids throwing on transient reconnects.
    this.client = new Redis(url, { maxRetriesPerRequest: null });
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Acquire a short-lived lock. Returns a release token, or null if the lock is
   * already held. Serializes concurrent booking attempts on the same slot so the
   * loser gets a clean 409 instead of racing the DB exclusion constraint.
   */
  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const res = await this.client.set(key, token, 'PX', ttlMs, 'NX');
    return res === 'OK' ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    await this.client.eval(RELEASE_SCRIPT, 1, key, token);
  }

  /** Read the worker heartbeat timestamp (ms epoch), or null if absent. */
  async workerHeartbeat(): Promise<number | null> {
    const v = await this.client.get(WORKER_HEARTBEAT_KEY);
    return v ? Number(v) : null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

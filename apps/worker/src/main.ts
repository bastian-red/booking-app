import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { getPrisma } from '@booking/db';
import { NotificationService, createSmtpChannel, smtpConfigFromEnv } from '@booking/notifications';
import { handleConfirmation, handleReminder, handleExpire, type WorkerDeps } from './handlers';

const BOOKING_QUEUE = 'bookings';
const WORKER_HEARTBEAT_KEY = 'worker:heartbeat';
const HEARTBEAT_INTERVAL_MS = 15_000;

function main(): void {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const heartbeatRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });

  const deps: WorkerDeps = {
    prisma: getPrisma(),
    notifications: new NotificationService(createSmtpChannel(smtpConfigFromEnv())),
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  };

  const worker = new Worker(
    BOOKING_QUEUE,
    async (job) => {
      const { bookingId } = job.data as { bookingId: string };
      switch (job.name) {
        case 'confirmation':
          return handleConfirmation(deps, bookingId);
        case 'reminder':
          return handleReminder(deps, bookingId);
        case 'expire':
          return handleExpire(deps, bookingId);
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    { connection, concurrency: 5 },
  );

  worker.on('completed', (job, result) => {
    console.log(`[worker] ${job.name} ${job.id} -> ${JSON.stringify(result)}`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[worker] ${job?.name} ${job?.id} failed:`, err.message);
  });

  // Heartbeat so the API /health can report worker liveness.
  const beat = async () => {
    try {
      await heartbeatRedis.set(WORKER_HEARTBEAT_KEY, String(Date.now()), 'EX', 60);
    } catch (err) {
      console.error('[worker] heartbeat failed:', (err as Error).message);
    }
  };
  void beat();
  const timer = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS);

  const shutdown = async () => {
    clearInterval(timer);
    await worker.close();
    await connection.quit();
    await heartbeatRedis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  console.log('[worker] listening on queue:', BOOKING_QUEUE);
}

main();

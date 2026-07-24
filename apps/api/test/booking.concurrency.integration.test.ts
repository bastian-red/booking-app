/**
 * Integration test for the anti-double-booking guarantee. Requires a real
 * Postgres (with the exclusion-constraint migration applied) and Redis.
 * Run via `pnpm --filter @booking/api test:integration` after `docker compose up`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPaymentsService } from '@booking/payments';
import { isBookingOverlapError } from '@booking/db';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { QueueService } from '../src/queue/queue.service';
import { SlotsService } from '../src/slots/slots.service';
import { BookingsService } from '../src/bookings/bookings.service';
import type { AppConfig } from '../src/config/config';

const prisma = new PrismaService();
const redis = new RedisService(process.env.REDIS_URL ?? 'redis://localhost:6379');
const queue = new QueueService(redis.client);
const slots = new SlotsService(prisma);
const payments = createPaymentsService({ enabled: false });
const config = {
  appBaseUrl: 'http://localhost:3000',
  reminderLeadMinutes: 1440,
  pendingExpiryMinutes: 15,
} as AppConfig;
const bookings = new BookingsService(prisma, redis, queue, slots, payments, config);

const suffix = Date.now();
let hostId = '';
let eventTypeId = '';
// A round-hour slot three days out (host tz = UTC, all-day availability).
const slotStart = new Date();
slotStart.setUTCDate(slotStart.getUTCDate() + 3);
slotStart.setUTCHours(10, 0, 0, 0);

beforeAll(async () => {
  await prisma.$connect();
  const host = await prisma.user.create({
    data: {
      email: `concurrency+${suffix}@test.local`,
      name: 'Concurrency Host',
      passwordHash: 'x',
      timezone: 'UTC',
    },
  });
  hostId = host.id;
  // Available every day, all day, so the chosen slot is valid.
  await prisma.availabilityRule.createMany({
    data: Array.from({ length: 7 }, (_, d) => ({
      hostId,
      dayOfWeek: d,
      startMinute: 0,
      endMinute: 1440,
    })),
  });
  const et = await prisma.eventType.create({
    data: {
      hostId,
      title: 'Free Slot',
      slug: `free-${suffix}`,
      durationMinutes: 60,
      priceCents: 0,
      currency: 'usd',
    },
  });
  eventTypeId = et.id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
  await prisma.eventType.deleteMany({ where: { hostId } });
  await prisma.availabilityRule.deleteMany({ where: { hostId } });
  await prisma.user.deleteMany({ where: { id: hostId } });
  await queue.onModuleDestroy();
  await redis.onModuleDestroy();
  await prisma.$disconnect();
});

describe('booking concurrency', () => {
  it('allows exactly one booking when N clients race for the same slot', async () => {
    const N = 12;
    const attempts = Array.from({ length: N }, (_, i) =>
      bookings.create({
        eventTypeId,
        startUtc: slotStart.toISOString(),
        guestName: `Guest ${i}`,
        guestEmail: `guest${i}+${suffix}@test.local`,
        guestTimezone: 'UTC',
      }),
    );

    const results = await Promise.allSettled(attempts);
    const confirmed = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(confirmed).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);

    // Exactly one non-cancelled booking exists for that slot in the DB.
    const rows = await prisma.booking.findMany({
      where: { hostId, startUtc: slotStart, status: { not: 'CANCELLED' } },
    });
    expect(rows).toHaveLength(1);
  });

  it('rejects a direct overlapping insert at the database level', async () => {
    const start = new Date(slotStart.getTime() + 60 * 60 * 1000); // +1h, still valid
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    await prisma.booking.create({
      data: {
        eventTypeId,
        hostId,
        guestName: 'Direct A',
        guestEmail: `direct-a+${suffix}@test.local`,
        guestTimezone: 'UTC',
        startUtc: start,
        endUtc: end,
        status: 'CONFIRMED',
        priceCents: 0,
        currency: 'usd',
      },
    });

    // Overlapping insert (offset by 30m) must violate the exclusion constraint.
    const overlapping = prisma.booking.create({
      data: {
        eventTypeId,
        hostId,
        guestName: 'Direct B',
        guestEmail: `direct-b+${suffix}@test.local`,
        guestTimezone: 'UTC',
        startUtc: new Date(start.getTime() + 30 * 60 * 1000),
        endUtc: new Date(end.getTime() + 30 * 60 * 1000),
        status: 'CONFIRMED',
        priceCents: 0,
        currency: 'usd',
      },
    });

    let caught: unknown;
    try {
      await overlapping;
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBookingOverlapError(caught)).toBe(true);
  });
});

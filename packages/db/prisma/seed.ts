/**
 * Seed a demo host with availability + one free and one paid event type.
 * Password for demo@booking.local is "password123".
 * Idempotent: safe to run repeatedly.
 */
import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

// Mirror of the hash format used by the web auth layer (scrypt).
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

async function main() {
  const host = await prisma.user.upsert({
    where: { email: 'demo@booking.local' },
    update: {},
    create: {
      email: 'demo@booking.local',
      name: 'Demo Host',
      passwordHash: hashPassword('password123'),
      timezone: 'America/Santiago',
    },
  });

  // Weekly availability: Mon-Fri 09:00-17:00 (host local time).
  await prisma.availabilityRule.deleteMany({ where: { hostId: host.id } });
  for (let day = 1; day <= 5; day++) {
    await prisma.availabilityRule.create({
      data: { hostId: host.id, dayOfWeek: day, startMinute: 9 * 60, endMinute: 17 * 60 },
    });
  }

  await prisma.eventType.upsert({
    where: { hostId_slug: { hostId: host.id, slug: 'intro-call' } },
    update: {},
    create: {
      hostId: host.id,
      title: 'Intro Call',
      slug: 'intro-call',
      description: 'A free 30-minute introductory call.',
      durationMinutes: 30,
      priceCents: 0,
      currency: 'usd',
      bufferBeforeMin: 0,
      bufferAfterMin: 10,
    },
  });

  await prisma.eventType.upsert({
    where: { hostId_slug: { hostId: host.id, slug: 'consulting' } },
    update: {},
    create: {
      hostId: host.id,
      title: 'Consulting Session',
      slug: 'consulting',
      description: 'A paid 60-minute consulting session.',
      durationMinutes: 60,
      priceCents: 5000,
      currency: 'usd',
      bufferBeforeMin: 15,
      bufferAfterMin: 15,
    },
  });

  console.log(`Seeded host ${host.email} with 2 event types and Mon-Fri availability.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

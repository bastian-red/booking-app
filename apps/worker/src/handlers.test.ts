import { describe, it, expect } from 'vitest';
import { NotificationService, type EmailMessage, type NotificationChannel } from '@booking/notifications';
import { handleConfirmation, handleReminder, handleExpire, type WorkerDeps } from './handlers';

interface Row {
  id: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  startUtc: Date;
  status: string;
  reminderSentAt: Date | null;
  cancelledAt: Date | null;
  eventType: { title: string; durationMinutes: number };
  host: { name: string };
}

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'bk_1',
    guestName: 'Ana',
    guestEmail: 'ana@example.com',
    guestTimezone: 'UTC',
    startUtc: new Date('2026-01-05T10:00:00Z'),
    status: 'CONFIRMED',
    reminderSentAt: null,
    cancelledAt: null,
    eventType: { title: 'Intro Call', durationMinutes: 30 },
    host: { name: 'Demo Host' },
    ...overrides,
  };
}

function fakeDeps(row: Row | null) {
  const sent: EmailMessage[] = [];
  const channel: NotificationChannel = { send: async (m) => void sent.push(m) };
  const store = { row };
  const prisma = {
    booking: {
      findUnique: async () => store.row,
      update: async ({ data }: { data: Partial<Row> }) => {
        if (store.row) store.row = { ...store.row, ...data };
        return store.row;
      },
    },
  };
  const deps: WorkerDeps = {
    prisma: prisma as unknown as WorkerDeps['prisma'],
    notifications: new NotificationService(channel),
    appBaseUrl: 'https://booking.example.com',
  };
  return { deps, sent, store };
}

describe('handleExpire', () => {
  it('cancels a pending booking', async () => {
    const { deps, store } = fakeDeps(makeRow({ status: 'PENDING_PAYMENT' }));
    expect(await handleExpire(deps, 'bk_1')).toBe('cancelled');
    expect(store.row?.status).toBe('CANCELLED');
    expect(store.row?.cancelledAt).toBeInstanceOf(Date);
  });

  it('skips a confirmed booking', async () => {
    const { deps, store } = fakeDeps(makeRow({ status: 'CONFIRMED' }));
    expect(await handleExpire(deps, 'bk_1')).toBe('skipped');
    expect(store.row?.status).toBe('CONFIRMED');
  });
});

describe('handleReminder', () => {
  it('sends and records the reminder for a confirmed booking', async () => {
    const { deps, sent, store } = fakeDeps(makeRow({ status: 'CONFIRMED' }));
    expect(await handleReminder(deps, 'bk_1')).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain('Reminder');
    expect(store.row?.reminderSentAt).toBeInstanceOf(Date);
  });

  it('skips a pending booking', async () => {
    const { deps, sent } = fakeDeps(makeRow({ status: 'PENDING_PAYMENT' }));
    expect(await handleReminder(deps, 'bk_1')).toBe('skipped');
    expect(sent).toHaveLength(0);
  });
});

describe('handleConfirmation', () => {
  it('sends for a confirmed booking', async () => {
    const { deps, sent } = fakeDeps(makeRow({ status: 'CONFIRMED' }));
    expect(await handleConfirmation(deps, 'bk_1')).toBe('sent');
    expect(sent[0]!.subject).toContain('Confirmed');
  });

  it('skips a cancelled booking', async () => {
    const { deps, sent } = fakeDeps(makeRow({ status: 'CANCELLED' }));
    expect(await handleConfirmation(deps, 'bk_1')).toBe('skipped');
    expect(sent).toHaveLength(0);
  });

  it('skips a missing booking', async () => {
    const { deps } = fakeDeps(null);
    expect(await handleConfirmation(deps, 'missing')).toBe('skipped');
  });
});

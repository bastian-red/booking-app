import { describe, it, expect } from 'vitest';
import {
  renderConfirmation,
  renderReminder,
  NotificationService,
  smtpConfigFromEnv,
  createLogChannel,
  createChannelFromEnv,
  type BookingEmailData,
  type EmailMessage,
  type NotificationChannel,
} from './index';

const data: BookingEmailData = {
  guestName: 'Ana',
  guestEmail: 'ana@example.com',
  guestTimezone: 'Asia/Tokyo',
  hostName: 'Demo Host',
  eventTitle: 'Intro Call',
  startUtc: new Date('2026-01-05T14:00:00Z'), // 23:00 in Tokyo
  durationMinutes: 30,
  bookingId: 'bk_1',
  appBaseUrl: 'https://booking.example.com',
};

describe('renderConfirmation', () => {
  it('addresses the guest and includes the event + localized time', () => {
    const msg = renderConfirmation(data);
    expect(msg.to).toBe('ana@example.com');
    expect(msg.subject).toContain('Intro Call');
    expect(msg.text).toContain('Ana');
    expect(msg.text).toContain('Intro Call');
    // 14:00 UTC displayed in Tokyo (UTC+9) = 23:00.
    expect(msg.text).toContain('23:00');
    expect(msg.text).toContain('Asia/Tokyo');
    expect(msg.html).toContain('https://booking.example.com/booking/bk_1');
  });
});

describe('renderReminder', () => {
  it('formats the reminder time in the guest tz', () => {
    const msg = renderReminder(data);
    expect(msg.subject).toContain('23:00');
    expect(msg.text).toContain('reminder');
  });
});

describe('NotificationService', () => {
  it('sends confirmation through the channel', async () => {
    const sent: EmailMessage[] = [];
    const channel: NotificationChannel = { send: async (m) => void sent.push(m) };
    const svc = new NotificationService(channel);
    await svc.sendConfirmation(data);
    await svc.sendReminder(data);
    expect(sent).toHaveLength(2);
    expect(sent[0]!.subject).toContain('Confirmed');
    expect(sent[1]!.subject).toContain('Reminder');
  });
});

describe('smtpConfigFromEnv', () => {
  it('defaults to Mailhog', () => {
    const cfg = smtpConfigFromEnv({});
    expect(cfg.host).toBe('localhost');
    expect(cfg.port).toBe(1025);
    expect(cfg.secure).toBe(false);
  });
});

describe('createLogChannel', () => {
  it('logs instead of delivering and never throws', async () => {
    const seen: EmailMessage[] = [];
    const channel = createLogChannel((m) => void seen.push(m));
    await expect(channel.send(renderConfirmation(data))).resolves.toBeUndefined();
    expect(seen).toHaveLength(1);
    expect(seen[0]!.to).toBe('ana@example.com');
  });
});

describe('createChannelFromEnv', () => {
  it('falls back to the log channel when SMTP_HOST is unset (prod without a mail server)', async () => {
    const channel = createChannelFromEnv({});
    // Resolves without any SMTP server reachable — a missing mail server cannot fail a job.
    await expect(channel.send(renderConfirmation(data))).resolves.toBeUndefined();
  });

  it('treats a blank SMTP_HOST as unset', async () => {
    const channel = createChannelFromEnv({ SMTP_HOST: '   ' });
    await expect(channel.send(renderConfirmation(data))).resolves.toBeUndefined();
  });

  it('uses SMTP when SMTP_HOST is configured', () => {
    // Building the transport does not open a connection, so this is safe offline.
    const channel = createChannelFromEnv({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587' });
    expect(typeof channel.send).toBe('function');
  });
});

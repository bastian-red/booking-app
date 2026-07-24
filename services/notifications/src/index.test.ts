import { describe, it, expect } from 'vitest';
import {
  renderConfirmation,
  renderReminder,
  NotificationService,
  smtpConfigFromEnv,
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

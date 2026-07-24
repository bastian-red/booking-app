import { formatInTimeZone } from 'date-fns-tz';
import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * A delivery channel. Email is the only implementation for now; an SMS channel
 * can implement the same interface later (project brief keeps SMS pluggable).
 */
export interface NotificationChannel {
  send(msg: EmailMessage): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export function smtpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SmtpConfig {
  return {
    host: env.SMTP_HOST ?? 'localhost',
    port: Number(env.SMTP_PORT ?? '1025'),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || undefined,
    pass: env.SMTP_PASS || undefined,
    from: env.MAIL_FROM ?? 'Booking <no-reply@booking.local>',
  };
}

/** Nodemailer-backed email channel. Dev points at Mailhog (localhost:1025). */
export function createSmtpChannel(config: SmtpConfig): NotificationChannel {
  const transporter: Transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  return {
    async send(msg: EmailMessage): Promise<void> {
      await transporter.sendMail({
        from: config.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
    },
  };
}

export interface BookingEmailData {
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  hostName: string;
  eventTitle: string;
  startUtc: Date;
  durationMinutes: number;
  bookingId: string;
  appBaseUrl: string;
}

function prettyTime(startUtc: Date, tz: string): string {
  // e.g. "Mon, 05 Jan 2026, 09:00 (America/Santiago)"
  return `${formatInTimeZone(startUtc, tz, 'EEE, dd MMM yyyy, HH:mm')} (${tz})`;
}

/** Pure: renders the confirmation email. */
export function renderConfirmation(data: BookingEmailData): EmailMessage {
  const when = prettyTime(data.startUtc, data.guestTimezone);
  const manageUrl = `${data.appBaseUrl}/booking/${data.bookingId}`;
  const subject = `Confirmed: ${data.eventTitle} on ${formatInTimeZone(
    data.startUtc,
    data.guestTimezone,
    'dd MMM',
  )}`;
  const text = [
    `Hi ${data.guestName},`,
    ``,
    `Your booking with ${data.hostName} is confirmed.`,
    ``,
    `Event: ${data.eventTitle}`,
    `When: ${when}`,
    `Duration: ${data.durationMinutes} minutes`,
    ``,
    `Manage your booking: ${manageUrl}`,
  ].join('\n');
  const html = `
    <h2>Booking confirmed</h2>
    <p>Hi ${data.guestName},</p>
    <p>Your booking with <strong>${data.hostName}</strong> is confirmed.</p>
    <ul>
      <li><strong>Event:</strong> ${data.eventTitle}</li>
      <li><strong>When:</strong> ${when}</li>
      <li><strong>Duration:</strong> ${data.durationMinutes} minutes</li>
    </ul>
    <p><a href="${manageUrl}">Manage your booking</a></p>
  `.trim();
  return { to: data.guestEmail, subject, html, text };
}

/** Pure: renders the reminder email. */
export function renderReminder(data: BookingEmailData): EmailMessage {
  const when = prettyTime(data.startUtc, data.guestTimezone);
  const subject = `Reminder: ${data.eventTitle} at ${formatInTimeZone(
    data.startUtc,
    data.guestTimezone,
    'HH:mm',
  )}`;
  const text = [
    `Hi ${data.guestName},`,
    ``,
    `This is a reminder for your upcoming booking with ${data.hostName}.`,
    ``,
    `Event: ${data.eventTitle}`,
    `When: ${when}`,
  ].join('\n');
  const html = `
    <h2>Upcoming booking reminder</h2>
    <p>Hi ${data.guestName},</p>
    <p>A reminder for your booking with <strong>${data.hostName}</strong>.</p>
    <ul>
      <li><strong>Event:</strong> ${data.eventTitle}</li>
      <li><strong>When:</strong> ${when}</li>
    </ul>
  `.trim();
  return { to: data.guestEmail, subject, html, text };
}

export class NotificationService {
  constructor(private readonly channel: NotificationChannel) {}

  sendConfirmation(data: BookingEmailData): Promise<void> {
    return this.channel.send(renderConfirmation(data));
  }

  sendReminder(data: BookingEmailData): Promise<void> {
    return this.channel.send(renderReminder(data));
  }
}

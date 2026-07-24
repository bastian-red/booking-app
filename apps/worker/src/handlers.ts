import type { PrismaClient } from '@booking/db';
import { NotificationService, type BookingEmailData } from '@booking/notifications';

export interface WorkerDeps {
  prisma: PrismaClient;
  notifications: NotificationService;
  appBaseUrl: string;
}

type BookingWithRelations = {
  id: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  startUtc: Date;
  status: string;
  eventType: { title: string; durationMinutes: number };
  host: { name: string };
};

function toEmailData(b: BookingWithRelations, appBaseUrl: string): BookingEmailData {
  return {
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    guestTimezone: b.guestTimezone,
    hostName: b.host.name,
    eventTitle: b.eventType.title,
    startUtc: b.startUtc,
    durationMinutes: b.eventType.durationMinutes,
    bookingId: b.id,
    appBaseUrl,
  };
}

function loadBooking(deps: WorkerDeps, id: string) {
  return deps.prisma.booking.findUnique({
    where: { id },
    include: { eventType: true, host: true },
  }) as unknown as Promise<BookingWithRelations | null>;
}

/** Send the confirmation email for a booking. */
export async function handleConfirmation(deps: WorkerDeps, bookingId: string): Promise<'sent' | 'skipped'> {
  const booking = await loadBooking(deps, bookingId);
  if (!booking || booking.status === 'CANCELLED') return 'skipped';
  await deps.notifications.sendConfirmation(toEmailData(booking, deps.appBaseUrl));
  return 'sent';
}

/** Send the reminder email if the booking is still confirmed; record it. */
export async function handleReminder(deps: WorkerDeps, bookingId: string): Promise<'sent' | 'skipped'> {
  const booking = await loadBooking(deps, bookingId);
  if (!booking || booking.status !== 'CONFIRMED') return 'skipped';
  await deps.notifications.sendReminder(toEmailData(booking, deps.appBaseUrl));
  await deps.prisma.booking.update({
    where: { id: bookingId },
    data: { reminderSentAt: new Date() },
  });
  return 'sent';
}

/** Cancel a booking that is still awaiting payment, freeing its slot. */
export async function handleExpire(deps: WorkerDeps, bookingId: string): Promise<'cancelled' | 'skipped'> {
  const booking = await deps.prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== 'PENDING_PAYMENT') return 'skipped';
  await deps.prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  return 'cancelled';
}

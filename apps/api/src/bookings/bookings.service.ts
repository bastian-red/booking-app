import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isBookingOverlapError, type Booking, type BookingStatus } from '@booking/db';
import type { PaymentsService } from '@booking/payments';
import type { BookingDto, CreateBookingInput } from '@booking/shared';
import { CONFIG, type AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { QueueService } from '../queue/queue.service';
import { PAYMENTS } from '../core/core.module';
import { SlotsService } from '../slots/slots.service';

const LOCK_TTL_MS = 10_000;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queue: QueueService,
    private readonly slots: SlotsService,
    @Inject(PAYMENTS) private readonly payments: PaymentsService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private toDto(booking: Booking, checkoutUrl?: string): BookingDto {
    return {
      id: booking.id,
      status: booking.status as BookingStatus,
      eventTypeId: booking.eventTypeId,
      startUtc: booking.startUtc.toISOString(),
      endUtc: booking.endUtc.toISOString(),
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestTimezone: booking.guestTimezone,
      priceCents: booking.priceCents,
      currency: booking.currency,
      ...(checkoutUrl ? { checkoutUrl } : {}),
    };
  }

  async create(input: CreateBookingInput): Promise<BookingDto> {
    const startUtc = new Date(input.startUtc);
    const eventType = await this.slots.getEventType(input.eventTypeId);
    const endUtc = new Date(startUtc.getTime() + eventType.durationMinutes * 60_000);

    // Reject off-grid / out-of-availability / already-taken starts early.
    const bookable = await this.slots.isBookableStart(eventType, startUtc, input.guestTimezone);
    if (!bookable) {
      throw new ConflictException('This time is not available.');
    }

    const needsPayment =
      this.payments.isEnabled() && (eventType.priceCents ?? 0) > 0;
    const priceCents = needsPayment ? (eventType.priceCents ?? 0) : 0;

    const lockKey = `lock:${eventType.hostId}:${startUtc.toISOString()}`;
    const token = await this.redis.acquireLock(lockKey, LOCK_TTL_MS);
    if (!token) {
      throw new ConflictException('This time is being booked by someone else.');
    }

    try {
      let booking: Booking;
      try {
        booking = await this.prisma.booking.create({
          data: {
            eventTypeId: eventType.id,
            hostId: eventType.hostId,
            guestName: input.guestName,
            guestEmail: input.guestEmail,
            guestTimezone: input.guestTimezone,
            startUtc,
            endUtc,
            status: needsPayment ? 'PENDING_PAYMENT' : 'CONFIRMED',
            priceCents,
            currency: eventType.currency,
          },
        });
      } catch (err) {
        if (isBookingOverlapError(err)) {
          throw new ConflictException('This time was just taken.');
        }
        throw err;
      }

      if (needsPayment) {
        const session = await this.payments.createCheckoutSession({
          bookingId: booking.id,
          eventTitle: eventType.title,
          priceCents,
          currency: eventType.currency,
          guestEmail: input.guestEmail,
          successUrl: `${this.config.appBaseUrl}/booking/${booking.id}?paid=1`,
          cancelUrl: `${this.config.appBaseUrl}/booking/${booking.id}?cancelled=1`,
        });
        booking = await this.prisma.booking.update({
          where: { id: booking.id },
          data: { stripeSessionId: session.sessionId },
        });
        // Free the slot if the guest never pays.
        await this.queue.enqueueExpiry(booking.id, this.config.pendingExpiryMinutes * 60_000);
        return this.toDto(booking, session.url);
      }

      // Free event: confirmed immediately.
      await this.scheduleConfirmedNotifications(booking);
      return this.toDto(booking);
    } finally {
      await this.redis.releaseLock(lockKey, token);
    }
  }

  /** Enqueue the confirmation email now and the reminder at start - lead. */
  private async scheduleConfirmedNotifications(booking: Booking): Promise<void> {
    await this.queue.enqueueConfirmation(booking.id);
    const reminderAt = booking.startUtc.getTime() - this.config.reminderLeadMinutes * 60_000;
    await this.queue.enqueueReminder(booking.id, reminderAt - Date.now());
  }

  /** Called by the payment webhook: promote a paid booking to CONFIRMED. */
  async confirmPaid(bookingId: string, paymentIntentId?: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status !== 'PENDING_PAYMENT') return;
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED', stripePaymentIntentId: paymentIntentId ?? null },
    });
    await this.scheduleConfirmedNotifications(updated);
  }

  async getById(id: string): Promise<BookingDto> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.toDto(booking);
  }

  async listByHost(hostId: string): Promise<BookingDto[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { hostId },
      orderBy: { startUtc: 'asc' },
    });
    return bookings.map((b) => this.toDto(b));
  }
}

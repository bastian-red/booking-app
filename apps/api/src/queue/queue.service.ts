import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export const BOOKING_QUEUE = 'bookings';

export type BookingJobName = 'confirmation' | 'reminder' | 'expire';
export interface BookingJobData {
  bookingId: string;
}

/**
 * Producer side of the booking job queue. The worker app consumes these:
 *  - confirmation: send the confirmation email now
 *  - reminder: send the reminder email (scheduled with a delay)
 *  - expire: cancel the booking if still unpaid (scheduled with a delay)
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue: Queue<BookingJobData, void, BookingJobName>;

  constructor(connection: Redis) {
    this.queue = new Queue(BOOKING_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  enqueueConfirmation(bookingId: string): Promise<unknown> {
    return this.queue.add('confirmation', { bookingId });
  }

  /** Schedule a reminder `delayMs` from now. Skips if delay is not positive. */
  async enqueueReminder(bookingId: string, delayMs: number): Promise<void> {
    if (delayMs <= 0) return;
    await this.queue.add('reminder', { bookingId }, { delay: delayMs });
  }

  /** Schedule an expiry check for an unpaid booking. */
  async enqueueExpiry(bookingId: string, delayMs: number): Promise<void> {
    await this.queue.add('expire', { bookingId }, { delay: Math.max(delayMs, 0) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

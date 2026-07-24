import { PrismaClient } from '@prisma/client';

// Re-export generated types + enums so consumers import everything from @booking/db.
export * from '@prisma/client';
export { PrismaClient };

/**
 * Postgres error code for an exclusion-constraint / unique violation.
 * 23P01 = exclusion_violation (our booking overlap guard),
 * 23505 = unique_violation.
 */
export const PG_EXCLUSION_VIOLATION = '23P01';
export const PG_UNIQUE_VIOLATION = '23505';

/** Name of the GiST exclusion constraint that prevents overlapping bookings. */
export const BOOKING_NO_OVERLAP_CONSTRAINT = 'bookings_no_overlap';

let prisma: PrismaClient | undefined;

/**
 * Singleton PrismaClient. Reused across hot-reloads / imports so we do not
 * exhaust the connection pool in dev.
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/** True when the thrown error is the booking-overlap exclusion violation. */
export function isBookingOverlapError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === PG_EXCLUSION_VIOLATION) return true;
  // Prisma wraps raw errors; the constraint name may appear in the message.
  const message = (err as { message?: string })?.message ?? '';
  return message.includes(BOOKING_NO_OVERLAP_CONSTRAINT);
}

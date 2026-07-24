'use server';

import { createBookingSchema } from '@booking/shared';
import { publicApiFetch, ApiError } from '@/lib/api';

export type BookingResult =
  | { ok: true; id: string; checkoutUrl?: string }
  | { ok: false; error: string };

export async function createGuestBooking(input: unknown): Promise<BookingResult> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid booking details' };
  }
  try {
    const booking = await publicApiFetch<{ id: string; checkoutUrl?: string }>('/public/bookings', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    return { ok: true, id: booking.id, checkoutUrl: booking.checkoutUrl };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    throw err;
  }
}

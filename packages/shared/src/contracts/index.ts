import { z } from 'zod';
import { passwordSchema } from '../auth/password-strength';

/** IANA timezone sanity check (not exhaustive, but rejects obvious garbage). */
export const timezoneSchema = z
  .string()
  .min(1)
  .refine((tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid IANA timezone');

export const bookingStatusSchema = z.enum(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED']);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

// ---- Auth ----
export const signupSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(120),
  timezone: timezoneSchema.default('UTC'),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---- Event types ----
export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case');

export const eventTypeInputSchema = z.object({
  title: z.string().min(1).max(120),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(5).max(480),
  priceCents: z.number().int().min(0).max(1_000_000).nullable().default(0),
  currency: z.string().length(3).toLowerCase().default('usd'),
  bufferBeforeMin: z.number().int().min(0).max(240).default(0),
  bufferAfterMin: z.number().int().min(0).max(240).default(0),
  isActive: z.boolean().default(true),
});
export type EventTypeInput = z.infer<typeof eventTypeInputSchema>;

// ---- Availability ----
export const availabilityRuleSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(0).max(1440),
  })
  .refine((r) => r.endMinute > r.startMinute, 'endMinute must be after startMinute');
export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;

export const setAvailabilitySchema = z.object({
  timezone: timezoneSchema,
  rules: z.array(availabilityRuleSchema).max(50),
});
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;

// ---- Slots query ----
export const slotsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  tz: timezoneSchema,
});
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;

export interface SlotDto {
  startUtc: string;
  endUtc: string;
  startInGuestTz: string;
}

// ---- Booking ----
export const createBookingSchema = z.object({
  eventTypeId: z.string().min(1),
  // Absolute UTC instant of the desired slot start.
  startUtc: z.string().datetime({ offset: true }),
  guestName: z.string().min(1).max(120),
  guestEmail: z.string().email(),
  guestTimezone: timezoneSchema,
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export interface BookingDto {
  id: string;
  status: BookingStatus;
  eventTypeId: string;
  startUtc: string;
  endUtc: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  priceCents: number;
  currency: string;
  /** Present when payment is required: redirect the guest here. */
  checkoutUrl?: string;
}

export interface HealthDto {
  status: 'ok' | 'degraded';
  db: boolean;
  redis: boolean;
  worker: boolean;
  uptimeSeconds: number;
}

export const PUBLIC_EVENT_PATH = (host: string, slug: string) => `/event-types/${host}/${slug}`;

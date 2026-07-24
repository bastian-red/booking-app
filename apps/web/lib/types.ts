export interface EventType {
  id: string;
  hostId: string;
  title: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
  currency: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  isActive: boolean;
}

export interface PublicEventType extends EventType {
  hostName: string;
  hostTimezone: string;
}

export interface Availability {
  timezone: string;
  rules: { dayOfWeek: number; startMinute: number; endMinute: number }[];
}

export interface Booking {
  id: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';
  eventTypeId: string;
  startUtc: string;
  endUtc: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  priceCents: number;
  currency: string;
  checkoutUrl?: string;
}

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatPrice(cents: number | null, currency: string): string {
  if (!cents) return 'Free';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(
    cents / 100,
  );
}

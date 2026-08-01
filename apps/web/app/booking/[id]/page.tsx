import { Nav } from '@/components/nav';
import { publicApiFetch, ApiError } from '@/lib/api';
import { formatPrice, type Booking } from '@/lib/types';

/**
 * The confirmation, shaped like a receipt.
 *
 * This is the page a guest screenshots, or comes back to a week later to check
 * what time they agreed to. So the time is the largest thing on it, the
 * timezone is printed next to the time rather than assumed, and the whole thing
 * reads top to bottom as a record rather than as an app screen.
 */
export default async function BookingStatusPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { paid?: string; cancelled?: string };
}) {
  let booking: Booking;
  try {
    booking = await publicApiFetch<Booking>(`/public/bookings/${params.id}`);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Booking not found';
    return (
      <>
        <Nav />
        <main className="container" id="main">
          <div className="card error">{message}</div>
        </main>
      </>
    );
  }

  const start = new Date(booking.startUtc);
  // Rendered in the timezone the guest booked in, not the server's and not the
  // reader's: the appointment happens at a fixed instant, and the only useful
  // wall clock is the one the guest agreed to.
  const localTime = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: booking.guestTimezone,
  }).format(start);

  const status = {
    CONFIRMED: { badge: 'badge-ok', label: 'Confirmed', heading: "You're booked" },
    PENDING_PAYMENT: {
      badge: 'badge-warn',
      label: 'Payment pending',
      heading: 'Almost there',
    },
    CANCELLED: { badge: 'badge-err', label: 'Cancelled', heading: 'Booking cancelled' },
  }[booking.status];

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main className="container" id="main">
        <article className="receipt">
          <header className="receipt-head">
            <span className={`badge ${status.badge}`}>{status.label}</span>
            <h1>{status.heading}</h1>
            {booking.status === 'PENDING_PAYMENT' && searchParams.cancelled && (
              <p className="muted small" style={{ marginTop: 'var(--s-3)' }}>
                Payment was cancelled. This slot is held briefly, then released.
              </p>
            )}
          </header>

          <dl className="receipt-body">
            <div className="receipt-row">
              <dt>When</dt>
              <dd className="receipt-when">
                <time dateTime={booking.startUtc}>{localTime}</time>
              </dd>
            </div>
            <div className="receipt-row">
              <dt>Timezone</dt>
              <dd>{booking.guestTimezone}</dd>
            </div>
            <div className="receipt-row">
              <dt>Guest</dt>
              <dd>
                {booking.guestName}
                <br />
                <span className="muted">{booking.guestEmail}</span>
              </dd>
            </div>
            <div className="receipt-row">
              <dt>Price</dt>
              <dd>{formatPrice(booking.priceCents, booking.currency)}</dd>
            </div>
          </dl>

          {booking.status === 'CONFIRMED' && (
            <p className="muted small center" style={{ padding: '0 var(--s-6) var(--s-6)' }}>
              A confirmation email is on its way. See you then.
            </p>
          )}
        </article>
      </main>
    </>
  );
}

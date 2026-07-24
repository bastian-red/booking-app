import { Nav } from '@/components/nav';
import { publicApiFetch, ApiError } from '@/lib/api';
import { formatPrice, type Booking } from '@/lib/types';

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
        <div className="container">
          <div className="card error">{message}</div>
        </div>
      </>
    );
  }

  const start = new Date(booking.startUtc);
  const localTime = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: booking.guestTimezone,
  }).format(start);

  return (
    <>
      <Nav />
      <div className="container">
        <div className="card">
          {booking.status === 'CONFIRMED' && (
            <>
              <span className="badge badge-ok">confirmed</span>
              <h1>You&apos;re booked! 🎉</h1>
            </>
          )}
          {booking.status === 'PENDING_PAYMENT' && (
            <>
              <span className="badge badge-warn">payment pending</span>
              <h1>Almost there</h1>
              {searchParams.cancelled && (
                <p className="muted">Payment was cancelled. This slot is held briefly, then released.</p>
              )}
            </>
          )}
          {booking.status === 'CANCELLED' && (
            <>
              <span className="badge badge-err">cancelled</span>
              <h1>Booking cancelled</h1>
            </>
          )}
          <p>
            <strong>When:</strong> {localTime} ({booking.guestTimezone})
          </p>
          <p>
            <strong>Guest:</strong> {booking.guestName} ({booking.guestEmail})
          </p>
          <p>
            <strong>Price:</strong> {formatPrice(booking.priceCents, booking.currency)}
          </p>
          {booking.status === 'CONFIRMED' && (
            <p className="muted">A confirmation email is on its way. See you then!</p>
          )}
        </div>
      </div>
    </>
  );
}

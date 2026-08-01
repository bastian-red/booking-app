import { apiFetch } from '@/lib/api';
import { formatPrice, type Booking } from '@/lib/types';

function statusBadge(status: Booking['status']) {
  if (status === 'CONFIRMED') return <span className="badge badge-ok">Confirmed</span>;
  if (status === 'PENDING_PAYMENT') return <span className="badge badge-warn">Pending</span>;
  return <span className="badge badge-err">Cancelled</span>;
}

export default async function BookingsPage() {
  const bookings = await apiFetch<Booking[]>('/bookings');

  return (
    <>
      <div className="section-head">
        <h2>Bookings</h2>
      </div>

      {bookings.length === 0 ? (
        <div className="empty">
          <p>No bookings yet.</p>
          <p className="small">They will appear here as guests book your event types.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <caption className="sr-only">
                Every booking on your calendar, in UTC, with the guest and their timezone
              </caption>
              <thead>
                <tr>
                  {/* UTC on purpose. This is the host's operational view and the
                      guests are in many zones, so one absolute clock is the only
                      column that can be compared row to row. Each guest's own
                      zone is in its own column beside it. */}
                  <th scope="col">When (UTC)</th>
                  <th scope="col">Guest</th>
                  <th scope="col">Guest timezone</th>
                  <th scope="col">Price</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <time dateTime={b.startUtc}>
                        {new Date(b.startUtc).toISOString().replace('T', ' ').slice(0, 16)}
                      </time>
                    </td>
                    <td>
                      {b.guestName}
                      <br />
                      <span className="muted">{b.guestEmail}</span>
                    </td>
                    <td>{b.guestTimezone}</td>
                    <td>{formatPrice(b.priceCents, b.currency)}</td>
                    <td>{statusBadge(b.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

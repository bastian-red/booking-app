import { apiFetch } from '@/lib/api';
import { formatPrice, type Booking } from '@/lib/types';

function statusBadge(status: Booking['status']) {
  if (status === 'CONFIRMED') return <span className="badge badge-ok">confirmed</span>;
  if (status === 'PENDING_PAYMENT') return <span className="badge badge-warn">pending</span>;
  return <span className="badge badge-err">cancelled</span>;
}

export default async function BookingsPage() {
  const bookings = await apiFetch<Booking[]>('/bookings');

  return (
    <>
      <h2>Bookings</h2>
      {bookings.length === 0 ? (
        <div className="card muted">No bookings yet.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>When (UTC)</th>
                <th>Guest</th>
                <th>Guest tz</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{new Date(b.startUtc).toISOString().replace('T', ' ').slice(0, 16)}</td>
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
      )}
    </>
  );
}

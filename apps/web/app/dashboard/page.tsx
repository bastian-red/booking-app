import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatPrice, type EventType } from '@/lib/types';
import { deleteEventType } from './actions';

export default async function DashboardPage() {
  const eventTypes = await apiFetch<EventType[]>('/event-types');

  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Your event types</h2>
        <Link href="/dashboard/event-types/new" className="btn btn-primary">
          + New event type
        </Link>
      </div>

      {eventTypes.length === 0 ? (
        <div className="card muted">No event types yet. Create one to get a booking link.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Status</th>
                <th>Booking link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {eventTypes.map((et) => (
                <tr key={et.id}>
                  <td>{et.title}</td>
                  <td>{et.durationMinutes} min</td>
                  <td>{formatPrice(et.priceCents, et.currency)}</td>
                  <td>
                    {et.isActive ? (
                      <span className="badge badge-ok">active</span>
                    ) : (
                      <span className="badge badge-warn">inactive</span>
                    )}
                  </td>
                  <td>
                    <Link href={`/book/${et.id}`} target="_blank">
                      /book/{et.slug}
                    </Link>
                  </td>
                  <td>
                    <div className="row">
                      <Link href={`/dashboard/event-types/${et.id}`} className="btn">
                        Edit
                      </Link>
                      <form action={deleteEventType}>
                        <input type="hidden" name="id" value={et.id} />
                        <button className="btn" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

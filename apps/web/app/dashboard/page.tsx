import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatPrice, type EventType } from '@/lib/types';
import { deleteEventType } from './actions';

export default async function DashboardPage() {
  const eventTypes = await apiFetch<EventType[]>('/event-types');

  return (
    <>
      <div className="section-head">
        <h2>Your event types</h2>
        <Link href="/dashboard/event-types/new" className="btn btn-primary">
          New event type
        </Link>
      </div>

      {eventTypes.length === 0 ? (
        <div className="empty">
          <p>No event types yet.</p>
          <p className="small">Create one to get a booking link you can share.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <caption className="sr-only">
                Your event types, with their duration, price and public booking link
              </caption>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Price</th>
                  <th scope="col">Status</th>
                  <th scope="col">Booking link</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
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
                        <span className="badge badge-ok">Active</span>
                      ) : (
                        <span className="badge badge-warn">Inactive</span>
                      )}
                    </td>
                    <td className="link-cell">
                      {/* The label has to be the real path. It used to render
                          `/book/<slug>` while linking to `/book/<id>`, so a host
                          who read the link and typed it got "Event type not
                          found". The route keys on the id because a slug is only
                          unique per host, not globally. */}
                      <Link href={`/book/${et.id}`} target="_blank">
                        /book/{et.id}
                      </Link>
                    </td>
                    <td>
                      <div className="row">
                        <Link href={`/dashboard/event-types/${et.id}`} className="btn">
                          Edit
                        </Link>
                        <form action={deleteEventType}>
                          <input type="hidden" name="id" value={et.id} />
                          <button className="btn btn-quiet" type="submit">
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
        </div>
      )}
    </>
  );
}

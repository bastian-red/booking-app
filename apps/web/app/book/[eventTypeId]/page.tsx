import { Nav } from '@/components/nav';
import { SlotPicker } from '@/components/slot-picker';
import { publicApiFetch, ApiError } from '@/lib/api';
import { formatPrice, type PublicEventType } from '@/lib/types';

/**
 * The public booking page — the only screen most people will ever see.
 *
 * The header is deliberately small. A guest arriving here already knows who
 * they are meeting and why; what they do not know is when they can, so the
 * calendar gets the room and the host's details are reduced to one line above
 * it.
 */
export default async function BookPage({ params }: { params: { eventTypeId: string } }) {
  let eventType: PublicEventType;
  try {
    eventType = await publicApiFetch<PublicEventType>(`/public/event-types/${params.eventTypeId}`);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Event not found';
    return (
      <>
        <Nav />
        <main className="container" id="main">
          <div className="card error">{message}</div>
        </main>
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main className="container-wide" id="main">
        <header style={{ marginBottom: 'var(--s-6)' }}>
          <h1 style={{ marginBottom: 'var(--s-2)' }}>{eventType.title}</h1>
          <p className="muted">
            with {eventType.hostName} · {eventType.durationMinutes} min ·{' '}
            {formatPrice(eventType.priceCents, eventType.currency)}
          </p>
          {eventType.description && <p>{eventType.description}</p>}
        </header>
        <SlotPicker eventTypeId={eventType.id} />
      </main>
    </>
  );
}

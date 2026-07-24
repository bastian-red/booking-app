import { Nav } from '@/components/nav';
import { SlotPicker } from '@/components/slot-picker';
import { publicApiFetch, ApiError } from '@/lib/api';
import { formatPrice, type PublicEventType } from '@/lib/types';

export default async function BookPage({ params }: { params: { eventTypeId: string } }) {
  let eventType: PublicEventType;
  try {
    eventType = await publicApiFetch<PublicEventType>(`/public/event-types/${params.eventTypeId}`);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Event not found';
    return (
      <>
        <Nav />
        <div className="container">
          <div className="card error">{message}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="container">
        <div className="card">
          <h1 style={{ marginTop: 0 }}>{eventType.title}</h1>
          <p className="muted">
            with {eventType.hostName} · {eventType.durationMinutes} min ·{' '}
            {formatPrice(eventType.priceCents, eventType.currency)}
          </p>
          {eventType.description && <p>{eventType.description}</p>}
        </div>
        <SlotPicker eventTypeId={eventType.id} />
      </div>
    </>
  );
}

import { apiFetch } from '@/lib/api';
import { EventTypeForm } from '@/components/event-type-form';
import type { EventType } from '@/lib/types';
import { updateEventType, type FormState } from '../../actions';

export default async function EditEventTypePage({ params }: { params: { id: string } }) {
  const eventTypes = await apiFetch<EventType[]>('/event-types');
  const eventType = eventTypes.find((e) => e.id === params.id);
  if (!eventType) {
    return <div className="card error">Event type not found.</div>;
  }

  // Bind the id so the form action matches the (state, formData) signature.
  const action = async (state: FormState, formData: FormData): Promise<FormState> => {
    'use server';
    return updateEventType(params.id, state, formData);
  };

  return (
    <>
      <h2>Edit event type</h2>
      <EventTypeForm action={action} initial={eventType} />
    </>
  );
}

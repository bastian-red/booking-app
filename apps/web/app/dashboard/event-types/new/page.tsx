import { EventTypeForm } from '@/components/event-type-form';
import { createEventType } from '../../actions';

export default function NewEventTypePage() {
  return (
    <>
      <h2>New event type</h2>
      <EventTypeForm action={createEventType} />
    </>
  );
}

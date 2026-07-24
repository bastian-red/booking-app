'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { EventType } from '../lib/types';
import type { FormState } from '../app/dashboard/actions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function EventTypeForm({
  action,
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: EventType;
}) {
  const [state, formAction] = useFormState(action, undefined);

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <form action={formAction}>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" defaultValue={initial?.title} required />

        <label htmlFor="slug">Slug (kebab-case)</label>
        <input id="slug" name="slug" defaultValue={initial?.slug} placeholder="intro-call" required />

        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} defaultValue={initial?.description ?? ''} />

        <div className="row">
          <div style={{ flex: 1 }}>
            <label htmlFor="durationMinutes">Duration (minutes)</label>
            <input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min={5}
              max={480}
              defaultValue={initial?.durationMinutes ?? 30}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="priceCents">Price (cents, 0 = free)</label>
            <input
              id="priceCents"
              name="priceCents"
              type="number"
              min={0}
              defaultValue={initial?.priceCents ?? 0}
            />
          </div>
          <div style={{ width: 90 }}>
            <label htmlFor="currency">Currency</label>
            <input id="currency" name="currency" defaultValue={initial?.currency ?? 'usd'} />
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label htmlFor="bufferBeforeMin">Buffer before (min)</label>
            <input
              id="bufferBeforeMin"
              name="bufferBeforeMin"
              type="number"
              min={0}
              defaultValue={initial?.bufferBeforeMin ?? 0}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="bufferAfterMin">Buffer after (min)</label>
            <input
              id="bufferAfterMin"
              name="bufferAfterMin"
              type="number"
              min={0}
              defaultValue={initial?.bufferAfterMin ?? 0}
            />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initial?.isActive ?? true}
            style={{ width: 'auto' }}
          />
          Active (accepting bookings)
        </label>

        <div style={{ marginTop: 20 }}>
          <Submit label={initial ? 'Save changes' : 'Create event type'} />
        </div>
        {state?.error && <p className="error">{state.error}</p>}
      </form>
    </div>
  );
}

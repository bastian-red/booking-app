'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { DAYS, minutesToHHMM, type Availability } from '../lib/types';
import { saveAvailability, type FormState } from '../app/dashboard/actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save availability'}
    </button>
  );
}

export function AvailabilityEditor({ initial }: { initial: Availability }) {
  const [state, formAction] = useFormState<FormState, FormData>(saveAvailability, undefined);
  const byDay = new Map(initial.rules.map((r) => [r.dayOfWeek, r]));

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <form action={formAction}>
        <label htmlFor="timezone">Your timezone (IANA)</label>
        <input id="timezone" name="timezone" defaultValue={initial.timezone} required />

        <p className="muted" style={{ marginTop: 16 }}>
          Weekly hours (in your timezone):
        </p>
        {DAYS.map((label, day) => {
          const rule = byDay.get(day);
          return (
            <div className="row" key={day} style={{ marginBottom: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 90, margin: 0 }}>
                <input
                  type="checkbox"
                  name={`enabled-${day}`}
                  defaultChecked={Boolean(rule)}
                  style={{ width: 'auto' }}
                />
                {label}
              </label>
              <input
                type="time"
                name={`start-${day}`}
                defaultValue={minutesToHHMM(rule?.startMinute ?? 9 * 60)}
                style={{ width: 130 }}
              />
              <span className="muted">to</span>
              <input
                type="time"
                name={`end-${day}`}
                defaultValue={minutesToHHMM(rule?.endMinute ?? 17 * 60)}
                style={{ width: 130 }}
              />
            </div>
          );
        })}

        <div style={{ marginTop: 16 }}>
          <Submit />
        </div>
        {state?.error && <p className="error">{state.error}</p>}
      </form>
    </div>
  );
}

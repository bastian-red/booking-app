'use client';

import { useState } from 'react';
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

/**
 * The week as seven rows, each one either on or off.
 *
 * Two things changed here beyond the paint.
 *
 * The `enabled` checkboxes are controlled now. They used to be uncontrolled
 * with `defaultChecked`, which meant nothing on the page could react to them,
 * so an enabled Tuesday and a disabled Tuesday looked identical and a host had
 * to read seven checkboxes to see their own week. The row now takes an `on`
 * class, which is the difference between reading a form and reading a schedule.
 *
 * The time inputs carry an `aria-label`. They had none: `<input type="time">`
 * with a bare `name` is an unlabelled control, and the axe baseline found all
 * fourteen of them on this one screen (28 nodes across both colour schemes,
 * the largest single finding in the app). The visible "to" between them reads
 * fine with eyes and says nothing to a screen reader, which announced
 * "edit text, blank" fourteen times in a row.
 */
export function AvailabilityEditor({ initial }: { initial: Availability }) {
  const [state, formAction] = useFormState<FormState, FormData>(saveAvailability, undefined);
  const byDay = new Map(initial.rules.map((r) => [r.dayOfWeek, r]));
  const [enabled, setEnabled] = useState<boolean[]>(() =>
    DAYS.map((_, day) => byDay.has(day)),
  );

  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <form action={formAction}>
        <label htmlFor="timezone">Your timezone (IANA)</label>
        <input id="timezone" name="timezone" defaultValue={initial.timezone} required />
        <span className="field-hint">
          Weekly hours below are in this timezone. Guests always see their own.
        </span>

        <fieldset
          style={{ border: 0, padding: 0, margin: 'var(--s-6) 0 0', minInlineSize: 0 }}
        >
          <legend className="muted small" style={{ padding: 0, marginBottom: 'var(--s-3)' }}>
            Weekly hours
          </legend>
          <div className="avail">
            {DAYS.map((label, day) => (
              <div className={`avail-row${enabled[day] ? ' on' : ''}`} key={day}>
                <label className="avail-day">
                  <input
                    type="checkbox"
                    name={`enabled-${day}`}
                    checked={enabled[day]}
                    onChange={(e) =>
                      setEnabled((prev) =>
                        prev.map((v, i) => (i === day ? e.target.checked : v)),
                      )
                    }
                  />
                  {label}
                </label>
                {/* Disabled on an off day rather than dimmed. saveAvailability
                    skips a day whose checkbox is off, so these values are never
                    read — and a disabled control is honestly unavailable, where
                    a 55%-opacity live control is just hard to read. */}
                <div className="avail-times">
                  <input
                    type="time"
                    name={`start-${day}`}
                    aria-label={`${label} start time`}
                    disabled={!enabled[day]}
                    defaultValue={minutesToHHMM(rule(byDay, day)?.startMinute ?? 9 * 60)}
                  />
                  <span aria-hidden="true">to</span>
                  <input
                    type="time"
                    name={`end-${day}`}
                    aria-label={`${label} end time`}
                    disabled={!enabled[day]}
                    defaultValue={minutesToHHMM(rule(byDay, day)?.endMinute ?? 17 * 60)}
                  />
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div style={{ marginTop: 'var(--s-6)' }}>
          <Submit />
        </div>
        {state?.error && (
          <p className="error" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}

function rule(byDay: Map<number, Availability['rules'][number]>, day: number) {
  return byDay.get(day);
}

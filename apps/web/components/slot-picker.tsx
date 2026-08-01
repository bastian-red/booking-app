'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SlotDto } from '@booking/shared';
import { PUBLIC_API_BASE_URL } from '../lib/config';
import { createGuestBooking } from '../app/book/actions';
import {
  addMonths,
  dayLabel,
  monthLabel,
  monthMatrix,
  monthOf,
  todayIn,
  WEEKDAYS,
  type DayKey,
  type MonthKey,
} from '../lib/month-grid';

function guestTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** `2026-03-09T14:30` -> `14:30`. The API already resolved it into the guest's tz. */
const clock = (startInGuestTz: string): string => startInGuestTz.slice(11, 16);

/**
 * Pick a day, then a time.
 *
 * The month grid replaced a `<select>` of dates. A dropdown hides the shape of
 * the week: a guest cannot see that this host only works Tuesdays without
 * opening it and reading thirty options. The grid shows availability as a
 * pattern, which is how people actually think about a calendar, and it costs
 * one extra element.
 *
 * The layout out of the API is a flat list of slots, so everything below is
 * derived from `byDate` — no second request, no client-side date maths beyond
 * the pure string helpers in lib/month-grid.
 */
export function SlotPicker({ eventTypeId }: { eventTypeId: string }) {
  const router = useRouter();
  const [tz] = useState(guestTimezone);
  const [slots, setSlots] = useState<SlotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [month, setMonth] = useState<MonthKey | null>(null);
  const [selectedDate, setSelectedDate] = useState<DayKey | null>(null);
  const [selected, setSelected] = useState<SlotDto | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const url = `${PUBLIC_API_BASE_URL}/public/event-types/${eventTypeId}/slots?from=${encodeURIComponent(
      from,
    )}&to=${encodeURIComponent(to)}&tz=${encodeURIComponent(tz)}`;
    setLoading(true);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load slots (${res.status})`);
        return (await res.json()) as SlotDto[];
      })
      .then((data) => {
        setSlots(data);
        setLoadError(null);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [eventTypeId, tz]);

  const byDate = useMemo(() => {
    const map = new Map<DayKey, SlotDto[]>();
    for (const s of slots) {
      const day = s.startInGuestTz.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(s);
      map.set(day, list);
    }
    return map;
  }, [slots]);

  const dates = useMemo(() => Array.from(byDate.keys()).sort(), [byDate]);

  // Open on the first day that has anything on it, not on today: a host with
  // no availability this week would otherwise land the guest on an empty month.
  useEffect(() => {
    if (dates.length === 0) return;
    setSelectedDate((current) => current ?? dates[0]!);
    setMonth((current) => current ?? monthOf(dates[0]!));
  }, [dates]);

  /**
   * Which months are reachable.
   *
   * The API only returns 30 days, so paging past the last month with slots
   * would show an empty grid and read as a bug. The arrows are bounded by the
   * data instead.
   */
  const [firstMonth, lastMonth] = useMemo(() => {
    if (dates.length === 0) return [null, null] as const;
    return [monthOf(dates[0]!), monthOf(dates[dates.length - 1]!)] as const;
  }, [dates]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setFormError(null);
    const result = await createGuestBooking({
      eventTypeId,
      startUtc: selected.startUtc,
      guestName: name,
      guestEmail: email,
      guestTimezone: tz,
    });
    if (!result.ok) {
      setFormError(result.error);
      setSubmitting(false);
      // Clear the selection so a just-taken time cannot be resubmitted.
      setSelected(null);
      return;
    }
    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }
    router.push(`/booking/${result.id}`);
  }

  if (loading) return <div className="card muted">Loading availability…</div>;
  if (loadError) return <div className="card error">{loadError}</div>;
  if (slots.length === 0)
    return <div className="empty">No open slots in the next 30 days.</div>;

  const daySlots = selectedDate ? (byDate.get(selectedDate) ?? []) : [];
  const shown = month ?? monthOf(dates[0]!);
  const weeks = monthMatrix(shown);
  // In the guest's zone, not UTC. The day keys in `byDate` are the guest's, so
  // comparing them against a UTC "today" marks the wrong cell for anyone west
  // of Greenwich late in the evening.
  const today = todayIn(tz);

  return (
    <div className="booking-layout">
      <section className="cal" aria-label="Choose a date">
        <div className="cal-head">
          <h2 className="cal-title">{monthLabel(shown)}</h2>
          <div className="cal-nav">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!firstMonth || shown <= firstMonth}
              onClick={() => setMonth(addMonths(shown, -1))}
            >
              &#8249;
            </button>
            <button
              type="button"
              aria-label="Next month"
              disabled={!lastMonth || shown >= lastMonth}
              onClick={() => setMonth(addMonths(shown, 1))}
            >
              &#8250;
            </button>
          </div>
        </div>

        {/* aria-hidden: the day buttons carry the weekday in their own
            accessible name, so a screen reader reading this strip as well
            would announce every column header twice. */}
        <div className="cal-weekdays" aria-hidden="true">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="cal-grid">
          {weeks.flat().map((day, index) => {
            if (!day) return <span key={`blank-${index}`} className="cal-day blank" />;
            const count = byDate.get(day)?.length ?? 0;
            const isSelected = day === selectedDate;
            return (
              <button
                type="button"
                key={day}
                className={`cal-day${day === today ? ' today' : ''}`}
                aria-pressed={isSelected}
                disabled={count === 0}
                // Colour and a dot are not enough on their own. The name spells
                // out the date and what is on it, so the grid is usable with
                // the screen off.
                aria-label={
                  count === 0
                    ? `${dayLabel(day)}, no times available`
                    : `${dayLabel(day)}, ${count} ${count === 1 ? 'time' : 'times'} available`
                }
                onClick={() => {
                  setSelectedDate(day);
                  setSelected(null);
                }}
              >
                <span aria-hidden="true">{Number(day.slice(8, 10))}</span>
                {count > 0 && <span className="dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>

      <div className="slot-rail">
        <div className="row between">
          <h3>{selectedDate ? dayLabel(selectedDate) : 'Pick a date'}</h3>
        </div>

        {/* The one fact this product can get wrong in a way that wastes
            someone's morning. It is on screen before any time is. */}
        <p className="tz-chip">
          Times in <strong>{tz}</strong>
        </p>

        <div className="slots" role="group" aria-label="Available times">
          {daySlots.map((s) => (
            <button
              type="button"
              key={s.startUtc}
              className="slot"
              aria-pressed={selected?.startUtc === s.startUtc}
              onClick={() => setSelected(s)}
            >
              {clock(s.startInGuestTz)}
            </button>
          ))}
        </div>

        {selected && (
          <div className="booking-form">
            <h3>Your details</h3>
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div style={{ marginTop: 'var(--s-4)' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={submitting || !name || !email}
                onClick={submit}
              >
                {submitting ? 'Booking…' : `Confirm ${clock(selected.startInGuestTz)}`}
              </button>
            </div>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

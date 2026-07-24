'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SlotDto } from '@booking/shared';
import { PUBLIC_API_BASE_URL } from '../lib/config';
import { createGuestBooking } from '../app/book/actions';

function guestTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function SlotPicker({ eventTypeId }: { eventTypeId: string }) {
  const router = useRouter();
  const [tz] = useState(guestTimezone);
  const [slots, setSlots] = useState<SlotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
    const map = new Map<string, SlotDto[]>();
    for (const s of slots) {
      const day = s.startInGuestTz.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(s);
      map.set(day, list);
    }
    return map;
  }, [slots]);

  const dates = useMemo(() => Array.from(byDate.keys()).sort(), [byDate]);

  useEffect(() => {
    if (!selectedDate && dates.length > 0) setSelectedDate(dates[0]!);
  }, [dates, selectedDate]);

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
      // Refresh slots so a just-taken time disappears.
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
    return <div className="card muted">No open slots in the next 30 days.</div>;

  const daySlots = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  return (
    <div className="card">
      <p className="muted">Times shown in your timezone: {tz}</p>

      <label htmlFor="date">Pick a date</label>
      <select
        id="date"
        value={selectedDate ?? ''}
        onChange={(e) => {
          setSelectedDate(e.target.value);
          setSelected(null);
        }}
      >
        {dates.map((d) => (
          <option key={d} value={d}>
            {d} ({byDate.get(d)!.length} slots)
          </option>
        ))}
      </select>

      <div className="slots">
        {daySlots.map((s) => (
          <button
            type="button"
            key={s.startUtc}
            className={`slot${selected?.startUtc === s.startUtc ? ' selected' : ''}`}
            onClick={() => setSelected(s)}
          >
            {s.startInGuestTz.slice(11, 16)}
          </button>
        ))}
      </div>

      {selected && (
        <div style={{ marginTop: 20 }}>
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
          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              disabled={submitting || !name || !email}
              onClick={submit}
            >
              {submitting ? 'Booking…' : `Confirm ${selected.startInGuestTz.slice(11, 16)}`}
            </button>
          </div>
          {formError && <p className="error">{formError}</p>}
        </div>
      )}
    </div>
  );
}

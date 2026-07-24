import { describe, it, expect } from 'vitest';
import { generateSlots, isValidSlotStart, type SlotEngineInput } from './engine';

const FAR_PAST = new Date('2000-01-01T00:00:00Z');

function base(overrides: Partial<SlotEngineInput>): SlotEngineInput {
  return {
    hostTimezone: 'UTC',
    guestTimezone: 'UTC',
    rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 17 * 60 }], // Mon 09:00-17:00
    durationMinutes: 60,
    slotIntervalMinutes: 60,
    rangeStart: new Date('2026-01-05T00:00:00Z'), // Monday
    rangeEnd: new Date('2026-01-06T00:00:00Z'),
    now: FAR_PAST,
    ...overrides,
  };
}

describe('generateSlots — basic', () => {
  it('generates one slot per hour within the window', () => {
    const slots = generateSlots(base({}));
    // 09..16 starts (last meeting 16:00-17:00) => 8 slots.
    expect(slots).toHaveLength(8);
    expect(slots[0]!.startUtc.toISOString()).toBe('2026-01-05T09:00:00.000Z');
    expect(slots[7]!.startUtc.toISOString()).toBe('2026-01-05T16:00:00.000Z');
    expect(slots[0]!.endUtc.toISOString()).toBe('2026-01-05T10:00:00.000Z');
  });

  it('respects a custom step (30-min grid on 60-min meetings)', () => {
    const slots = generateSlots(base({ slotIntervalMinutes: 30 }));
    // starts at :00 and :30 from 09:00 while start+60 <= 17:00 => last start 16:00.
    // 09:00,09:30,...,16:00 => 15 slots.
    expect(slots).toHaveLength(15);
    expect(slots[1]!.startUtc.toISOString()).toBe('2026-01-05T09:30:00.000Z');
  });

  it('returns nothing for a day with no rule', () => {
    const slots = generateSlots(
      base({
        rangeStart: new Date('2026-01-06T00:00:00Z'), // Tuesday
        rangeEnd: new Date('2026-01-07T00:00:00Z'),
      }),
    );
    expect(slots).toHaveLength(0);
  });
});

describe('generateSlots — timezones and DST', () => {
  it('applies the host winter offset (EST = UTC-5)', () => {
    const slots = generateSlots(
      base({
        hostTimezone: 'America/New_York',
        guestTimezone: 'Asia/Tokyo',
        rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 10 * 60 }],
      }),
    );
    expect(slots).toHaveLength(1);
    // 09:00 EST = 14:00 UTC.
    expect(slots[0]!.startUtc.toISOString()).toBe('2026-01-05T14:00:00.000Z');
    // 14:00 UTC in Tokyo (UTC+9) = 23:00 same day.
    expect(slots[0]!.startInGuestTz).toBe('2026-01-05T23:00+09:00');
    expect(slots[0]!.startInHostTz).toBe('2026-01-05T09:00-05:00');
  });

  it('applies the host summer offset (EDT = UTC-4) for the same wall time', () => {
    const slots = generateSlots(
      base({
        hostTimezone: 'America/New_York',
        rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 10 * 60 }],
        rangeStart: new Date('2026-07-06T00:00:00Z'), // Monday in July
        rangeEnd: new Date('2026-07-07T00:00:00Z'),
      }),
    );
    expect(slots).toHaveLength(1);
    // 09:00 EDT = 13:00 UTC (one hour earlier in UTC than winter).
    expect(slots[0]!.startUtc.toISOString()).toBe('2026-07-06T13:00:00.000Z');
    expect(slots[0]!.startInHostTz).toBe('2026-07-06T09:00-04:00');
  });

  it('handles the spring-forward day correctly (NY, 2026-03-08)', () => {
    // Sunday 2026-03-08: clocks jump 02:00 -> 03:00.
    const slots = generateSlots(
      base({
        hostTimezone: 'America/New_York',
        guestTimezone: 'America/New_York',
        rules: [{ dayOfWeek: 0, startMinute: 0, endMinute: 6 * 60 }], // Sun 00:00-06:00
        rangeStart: new Date('2026-03-08T00:00:00Z'),
        rangeEnd: new Date('2026-03-09T00:00:00Z'),
      }),
    );
    const byHostWall = (prefix: string) => slots.find((s) => s.startInHostTz.startsWith(prefix));
    // 00:00 is still EST (-5) => 05:00 UTC.
    expect(byHostWall('2026-03-08T00:00')!.startUtc.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    // 04:00 is already EDT (-4) => 08:00 UTC.
    expect(byHostWall('2026-03-08T04:00')!.startUtc.toISOString()).toBe('2026-03-08T08:00:00.000Z');
    // Starts are strictly increasing in absolute time (no collision breaks order).
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]!.startUtc.getTime()).toBeGreaterThanOrEqual(slots[i - 1]!.startUtc.getTime());
    }
  });

  it('handles the fall-back day without throwing (NY, 2026-11-01)', () => {
    // Sunday 2026-11-01: clocks fall 02:00 -> 01:00 (01:00 happens twice).
    const run = () =>
      generateSlots(
        base({
          hostTimezone: 'America/New_York',
          rules: [{ dayOfWeek: 0, startMinute: 0, endMinute: 4 * 60 }],
          rangeStart: new Date('2026-11-01T00:00:00Z'),
          rangeEnd: new Date('2026-11-02T00:00:00Z'),
        }),
      );
    expect(run).not.toThrow();
    const slots = run();
    expect(slots.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]!.startUtc.getTime()).toBeGreaterThanOrEqual(slots[i - 1]!.startUtc.getTime());
    }
  });
});

describe('generateSlots — conflicts and buffers', () => {
  it('drops slots overlapping a busy interval', () => {
    const slots = generateSlots(
      base({ busy: [{ startUtc: new Date('2026-01-05T11:00:00Z'), endUtc: new Date('2026-01-05T12:00:00Z') }] }),
    );
    const starts = slots.map((s) => s.startUtc.toISOString());
    expect(starts).not.toContain('2026-01-05T11:00:00.000Z');
    // Adjacent 10:00-11:00 slot survives (half-open, no overlap).
    expect(starts).toContain('2026-01-05T10:00:00.000Z');
  });

  it('expands conflicts by the after-buffer', () => {
    const slots = generateSlots(
      base({
        bufferAfterMin: 15,
        busy: [{ startUtc: new Date('2026-01-05T11:00:00Z'), endUtc: new Date('2026-01-05T12:00:00Z') }],
      }),
    );
    const starts = slots.map((s) => s.startUtc.toISOString());
    // 10:00-11:00 + 15min buffer => occupied until 11:15, overlaps busy => dropped.
    expect(starts).not.toContain('2026-01-05T10:00:00.000Z');
  });
});

describe('generateSlots — notice and range', () => {
  it('drops slots before now + minNotice', () => {
    const slots = generateSlots(
      base({ now: new Date('2026-01-05T10:30:00Z'), minNoticeMinutes: 0 }),
    );
    const starts = slots.map((s) => s.startUtc.toISOString());
    expect(starts).not.toContain('2026-01-05T09:00:00.000Z');
    expect(starts).not.toContain('2026-01-05T10:00:00.000Z');
    expect(starts).toContain('2026-01-05T11:00:00.000Z');
  });

  it('applies a minimum notice window', () => {
    const slots = generateSlots(
      base({ now: new Date('2026-01-05T09:00:00Z'), minNoticeMinutes: 180 }),
    );
    // earliest bookable = 12:00. So 12:00 is first.
    expect(slots[0]!.startUtc.toISOString()).toBe('2026-01-05T12:00:00.000Z');
  });
});

describe('generateSlots — overrides', () => {
  it('blocks the whole date', () => {
    const slots = generateSlots(base({ overrides: [{ date: '2026-01-05', isBlocked: true }] }));
    expect(slots).toHaveLength(0);
  });

  it('applies a custom window override', () => {
    const slots = generateSlots(
      base({ overrides: [{ date: '2026-01-05', isBlocked: false, startMinute: 13 * 60, endMinute: 15 * 60 }] }),
    );
    expect(slots.map((s) => s.startUtc.toISOString())).toEqual([
      '2026-01-05T13:00:00.000Z',
      '2026-01-05T14:00:00.000Z',
    ]);
  });
});

describe('isValidSlotStart', () => {
  it('accepts a real slot start and rejects an off-grid time', () => {
    const input = base({});
    expect(isValidSlotStart(input, new Date('2026-01-05T09:00:00Z'))).toBe(true);
    expect(isValidSlotStart(input, new Date('2026-01-05T09:30:00Z'))).toBe(false);
    expect(isValidSlotStart(input, new Date('2026-01-05T18:00:00Z'))).toBe(false);
  });
});

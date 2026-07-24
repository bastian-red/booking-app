import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/** Weekly recurring availability, expressed in the host's local wall clock. */
export interface WeeklyRule {
  /** 0 = Sunday ... 6 = Saturday, in the host timezone. */
  dayOfWeek: number;
  /** Minutes from local midnight, inclusive start. e.g. 540 = 09:00. */
  startMinute: number;
  /** Minutes from local midnight, exclusive end. e.g. 1020 = 17:00. */
  endMinute: number;
}

/** A date-specific override of the weekly rules (host tz), keyed by local date. */
export interface DateOverride {
  /** Local calendar date in the host tz, 'yyyy-MM-dd'. */
  date: string;
  /** When true the whole date is unavailable. */
  isBlocked: boolean;
  /** Custom window (used only when isBlocked is false). */
  startMinute?: number;
  endMinute?: number;
}

/** An already-occupied interval (an existing booking), absolute UTC. */
export interface BusyInterval {
  startUtc: Date;
  endUtc: Date;
}

export interface SlotEngineInput {
  /** IANA tz of the host, e.g. 'America/Santiago'. Availability is in this tz. */
  hostTimezone: string;
  /** IANA tz of the guest, used only to build display strings. */
  guestTimezone: string;
  rules: WeeklyRule[];
  overrides?: DateOverride[];
  busy?: BusyInterval[];
  /** Meeting length in minutes. */
  durationMinutes: number;
  /** Padding before/after a meeting that must also be free. */
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  /** Step between candidate slot starts. Defaults to durationMinutes. */
  slotIntervalMinutes?: number;
  /** Window to generate within, absolute UTC. rangeStart inclusive, rangeEnd exclusive. */
  rangeStart: Date;
  rangeEnd: Date;
  /** "Now" for filtering past slots. Defaults to new Date(). */
  now?: Date;
  /** Earliest bookable time = now + minNoticeMinutes. */
  minNoticeMinutes?: number;
}

export interface Slot {
  /** Absolute start instant. */
  startUtc: Date;
  /** Absolute end instant (startUtc + durationMinutes). */
  endUtc: Date;
  /** ISO 8601 start rendered in the guest tz, e.g. '2026-03-09T09:00:00-04:00'. */
  startInGuestTz: string;
  /** ISO 8601 start rendered in the host tz. */
  startInHostTz: string;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Convert a host-local wall-clock (calendar date + minutes from midnight) to the
 * absolute UTC instant, honoring the host timezone's DST rules. date-fns-tz
 * interprets the naive string as wall time in `tz`.
 */
function localWallToUtc(dateStr: string, minuteOfDay: number, tz: string): Date {
  const hh = Math.floor(minuteOfDay / 60);
  const mm = minuteOfDay % 60;
  return fromZonedTime(`${dateStr}T${pad(hh)}:${pad(mm)}:00`, tz);
}

/** Weekday (0=Sun..6=Sat) of a 'yyyy-MM-dd' calendar date, tz-independent. */
function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** All host-local calendar dates ('yyyy-MM-dd') the UTC window may touch. */
function localDatesInRange(rangeStart: Date, rangeEnd: Date, tz: string): string[] {
  // Pad by one day on each side so slots near the tz boundary are not missed.
  const startDay = formatInTimeZone(new Date(rangeStart.getTime() - DAY_MS), tz, 'yyyy-MM-dd');
  const endDay = formatInTimeZone(new Date(rangeEnd.getTime() + DAY_MS), tz, 'yyyy-MM-dd');
  const dates: string[] = [];
  // Iterate calendar dates lexicographically by stepping one UTC day at a time
  // from a noon anchor (noon avoids DST midnight edge cases when incrementing).
  let cursor = new Date(`${startDay}T12:00:00Z`);
  const last = new Date(`${endDay}T12:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    dates.push(
      `${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`,
    );
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return dates;
}

interface Window {
  startMinute: number;
  endMinute: number;
}

/** Resolve the availability windows for a specific host-local date. */
function windowsForDate(
  dateStr: string,
  rules: WeeklyRule[],
  overridesByDate: Map<string, DateOverride>,
): Window[] {
  const override = overridesByDate.get(dateStr);
  if (override) {
    if (override.isBlocked) return [];
    if (override.startMinute != null && override.endMinute != null) {
      return [{ startMinute: override.startMinute, endMinute: override.endMinute }];
    }
    // Non-blocking override with no window: fall through to weekly rules.
  }
  const dow = weekdayOf(dateStr);
  return rules
    .filter((r) => r.dayOfWeek === dow && r.endMinute > r.startMinute)
    .map((r) => ({ startMinute: r.startMinute, endMinute: r.endMinute }));
}

/** Half-open interval overlap test: [aStart,aEnd) ∩ [bStart,bEnd) ≠ ∅. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Generate bookable slots. Pure and deterministic: same input, same output.
 *
 * A candidate meeting [start, start+duration] must fit inside an availability
 * window (host-local minutes). Its occupied interval, expanded by buffers on
 * both sides, must not overlap any busy interval. Slots before now+minNotice or
 * outside [rangeStart, rangeEnd) are dropped. Results are sorted by start.
 */
export function generateSlots(input: SlotEngineInput): Slot[] {
  const {
    hostTimezone,
    guestTimezone,
    rules,
    overrides = [],
    busy = [],
    durationMinutes,
    bufferBeforeMin = 0,
    bufferAfterMin = 0,
    rangeStart,
    rangeEnd,
  } = input;

  if (durationMinutes <= 0) return [];

  const step = input.slotIntervalMinutes ?? durationMinutes;
  if (step <= 0) return [];

  const now = input.now ?? new Date();
  const earliest = new Date(now.getTime() + (input.minNoticeMinutes ?? 0) * MINUTE_MS);

  const overridesByDate = new Map(overrides.map((o) => [o.date, o]));
  const dates = localDatesInRange(rangeStart, rangeEnd, hostTimezone);

  const durationMs = durationMinutes * MINUTE_MS;
  const bufBeforeMs = bufferBeforeMin * MINUTE_MS;
  const bufAfterMs = bufferAfterMin * MINUTE_MS;

  const slots: Slot[] = [];

  for (const dateStr of dates) {
    const windows = windowsForDate(dateStr, rules, overridesByDate);
    for (const win of windows) {
      // Candidate meeting must end within the window (local minutes).
      for (let m = win.startMinute; m + durationMinutes <= win.endMinute; m += step) {
        const startUtc = localWallToUtc(dateStr, m, hostTimezone);
        const endUtc = new Date(startUtc.getTime() + durationMs);

        // Range + notice filters.
        if (startUtc.getTime() < rangeStart.getTime()) continue;
        if (startUtc.getTime() >= rangeEnd.getTime()) continue;
        if (startUtc.getTime() < earliest.getTime()) continue;

        // Conflict check against busy intervals, expanded by buffers.
        const occStart = startUtc.getTime() - bufBeforeMs;
        const occEnd = endUtc.getTime() + bufAfterMs;
        const conflict = busy.some((b) =>
          overlaps(occStart, occEnd, b.startUtc.getTime(), b.endUtc.getTime()),
        );
        if (conflict) continue;

        slots.push({
          startUtc,
          endUtc,
          startInGuestTz: formatInTimeZone(startUtc, guestTimezone, "yyyy-MM-dd'T'HH:mmXXX"),
          startInHostTz: formatInTimeZone(startUtc, hostTimezone, "yyyy-MM-dd'T'HH:mmXXX"),
        });
      }
    }
  }

  slots.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  return slots;
}

/**
 * Validate that a proposed booking start aligns with a real generated slot.
 * The API calls this before writing so a client cannot book an off-grid time.
 */
export function isValidSlotStart(input: SlotEngineInput, startUtc: Date): boolean {
  const target = startUtc.getTime();
  // Constrain the window to a tight band around the target for efficiency.
  const band: SlotEngineInput = {
    ...input,
    rangeStart: new Date(target - MINUTE_MS),
    rangeEnd: new Date(target + MINUTE_MS),
  };
  return generateSlots(band).some((s) => s.startUtc.getTime() === target);
}

/**
 * Calendar arithmetic on `YYYY-MM-DD` strings.
 *
 * Every function here is pure string and integer maths, and that is the whole
 * point. The slots the API returns are already resolved into the guest's
 * timezone and handed over as `YYYY-MM-DDTHH:mm` strings, so the calendar's
 * only job is to lay those day keys out in a grid. The moment that grid is
 * built by parsing a day key into a `Date`, it becomes wrong: `new Date('2026-
 * 03-01')` is parsed as UTC midnight, which is the 29th of February in Santiago
 * and the 1st of March in Berlin. A calendar that shows a guest in Chile a slot
 * under the wrong day is the exact failure this product exists to prevent.
 *
 * `Date.UTC` appears below only to derive a weekday index and a month length
 * from integers. No local-time `Date` is ever constructed, and no value here is
 * ever formatted for display through a `Date`.
 */

/** A `YYYY-MM` month key. */
export type MonthKey = string;
/** A `YYYY-MM-DD` day key, as it arrives from the API. */
export type DayKey = string;

const MONTH_KEY = /^(\d{4})-(\d{2})$/;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseMonth(month: MonthKey): [number, number] {
  const match = MONTH_KEY.exec(month);
  if (!match) throw new Error(`not a YYYY-MM month key: ${month}`);
  return [Number(match[1]), Number(match[2])];
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** The `YYYY-MM` a `YYYY-MM-DD` belongs to. */
export function monthOf(day: DayKey): MonthKey {
  if (!DAY_KEY.test(day)) throw new Error(`not a YYYY-MM-DD day key: ${day}`);
  return day.slice(0, 7);
}

/** Days in a month, Gregorian leap rules included. */
export function daysInMonth(month: MonthKey): number {
  const [year, m] = parseMonth(month);
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** Shift a month key by whole months, rolling the year over. */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [year, m] = parseMonth(month);
  // Work in months-since-year-zero so negative deltas roll back correctly;
  // `%` on a negative numerator would otherwise produce a negative month.
  const total = year * 12 + (m - 1) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${pad((total % 12) + 1)}`;
}

/**
 * The month laid out as weeks of seven, Monday first.
 *
 * Monday-first rather than Sunday-first: it is the ISO-8601 week and what most
 * of the world outside North America reads. Leading and trailing cells are
 * `null` so the grid keeps its shape — dropping them would make each month's
 * first row a different width and the columns would stop lining up.
 */
export function monthMatrix(month: MonthKey): (DayKey | null)[][] {
  const [year, m] = parseMonth(month);
  const length = daysInMonth(month);

  // getUTCDay() is 0=Sunday..6=Saturday; shift so 0=Monday.
  const firstWeekday = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;

  const cells: (DayKey | null)[] = Array<DayKey | null>(firstWeekday).fill(null);
  for (let day = 1; day <= length; day += 1) {
    cells.push(`${month}-${pad(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (DayKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Weekday headers, Monday first, matching `monthMatrix`'s column order. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * "March 2026", in the viewer's locale.
 *
 * Safe to build a `Date` here because it is only ever read through
 * `timeZone: 'UTC'`, so the value that goes in is the value that comes out.
 */
export function monthLabel(month: MonthKey, locale?: string): string {
  const [year, m] = parseMonth(month);
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}

/**
 * Today's `YYYY-MM-DD`, in a named timezone.
 *
 * `new Date().toISOString().slice(0, 10)` is the obvious version and it is
 * wrong: it is today in UTC, and the day keys it would be compared against are
 * in the guest's zone. For a guest in Sao Paulo, between 21:00 and midnight
 * local, UTC has already rolled over — so the calendar highlights tomorrow and
 * calls it today. `en-CA` is used because its short date format is ISO.
 */
export function todayIn(timeZone: string): DayKey {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** "Tuesday, 3 March", for the slot rail heading. Same UTC-only guarantee. */
export function dayLabel(day: DayKey, locale?: string): string {
  const match = DAY_KEY.exec(day);
  if (!match) throw new Error(`not a YYYY-MM-DD day key: ${day}`);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

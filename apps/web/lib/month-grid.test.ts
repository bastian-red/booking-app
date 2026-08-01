import { describe, expect, it } from 'vitest';
import {
  addMonths,
  dayLabel,
  daysInMonth,
  monthLabel,
  monthMatrix,
  monthOf,
  todayIn,
  WEEKDAYS,
} from './month-grid';

describe('daysInMonth', () => {
  it('knows the ordinary months', () => {
    expect(daysInMonth('2026-01')).toBe(31);
    expect(daysInMonth('2026-04')).toBe(30);
  });

  it('applies the Gregorian leap rules, not just "divisible by four"', () => {
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    // 1900 was not a leap year; 2000 was.
    expect(daysInMonth('1900-02')).toBe(28);
    expect(daysInMonth('2000-02')).toBe(29);
  });
});

describe('addMonths', () => {
  it('moves inside a year', () => {
    expect(addMonths('2026-03', 1)).toBe('2026-04');
    expect(addMonths('2026-03', -1)).toBe('2026-02');
  });

  it('rolls the year over in both directions', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('handles multi-year jumps, including negative ones', () => {
    expect(addMonths('2026-06', 24)).toBe('2028-06');
    // The regression this guards: `total % 12` on a negative numerator is
    // negative in JS, which produced month "-01" before Math.floor was used
    // for the year.
    expect(addMonths('2026-01', -13)).toBe('2024-12');
    expect(addMonths('2026-01', -25)).toBe('2023-12');
  });
});

describe('monthMatrix', () => {
  it('always returns whole weeks of seven', () => {
    for (const month of ['2026-01', '2026-02', '2026-03', '2024-02', '2026-08']) {
      const weeks = monthMatrix(month);
      for (const week of weeks) expect(week).toHaveLength(7);
    }
  });

  it('pads the lead-in and lead-out with nulls, never with other months', () => {
    // 1 March 2026 is a Sunday, so Monday-first puts it in the last column.
    const weeks = monthMatrix('2026-03');
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-03-01']);
    const flat = weeks.flat();
    for (const cell of flat) {
      if (cell !== null) expect(cell.startsWith('2026-03-')).toBe(true);
    }
  });

  it('contains every day of the month exactly once, in order', () => {
    const days = monthMatrix('2024-02').flat().filter(Boolean);
    expect(days).toHaveLength(29);
    expect(days[0]).toBe('2024-02-01');
    expect(days[28]).toBe('2024-02-29');
    expect([...days].sort()).toEqual(days);
  });

  it('starts a month whose first is a Monday in the first column', () => {
    // 1 June 2026 is a Monday.
    expect(monthMatrix('2026-06')[0]?.[0]).toBe('2026-06-01');
  });

  it('lines the header up with the columns', () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe('Mon');
  });
});

describe('day keys are never routed through a local-time Date', () => {
  /**
   * The bug this whole module exists to prevent.
   *
   * `new Date('2026-03-01')` is parsed as UTC midnight. Read back with
   * `getDate()` in any negative-offset zone (Santiago, New York) that is the
   * 28th or 29th of February, so a calendar built that way files a slot under
   * the wrong day. The matrix must be immune to the process timezone.
   */
  it('produces the same grid whatever TZ the process is in', () => {
    const original = process.env.TZ;
    const grids: string[] = [];
    for (const tz of ['UTC', 'Pacific/Kiritimati', 'Pacific/Midway', 'America/Santiago']) {
      process.env.TZ = tz;
      grids.push(JSON.stringify(monthMatrix('2026-03')));
    }
    process.env.TZ = original;
    expect(new Set(grids).size).toBe(1);
  });

  it('labels a day as itself, not as the day before', () => {
    // Read with an explicit UTC timeZone, so 2026-03-01 is Sunday 1 March
    // everywhere, not "Saturday 28 February" west of Greenwich.
    expect(dayLabel('2026-03-01', 'en-GB')).toBe('Sunday 1 March');
    expect(monthLabel('2026-03', 'en-GB')).toBe('March 2026');
  });
});

describe('todayIn', () => {
  it('returns an ISO day key', () => {
    expect(todayIn('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gives different answers either side of the date line', () => {
    // The calendar highlights "today". Computing it in UTC marks the wrong cell
    // for a guest whose local date has not rolled over yet — or has already.
    // Kiritimati is UTC+14 and Midway UTC-11, so at every instant of every day
    // those two are on different dates.
    expect(todayIn('Pacific/Kiritimati')).not.toBe(todayIn('Pacific/Midway'));
  });

  it('agrees with an independent formatting of the same instant', () => {
    const zone = 'America/Santiago';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    expect(todayIn(zone)).toBe(`${get('year')}-${get('month')}-${get('day')}`);
  });
});

describe('monthOf', () => {
  it('slices the month key off a day key', () => {
    expect(monthOf('2026-03-09')).toBe('2026-03');
  });

  it('rejects anything that is not a day key rather than guessing', () => {
    expect(() => monthOf('2026-03')).toThrow(/YYYY-MM-DD/);
    expect(() => monthOf('09/03/2026')).toThrow(/YYYY-MM-DD/);
  });
});

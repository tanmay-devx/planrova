import { describe, it, expect } from 'vitest';
import {
  parseLocalDate,
  formatDate,
  formatTime,
  getStartOfWeek,
  getWeekDays,
  getDayName,
  getMonthName,
  getFormattedDateRange
} from '../src/utils/date.js';

describe('Timezone-Safe Date Utilities', () => {
  it('parses YYYY-MM-DD date string without UTC timezone shift', () => {
    // 2026-11-01 parsed at UTC midnight would shift to Oct 31 in UTC-5
    const parsed = parseLocalDate('2026-11-01');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(10); // November is index 10
    expect(parsed.getDate()).toBe(1);
    expect(formatDate('2026-11-01')).toBe('2026-11-01');
  });

  it('formats Date instances and timestamps to YYYY-MM-DD', () => {
    const d = new Date(2026, 5, 15, 12, 0, 0); // June 15, 2026
    expect(formatDate(d)).toBe('2026-06-15');
    expect(formatDate(d.getTime())).toBe('2026-06-15');
  });

  it('determines the start of the week as Monday', () => {
    // 2026-11-14 is a Saturday
    const sat = parseLocalDate('2026-11-14');
    const monday = getStartOfWeek(sat);
    expect(monday.getDay()).toBe(1); // Monday
    expect(formatDate(monday)).toBe('2026-11-09');

    // 2026-11-15 is a Sunday -> previous Monday was 2026-11-09
    const sun = parseLocalDate('2026-11-15');
    const mondayFromSun = getStartOfWeek(sun);
    expect(mondayFromSun.getDay()).toBe(1);
    expect(formatDate(mondayFromSun)).toBe('2026-11-09');
  });

  it('returns exactly 7 consecutive days for a week', () => {
    const week = getWeekDays('2026-11-09');
    expect(week.length).toBe(7);
    expect(formatDate(week[0])).toBe('2026-11-09');
    expect(formatDate(week[6])).toBe('2026-11-15');
  });

  it('formats 24hr time into 12hr AM/PM string', () => {
    expect(formatTime('09:30')).toBe('9:30 AM');
    expect(formatTime('14:45')).toBe('2:45 PM');
    expect(formatTime('00:15')).toBe('12:15 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('')).toBe('');
  });

  it('identifies correct day names and month names', () => {
    const d = parseLocalDate('2026-11-14'); // Saturday, Nov 2026
    expect(getDayName(d)).toBe('Saturday');
    expect(getMonthName(d)).toBe('November');
  });

  it('formats multi-day and multi-month week ranges cleanly', () => {
    const rangeSameMonth = getFormattedDateRange('2026-11-09');
    expect(rangeSameMonth).toBe('November 2026');

    // Cross-month week: Nov 30 to Dec 6
    const rangeCrossMonth = getFormattedDateRange('2026-11-30');
    expect(rangeCrossMonth).toBe('November - December 2026');
  });
});


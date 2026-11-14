/**
 * shared/domain/scheduling/availability.engine.js
 * Calculates genuine user availability for any calendar date by combining:
 * - Configured working hours and weekday rules
 * - Date-specific custom exceptions (holidays, leaves)
 * - Materialized recurring college timetable entries
 * - Fixed calendar events (timed and all-day)
 * - Existing accepted and locked schedule blocks
 * - Mandatory reserved breaks (e.g. lunch)
 *
 * 100% platform-independent; zero external dependencies.
 */

import { 
  timeStringToMinutes, 
  minutesToTimeString, 
  calculateDurationMinutes,
  subtractIntervals, 
  mergeIntervals,
  splitCrossMidnightInterval 
} from './scheduling.utils.js';

import { normalizeAvailability } from './scheduling.validation.js';

const DAY_NAMES = Object.freeze([
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]);

/**
 * Materializes recurring weekly college timetable entries into concrete fixed commitments on targetDate.
 */
export function materializeTimetableForDate(timetable, targetDate) {
  if (!timetable || typeof timetable !== 'object' || !targetDate) return [];

  // Parse targetDate (YYYY-MM-DD) safely into day-of-week
  const [y, m, d] = targetDate.split('-').map(Number);
  const dayIndex = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dayName = DAY_NAMES[dayIndex];

  let rawEntries = [];
  if (Array.isArray(timetable)) {
    // Array format with day property
    rawEntries = timetable.filter(e => e && (e.day === dayName || e.dayIndex === dayIndex));
  } else if (Array.isArray(timetable[dayName])) {
    // Map format: { Monday: [...], Tuesday: [...] }
    rawEntries = timetable[dayName];
  }

  const materialized = [];

  for (const entry of rawEntries) {
    if (!entry || !entry.startTime || !entry.endTime) continue;

    const sMin = timeStringToMinutes(entry.startTime);
    const eMin = timeStringToMinutes(entry.endTime);
    if (isNaN(sMin) || isNaN(eMin)) continue;

    const subject = entry.subject || entry.name || entry.title || 'Lecture';
    const room = entry.room || entry.location || '';
    const desc = room ? `${subject} (${room})` : subject;

    // Check if entry spans midnight
    if (eMin <= sMin) {
      const parts = splitCrossMidnightInterval(entry.startTime, entry.endTime, targetDate);
      parts.forEach((p, idx) => {
        if (p.date === targetDate) {
          materialized.push({
            id: `tt_${targetDate}_${entry.id || subject}_part${idx + 1}`,
            date: p.date,
            startTime: p.startTime,
            endTime: p.endTime,
            durationMinutes: p.durationMinutes,
            blockType: 'lecture',
            sourceEntityId: entry.id ? String(entry.id) : null,
            title: desc,
            isFixed: true,
            isLocked: true,
            provenance: { scheduledBy: 'timetable', score: 100, reason: 'Recurring college lecture' }
          });
        }
      });
    } else {
      materialized.push({
        id: `tt_${targetDate}_${entry.id || subject}_${entry.startTime.replace(':', '')}`,
        date: targetDate,
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationMinutes: eMin - sMin,
        blockType: 'lecture',
        sourceEntityId: entry.id ? String(entry.id) : null,
        title: desc,
        isFixed: true,
        isLocked: true,
        provenance: { scheduledBy: 'timetable', score: 100, reason: 'Recurring college lecture' }
      });
    }
  }

  return materialized;
}

/**
 * Calculates complete daily availability and free time windows for a given date.
 */
export function calculateDailyAvailability({
  date,
  userAvailability = {},
  fixedEvents = [],
  timetable = null,
  acceptedBlocks = [],
  lockedBlocks = []
}) {
  const normAvailability = normalizeAvailability(userAvailability);
  const targetDate = (date || new Date().toISOString().split('T')[0]).trim();

  const [y, m, d] = targetDate.split('-').map(Number);
  const dayIndex = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dayName = DAY_NAMES[dayIndex];

  const warnings = [];

  // 1. Resolve custom date exception (e.g. holiday, leave)
  const dateException = normAvailability.customExceptions.find(e => e && e.date === targetDate);

  let isDayActive = true;
  let workStartStr = normAvailability.defaultWorkingHours.start;
  let workEndStr = normAvailability.defaultWorkingHours.end;
  let focusSlot = normAvailability.preferences.defaultFocusSlot;

  if (dateException) {
    if (dateException.active === false) {
      isDayActive = false;
      warnings.push(`Day ${targetDate} is inactive due to custom exception: ${dateException.reason || 'Off'}`);
    } else {
      if (dateException.start && dateException.end) {
        workStartStr = dateException.start;
        workEndStr = dateException.end;
      }
      if (dateException.focusSlot) {
        focusSlot = dateException.focusSlot;
      }
    }
  } else {
    // 2. Resolve weekday rules
    const rule = normAvailability.weekdayRules[dayIndex];
    if (!rule || rule.active === false) {
      isDayActive = false;
      warnings.push(`${dayName} (${targetDate}) is marked as inactive/day off in weekly availability.`);
    } else {
      workStartStr = rule.start || workStartStr;
      workEndStr = rule.end || workEndStr;
      focusSlot = rule.focusSlot || focusSlot;
    }
  }

  const workStartMin = isDayActive ? timeStringToMinutes(workStartStr) : 0;
  const workEndMin = isDayActive ? timeStringToMinutes(workEndStr) : 0;
  const totalWorkingMinutes = isDayActive ? Math.max(0, workEndMin - workStartMin) : 0;

  const baseWorkingInterval = { start: workStartMin, end: workEndMin };

  if (!isDayActive || totalWorkingMinutes === 0) {
    return {
      date: targetDate,
      dayName,
      timezone: normAvailability.timezone,
      isDayActive: false,
      workingHours: { start: workStartStr, end: workEndStr },
      focusSlot,
      totalWorkingMinutes: 0,
      fixedCommitmentMinutes: 0,
      reservedBreakMinutes: 0,
      remainingAvailableMinutes: 0,
      busyIntervals: [],
      freeIntervals: [],
      fixedCommitments: [],
      warnings
    };
  }

  // 3. Collect all busy commitments
  const fixedCommitments = [];
  const busyIntervals = [];

  // A. Check for All-Day Events on this date
  const allDayEvent = (fixedEvents || []).find(e => {
    if (!e || e.deleted) return false;
    const matchesDate = (!e.date && !e.startDate) || e.date === targetDate || e.startDate === targetDate;
    return matchesDate && Boolean(e.allDay);
  });

  if (allDayEvent) {
    warnings.push(`All-day event "${allDayEvent.title}" reserves the full date.`);
    busyIntervals.push({ start: workStartMin, end: workEndMin });
    fixedCommitments.push({
      id: allDayEvent.id,
      title: allDayEvent.title,
      startTime: workStartStr,
      endTime: workEndStr,
      durationMinutes: totalWorkingMinutes,
      isFixed: true,
      blockType: 'fixed_event',
      allDay: true
    });
  }

  // B. Timed Fixed Calendar Events
  for (const ev of (fixedEvents || [])) {
    if (!ev || ev.deleted || ev.allDay) continue;
    const matchesDate = (!ev.date && !ev.startDate) || ev.date === targetDate || ev.startDate === targetDate;
    if (!matchesDate || !ev.startTime || !ev.endTime) continue;

    const s = timeStringToMinutes(ev.startTime);
    const e = timeStringToMinutes(ev.endTime);
    if (isNaN(s) || isNaN(e)) continue;

    if (e <= s) {
      // Midnight crossover
      const parts = splitCrossMidnightInterval(ev.startTime, ev.endTime, targetDate);
      parts.forEach(p => {
        if (p.date === targetDate) {
          const pStart = timeStringToMinutes(p.startTime);
          const pEnd = timeStringToMinutes(p.endTime);
          busyIntervals.push({ start: pStart, end: pEnd });
          fixedCommitments.push({
            id: ev.id,
            title: ev.title,
            startTime: p.startTime,
            endTime: p.endTime,
            durationMinutes: p.durationMinutes,
            isFixed: true,
            blockType: 'fixed_event'
          });
        }
      });
    } else {
      busyIntervals.push({ start: s, end: e });
      fixedCommitments.push({
        id: ev.id,
        title: ev.title,
        startTime: ev.startTime,
        endTime: ev.endTime,
        durationMinutes: e - s,
        isFixed: true,
        blockType: 'fixed_event'
      });
    }
  }

  // C. Materialized Recurring College Timetable
  const timetableCommitments = materializeTimetableForDate(timetable, targetDate);
  for (const tt of timetableCommitments) {
    const s = timeStringToMinutes(tt.startTime);
    const e = timeStringToMinutes(tt.endTime);
    busyIntervals.push({ start: s, end: e });
    fixedCommitments.push(tt);
  }

  // D. User-Locked Schedule Blocks & Existing Accepted Fixed Blocks
  const combinedExisting = [...(lockedBlocks || []), ...(acceptedBlocks || [])];
  const seenBlockIds = new Set(fixedCommitments.map(fc => fc.id));

  for (const b of combinedExisting) {
    if (!b || b.deleted || (b.date && b.date !== targetDate) || seenBlockIds.has(b.id)) continue;
    if (b.isFixed || b.isLocked) {
      const s = timeStringToMinutes(b.startTime);
      const e = timeStringToMinutes(b.endTime);
      if (!isNaN(s) && !isNaN(e) && e > s) {
        busyIntervals.push({ start: s, end: e });
        fixedCommitments.push({
          id: b.id,
          title: b.title,
          startTime: b.startTime,
          endTime: b.endTime,
          durationMinutes: e - s,
          isFixed: Boolean(b.isFixed),
          isLocked: Boolean(b.isLocked),
          blockType: b.blockType || 'task'
        });
        seenBlockIds.add(b.id);
      }
    }
  }

  // E. Reserved Lunch Break
  let reservedBreakMinutes = 0;
  if (normAvailability.preferences?.lunchBreak) {
    const { start: lbStart, end: lbEnd } = normAvailability.preferences.lunchBreak;
    const lbS = timeStringToMinutes(lbStart);
    const lbE = timeStringToMinutes(lbEnd);

    if (!isNaN(lbS) && !isNaN(lbE) && lbE > lbS) {
      // Only include if lunch overlaps with working hours
      const overlap = {
        start: Math.max(workStartMin, lbS),
        end: Math.min(workEndMin, lbE)
      };
      if (overlap.start < overlap.end) {
        busyIntervals.push(overlap);
        reservedBreakMinutes += (overlap.end - overlap.start);
      }
    }
  }

  // 4. Calculate Free Intervals by Subtracting All Busy Intervals
  const freeIntervals = subtractIntervals(baseWorkingInterval, busyIntervals);

  // 5. Calculate Metrics
  const remainingAvailableMinutes = freeIntervals.reduce((acc, slot) => acc + (slot.end - slot.start), 0);

  // Calculate fixed commitment minutes overlapping with working hours
  const mergedBusyInWorking = mergeIntervals(busyIntervals)
    .map(i => ({
      start: Math.max(workStartMin, i.start),
      end: Math.min(workEndMin, i.end)
    }))
    .filter(i => i.end > i.start);

  const totalBusyMinutes = mergedBusyInWorking.reduce((acc, i) => acc + (i.end - i.start), 0);
  const fixedCommitmentMinutes = Math.max(0, totalBusyMinutes - reservedBreakMinutes);

  return {
    date: targetDate,
    dayName,
    timezone: normAvailability.timezone,
    isDayActive: true,
    workingHours: { start: workStartStr, end: workEndStr },
    focusSlot,
    totalWorkingMinutes,
    fixedCommitmentMinutes,
    reservedBreakMinutes,
    remainingAvailableMinutes,
    busyIntervals: mergeIntervals(busyIntervals),
    freeIntervals,
    fixedCommitments,
    warnings
  };
}

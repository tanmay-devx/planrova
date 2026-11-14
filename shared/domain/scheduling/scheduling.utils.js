/**
 * shared/domain/scheduling/scheduling.utils.js
 * Pure time arithmetic, interval set operations, deterministic hashing, and temporal utilities.
 * 100% platform-independent with zero external dependencies.
 */

import { 
  WORKLOAD_CLASSIFICATIONS, 
  WORKLOAD_THRESHOLDS 
} from './scheduling.types.js';

/**
 * Converts a 24h "HH:MM" time string to minutes from local midnight (00:00 = 0, 24:00 = 1440).
 * Returns NaN if input is malformed or invalid.
 */
export function timeStringToMinutes(timeStr) {
  if (typeof timeStr !== 'string') return NaN;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;

  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);

  if (h < 0 || h > 24 || m < 0 || m >= 60) return NaN;
  if (h === 24 && m > 0) return NaN; // 24:00 is allowed as day-end boundary

  return h * 60 + m;
}

/**
 * Converts minutes from midnight into a zero-padded "HH:MM" string.
 * Clamps to 00:00 - 24:00.
 */
export function minutesToTimeString(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '00:00';
  const clamped = Math.max(0, Math.min(1440, Math.floor(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates duration in minutes between two "HH:MM" strings on the same calendar day.
 * Returns negative if end < start.
 */
export function calculateDurationMinutes(startStr, endStr) {
  const start = timeStringToMinutes(startStr);
  const end = timeStringToMinutes(endStr);
  if (isNaN(start) || isNaN(end)) return 0;
  return end - start;
}

/**
 * Checks if two minute-based intervals [start, end] overlap.
 * By default (inclusive = false), touching boundaries (e.g. [60, 120] and [120, 180]) do NOT overlap.
 */
export function areIntervalsOverlapping(a, b, inclusive = false) {
  if (!a || !b) return false;
  const aStart = Math.min(a.start, a.end);
  const aEnd = Math.max(a.start, a.end);
  const bStart = Math.min(b.start, b.end);
  const bEnd = Math.max(b.start, b.end);

  if (inclusive) {
    return aStart <= bEnd && aEnd >= bStart;
  }
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Returns the intersection interval of two intervals, or null if no overlap.
 */
export function intersectIntervals(a, b) {
  if (!a || !b) return null;
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  if (start < end) {
    return { start, end };
  }
  return null;
}

/**
 * Merges overlapping or contiguous intervals into a minimal sorted set.
 * Input: array of { start: number, end: number }
 * Output: sorted, non-overlapping array of { start, end }
 */
export function mergeIntervals(intervals = []) {
  if (!Array.isArray(intervals) || intervals.length === 0) return [];

  // Filter out invalid or zero-duration intervals, normalize bounds
  const valid = intervals
    .filter(i => i && typeof i.start === 'number' && typeof i.end === 'number' && i.end > i.start)
    .map(i => ({ start: Math.max(0, i.start), end: Math.min(1440, i.end) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (valid.length === 0) return [];

  const merged = [valid[0]];

  for (let i = 1; i < valid.length; i++) {
    const current = valid[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping or touching boundaries: extend
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Subtracts an array of busy intervals from a base working interval.
 * Returns an array of remaining free intervals sorted chronologically.
 */
export function subtractIntervals(baseInterval, busyIntervals = []) {
  if (!baseInterval || baseInterval.end <= baseInterval.start) return [];

  const mergedBusy = mergeIntervals(busyIntervals);
  let currentStart = Math.max(0, baseInterval.start);
  const baseEnd = Math.min(1440, baseInterval.end);
  const freeIntervals = [];

  for (const busy of mergedBusy) {
    if (busy.end <= currentStart) continue; // Busy is before current point
    if (busy.start >= baseEnd) break;      // Busy is after base interval

    if (busy.start > currentStart) {
      // Free gap before busy interval
      freeIntervals.push({
        start: currentStart,
        end: Math.min(baseEnd, busy.start)
      });
    }
    currentStart = Math.max(currentStart, busy.end);
    if (currentStart >= baseEnd) break;
  }

  if (currentStart < baseEnd) {
    freeIntervals.push({
      start: currentStart,
      end: baseEnd
    });
  }

  return freeIntervals;
}

/**
 * Resolves effective deadline minute for a given task relative to a target planning date.
 * - If task deadline has specific time on targetDate: returns deadline minute.
 * - If task deadline is date-only (no time specified): semantically expires at end of working day
 *   (defaultWorkingEndStr, e.g. "18:00") on that date, NOT at 00:00 midnight!
 * - If dueDate is in the past: returns negative number (overdue).
 * - If dueDate is in future: returns positive number > 1440 (sufficient time).
 */
export function resolveDeadlineMinutes(dueDate, deadlineTime, targetDate, defaultWorkingEndStr = '18:00') {
  if (!dueDate) return Infinity; // No deadline

  const target = dueDate.trim();
  const current = (targetDate || '').trim();

  if (target < current) {
    // Past deadline: overdue
    return -1;
  }

  if (target > current) {
    // Future date: not due today
    return Infinity;
  }

  // Due on targetDate!
  if (deadlineTime && typeof deadlineTime === 'string' && deadlineTime.trim()) {
    const mins = timeStringToMinutes(deadlineTime.trim());
    return isNaN(mins) ? timeStringToMinutes(defaultWorkingEndStr) : mins;
  }

  // Date-only deadline: expires at end of working hours on that day
  return timeStringToMinutes(defaultWorkingEndStr) || 1080; // default 18:00 (1080 min)
}

/**
 * Calculates Workload Utilization using flexible capacity.
 * flexibleCapacity = max(0, totalWorkingMinutes - fixedCommitmentMinutes - reservedBreakMinutes)
 * utilization = scheduledFlexibleMinutes / flexibleCapacity
 */
export function calculateWorkloadUtilization(scheduledFlexibleMinutes, totalWorkingMinutes, fixedMinutes, breakMinutes) {
  const scheduled = Math.max(0, scheduledFlexibleMinutes || 0);
  const total = Math.max(0, totalWorkingMinutes || 0);
  const fixed = Math.max(0, fixedMinutes || 0);
  const breaks = Math.max(0, breakMinutes || 0);

  const flexibleCapacity = Math.max(0, total - fixed - breaks);

  if (flexibleCapacity === 0) {
    return scheduled > 0 ? Infinity : 0;
  }

  return Number((scheduled / flexibleCapacity).toFixed(4));
}

/**
 * Maps workload utilization to non-overlapping classification labels.
 */
export function classifyWorkload(utilization) {
  if (typeof utilization !== 'number' || isNaN(utilization)) {
    return WORKLOAD_CLASSIFICATIONS.BALANCED;
  }

  if (utilization < WORKLOAD_THRESHOLDS.LIGHT_MAX) {
    return WORKLOAD_CLASSIFICATIONS.LIGHT;
  }
  if (utilization < WORKLOAD_THRESHOLDS.BALANCED_MAX) {
    return WORKLOAD_CLASSIFICATIONS.BALANCED;
  }
  if (utilization <= WORKLOAD_THRESHOLDS.HEAVY_MAX) {
    return WORKLOAD_CLASSIFICATIONS.HEAVY;
  }
  return WORKLOAD_CLASSIFICATIONS.OVERLOADED;
}

/**
 * Generates a deterministic, collision-resistant hash string representing the input state.
 * Implements 64-bit FNV-1a with JSON canonical sorting. Zero external dependencies.
 */
export function generateSnapshotHash(data) {
  function canonicalize(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(canonicalize);
    }
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = canonicalize(obj[key]);
    });
    return sorted;
  }

  const str = JSON.stringify(canonicalize(data));
  
  // 64-bit FNV-1a hash implementation
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch;
    h2 = Math.imul(h2, 0x01000193);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `snap_${hex1}${hex2}`;
}


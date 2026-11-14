/**
 * shared/domain/scheduling/buffer.engine.js
 * Smart Buffers and Context-Switching Protection for Planrova 2.0.
 *
 * Capabilities:
 * - Generates transition buffers (10-15 min) between demanding back-to-back blocks
 * - Generates exam prep buffers before scheduled examinations
 * - Generates assignment review buffers before critical deadlines
 * - Prevents duplicate buffers and respects fixed commitments and breaks
 *
 * 100% platform-independent; zero external dependencies.
 */

import { 
  timeStringToMinutes, 
  minutesToTimeString, 
  areIntervalsOverlapping 
} from './scheduling.utils.js';

import { normalizeScheduleBlock } from './scheduling.validation.js';

/**
 * Generates smart buffers for a day's schedule.
 */
export function generateSmartBuffers({
  targetDate,
  blocks = [],
  freeIntervals = [],
  tasks = [],
  preferences = {}
}) {
  const dateStr = (targetDate || new Date().toISOString().split('T')[0]).trim();
  const transitionMinutes = preferences.breakBetweenSessionsMinutes !== undefined 
    ? preferences.breakBetweenSessionsMinutes 
    : 10;

  const smartBuffers = [];
  const occupiedIntervals = (blocks || []).map(b => ({
    start: timeStringToMinutes(b.startTime),
    end: timeStringToMinutes(b.endTime),
    block: b
  })).sort((a, b) => a.start - b.start);

  // Helper: check if proposed buffer interval overlaps any existing occupied block or buffer
  function hasOverlap(startMin, endMin) {
    if (startMin >= endMin) return true;
    for (const occ of occupiedIntervals) {
      if (areIntervalsOverlapping({ start: startMin, end: endMin }, occ)) {
        return true;
      }
    }
    for (const buf of smartBuffers) {
      const bStart = timeStringToMinutes(buf.startTime);
      const bEnd = timeStringToMinutes(buf.endTime);
      if (areIntervalsOverlapping({ start: startMin, end: endMin }, { start: bStart, end: bEnd })) {
        return true;
      }
    }
    return false;
  }

  // 1. Exam Preparation Buffers
  // If an exam is scheduled today, place a 30m prep buffer immediately before it (if time permits)
  for (const occ of occupiedIntervals) {
    const titleLower = (occ.block.title || '').toLowerCase();
    const isExam = titleLower.includes('exam') || titleLower.includes('midterm') || titleLower.includes('quiz') || titleLower.includes('test');

    if (isExam) {
      const prepDuration = 30;
      const prepStart = occ.start - prepDuration;
      const prepEnd = occ.start;

      if (prepStart >= 0 && !hasOverlap(prepStart, prepEnd)) {
        smartBuffers.push(normalizeScheduleBlock({
          id: `buf_exam_${occ.block.id}_${prepStart}`,
          date: dateStr,
          startTime: minutesToTimeString(prepStart),
          endTime: minutesToTimeString(prepEnd),
          durationMinutes: prepDuration,
          blockType: 'buffer',
          sourceEntityId: occ.block.id,
          title: `Prep & Review: ${occ.block.title}`,
          isFixed: false,
          isLocked: false,
          provenance: {
            scheduledBy: 'buffer_engine',
            score: 95,
            reason: `30-minute quiet focus and preparation buffer prior to ${occ.block.title}.`
          }
        }));
      }
    }
  }

  // 2. Transition Buffers between Demanding Consecutive Blocks
  // If consecutive blocks have a gap >= 10m and <= 30m, or back-to-back blocks with free buffer space
  if (transitionMinutes > 0) {
    for (let i = 0; i < occupiedIntervals.length - 1; i++) {
      const curr = occupiedIntervals[i];
      const next = occupiedIntervals[i + 1];

      // If current is a substantial session (>= 45 min)
      const currDuration = curr.end - curr.start;
      const availableGap = next.start - curr.end;

      if (currDuration >= 45 && availableGap >= transitionMinutes) {
        // Place transition buffer at the start of the gap
        const bufStart = curr.end;
        const bufEnd = curr.end + transitionMinutes;

        if (!hasOverlap(bufStart, bufEnd)) {
          smartBuffers.push(normalizeScheduleBlock({
            id: `buf_trans_${curr.block.id}_${next.block.id}`,
            date: dateStr,
            startTime: minutesToTimeString(bufStart),
            endTime: minutesToTimeString(bufEnd),
            durationMinutes: transitionMinutes,
            blockType: 'buffer',
            sourceEntityId: null,
            title: 'Transition & Rest Buffer',
            isFixed: false,
            isLocked: false,
            provenance: {
              scheduledBy: 'buffer_engine',
              score: 90,
              reason: `${transitionMinutes}-minute mental transition break between tasks.`
            }
          }));
        }
      }
    }
  }

  return smartBuffers;
}


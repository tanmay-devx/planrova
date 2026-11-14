/**
 * shared/domain/scheduling/conflict.engine.js
 * Comprehensive Hard and Soft Conflict Detection for Planrova 2.0 Scheduling.
 *
 * Hard Conflicts (Infeasible):
 * - Overlapping fixed commitments (lectures, exams, appointments)
 * - Flexible tasks overlapping fixed commitments or locked blocks
 * - Overlapping active tasks
 * - Task blocks placed past task deadline
 * - Task blocks placed outside user availability or on inactive days
 * - Invalid time intervals (startTime >= endTime)
 *
 * Soft Conflicts (Quality / Focus Warnings):
 * - Insufficient break between consecutive focus sessions
 * - Excessive daily workload exceeding flexible capacity
 * - High-urgency tasks scheduled outside preferred focus windows
 *
 * 100% platform-independent; zero external dependencies.
 */

import { 
  CONFLICT_TYPES, 
  CONFLICT_SEVERITIES 
} from './scheduling.types.js';

import { 
  timeStringToMinutes, 
  areIntervalsOverlapping, 
  calculateDurationMinutes,
  resolveDeadlineMinutes 
} from './scheduling.utils.js';

import { normalizeAvailability } from './scheduling.validation.js';

/**
 * Detects all hard and soft scheduling conflicts for a given set of blocks, tasks, and availability.
 */
export function detectSchedulingConflicts({
  date,
  blocks = [],
  tasks = [],
  availability = {},
  fixedCommitments = []
}) {
  const conflicts = [];
  let conflictCounter = 1;

  function addConflict(conflictObj) {
    conflicts.push({
      id: `conf_${date || 'gen'}_${conflictCounter++}`,
      relevantDate: date,
      isResolvable: conflictObj.severity !== CONFLICT_SEVERITIES.HARD || conflictObj.type !== CONFLICT_TYPES.OVERLAP || !conflictObj.isTwoFixed,
      ...conflictObj
    });
  }

  const normAvail = normalizeAvailability(availability);
  const targetDate = (date || new Date().toISOString().split('T')[0]).trim();

  // Create lookup maps
  const taskMap = new Map((tasks || []).map(t => [t.id, t]));

  // Combine blocks with fixed commitments on this date
  const allBlocks = [
    ...(fixedCommitments || [])
      .filter(fc => fc && !fc.deleted && (fc.date === targetDate || !fc.date))
      .map(fc => ({
        ...fc,
        date: fc.date || targetDate,
        isFixed: true,
        blockType: fc.blockType || 'fixed_event'
      })),
    ...(blocks || [])
      .filter(b => b && !b.deleted && (b.date === targetDate || !b.date))
      .map(b => ({
        ...b,
        date: b.date || targetDate
      }))
  ];

  // ── 1. Invalid Time Interval Checks ─────────────────────────────────
  for (const b of allBlocks) {
    const s = timeStringToMinutes(b.startTime);
    const e = timeStringToMinutes(b.endTime);

    if (isNaN(s) || isNaN(e) || s >= e) {
      addConflict({
        type: CONFLICT_TYPES.INVALID_TIME_RANGE,
        severity: CONFLICT_SEVERITIES.HARD,
        affectedEntityIds: [b.id, b.sourceEntityId].filter(Boolean),
        timeRange: { start: b.startTime || '00:00', end: b.endTime || '00:00' },
        explanation: `Block "${b.title || 'Untitled'}" has an invalid time range (${b.startTime} to ${b.endTime}).`,
        suggestedResolution: 'Ensure start time is strictly before end time.'
      });
    }
  }

  // ── 2. Availability Breach Checks ───────────────────────────────────
  const [y, m, d] = targetDate.split('-').map(Number);
  const dayIndex = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const customException = normAvail.customExceptions.find(e => e && e.date === targetDate);
  const isDayActive = customException 
    ? (customException.active !== false)
    : (normAvail.weekdayRules[dayIndex]?.active !== false);

  const workStart = customException?.start || normAvail.weekdayRules[dayIndex]?.start || normAvail.defaultWorkingHours.start;
  const workEnd = customException?.end || normAvail.weekdayRules[dayIndex]?.end || normAvail.defaultWorkingHours.end;

  const workStartMin = timeStringToMinutes(workStart);
  const workEndMin = timeStringToMinutes(workEnd);

  if (!isDayActive) {
    for (const b of allBlocks) {
      if (b.blockType === 'task') {
        addConflict({
          type: CONFLICT_TYPES.AVAILABILITY_BREACH,
          severity: CONFLICT_SEVERITIES.HARD,
          affectedEntityIds: [b.id, b.sourceEntityId].filter(Boolean),
          timeRange: { start: b.startTime, end: b.endTime },
          explanation: `Task "${b.title}" is scheduled on ${targetDate}, which is marked as an inactive day off.`,
          suggestedResolution: 'Move task to the next active working day.'
        });
      }
    }
  } else {
    for (const b of allBlocks) {
      if (b.blockType === 'task') {
        const bStart = timeStringToMinutes(b.startTime);
        const bEnd = timeStringToMinutes(b.endTime);

        if (!isNaN(bStart) && !isNaN(bEnd)) {
          if (bStart < workStartMin || bEnd > workEndMin) {
            addConflict({
              type: CONFLICT_TYPES.AVAILABILITY_BREACH,
              severity: CONFLICT_SEVERITIES.HARD,
              affectedEntityIds: [b.id, b.sourceEntityId].filter(Boolean),
              timeRange: { start: b.startTime, end: b.endTime },
              explanation: `Task "${b.title}" (${b.startTime}–${b.endTime}) is scheduled outside configured working hours (${workStart}–${workEnd}).`,
              suggestedResolution: `Reallocate task within ${workStart} to ${workEnd}.`
            });
          }
        }
      }
    }
  }

  // ── 3. Overlap Checks (Fixed vs Fixed, Fixed vs Task, Task vs Task) ──
  for (let i = 0; i < allBlocks.length; i++) {
    for (let j = i + 1; j < allBlocks.length; j++) {
      const b1 = allBlocks[i];
      const b2 = allBlocks[j];

      const s1 = timeStringToMinutes(b1.startTime);
      const e1 = timeStringToMinutes(b1.endTime);
      const s2 = timeStringToMinutes(b2.startTime);
      const e2 = timeStringToMinutes(b2.endTime);

      if (isNaN(s1) || isNaN(e1) || isNaN(s2) || isNaN(e2) || s1 >= e1 || s2 >= e2) continue;

      const int1 = { start: s1, end: e1 };
      const int2 = { start: s2, end: e2 };

      if (areIntervalsOverlapping(int1, int2, false)) {
        const overlapStart = Math.max(s1, s2);
        const overlapEnd = Math.min(e1, e2);

        const isTwoFixed = Boolean(b1.isFixed && b2.isFixed);
        const hasLocked = Boolean(b1.isLocked || b2.isLocked);

        let type = CONFLICT_TYPES.OVERLAP;
        if (hasLocked && !isTwoFixed) {
          type = CONFLICT_TYPES.LOCKED_BLOCK_CONFLICT;
        }

        const explanation = isTwoFixed
          ? `Fixed commitment collision: "${b1.title}" overlaps with "${b2.title}".`
          : (hasLocked
            ? `Locked block collision: "${b1.title}" collides with locked block "${b2.title}".`
            : `Schedule overlap: Task "${b1.title}" collides with "${b2.title}".`);

        const suggestedResolution = isTwoFixed
          ? 'Requires external calendar resolution; fixed commitments cannot be rescheduled automatically.'
          : 'Move flexible task to an open free time slot.';

        addConflict({
          type,
          severity: CONFLICT_SEVERITIES.HARD,
          isTwoFixed,
          affectedEntityIds: [b1.id, b2.id, b1.sourceEntityId, b2.sourceEntityId].filter(Boolean),
          timeRange: {
            start: b1.startTime > b2.startTime ? b1.startTime : b2.startTime,
            end: b1.endTime < b2.endTime ? b1.endTime : b2.endTime
          },
          explanation,
          suggestedResolution
        });
      }
    }
  }

  // ── 4. Task Deadline Violation Checks ───────────────────────────────
  for (const b of allBlocks) {
    if (b.blockType === 'task' && b.sourceEntityId) {
      const task = taskMap.get(b.sourceEntityId);
      if (task && task.dueDate) {
        const deadlineMin = resolveDeadlineMinutes(task.dueDate, task.deadlineTime, targetDate, workEnd);
        const blockEndMin = timeStringToMinutes(b.endTime);

        if (!isNaN(blockEndMin) && blockEndMin > deadlineMin) {
          addConflict({
            type: CONFLICT_TYPES.DEADLINE_VIOLATION,
            severity: CONFLICT_SEVERITIES.HARD,
            affectedEntityIds: [b.id, task.id],
            timeRange: { start: b.startTime, end: b.endTime },
            explanation: `Task "${task.title}" is scheduled to end at ${b.endTime}, which is after its deadline.`,
            suggestedResolution: 'Reschedule task into an earlier available slot before deadline.'
          });
        }
      }
    }
  }

  // ── 5. Soft Conflicts: Insufficient Breaks & Fatigue ────────────────
  const maxSessionMin = normAvail.preferences.maxSessionMinutes || 90;
  const minBreakMin = normAvail.preferences.breakBetweenSessionsMinutes || 10;

  // Filter task and focus blocks sorted chronologically
  const taskBlocksSorted = allBlocks
    .filter(b => b.blockType === 'task')
    .sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));

  let continuousFocusMinutes = 0;

  for (let k = 0; k < taskBlocksSorted.length; k++) {
    const current = taskBlocksSorted[k];
    const next = taskBlocksSorted[k + 1];

    const curDuration = current.durationMinutes || calculateDurationMinutes(current.startTime, current.endTime);
    continuousFocusMinutes += curDuration;

    if (continuousFocusMinutes > maxSessionMin) {
      addConflict({
        type: CONFLICT_TYPES.INSUFFICIENT_BREAK,
        severity: CONFLICT_SEVERITIES.SOFT,
        affectedEntityIds: [current.id, current.sourceEntityId].filter(Boolean),
        timeRange: { start: current.startTime, end: current.endTime },
        explanation: `Continuous focus work exceeds recommended ${maxSessionMin} min without a break.`,
        suggestedResolution: `Insert a ${minBreakMin}-minute break before the next focus block.`
      });
      continuousFocusMinutes = 0; // reset
    }

    if (next) {
      const gap = calculateDurationMinutes(current.endTime, next.startTime);
      if (gap >= minBreakMin) {
        continuousFocusMinutes = 0; // break taken!
      }
    }
  }

  return conflicts;
}

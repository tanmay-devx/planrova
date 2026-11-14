/**
 * shared/domain/scheduling/rescheduling.engine.js
 * Adaptive Rescheduling Engine for Planrova 2.0.
 *
 * Capabilities:
 * - Adapts existing schedules dynamically when tasks overrun, get missed, or new commitments arise
 * - Strictly protects locked blocks and fixed commitments
 * - Non-destructive: produces draft proposals with explicit change summaries
 * - Supports push-forward, buffer-tightening, and spillover to subsequent days
 * - Generates plain-language explanations for all proposed schedule changes
 *
 * 100% platform-independent; zero external dependencies.
 */

import { 
  ALGORITHM_VERSION, 
  PROPOSAL_STATUSES 
} from './scheduling.types.js';

import { 
  timeStringToMinutes, 
  minutesToTimeString, 
  generateSnapshotHash,
  areIntervalsOverlapping 
} from './scheduling.utils.js';

import { normalizeScheduleProposal } from './scheduling.validation.js';
import { generateScheduleProposal } from './scheduling.engine.js';

/**
 * Generates an adaptive reschedule proposal in response to missed blocks, overruns, or new commitments.
 */
export function generateRescheduleProposal({
  targetDate,
  currentBlocks = [],
  tasks = [],
  userAvailability = {},
  fixedEvents = [],
  timetable = null,
  missedBlockIds = [],
  overrun = null, // { blockId: string, actualDurationMinutes: number }
  lockedBlockIds = [],
  currentTimeStr = null, // e.g. "14:30" - past blocks cannot be rescheduled
  preferences = {}
}) {
  const dateStr = (targetDate || new Date().toISOString().split('T')[0]).trim();
  const missedSet = new Set(missedBlockIds || []);
  const lockedSet = new Set(lockedBlockIds || []);

  const currentMin = currentTimeStr ? timeStringToMinutes(currentTimeStr) : null;

  // Resolve overrun details if provided
  let overrunBlock = null;
  let overrunRange = null;
  if (overrun && overrun.blockId) {
    overrunBlock = currentBlocks.find(b => b.id === overrun.blockId);
    if (overrunBlock) {
      const sMin = timeStringToMinutes(overrunBlock.startTime);
      const eMin = sMin + (overrun.actualDurationMinutes || overrunBlock.durationMinutes);
      overrunRange = { start: sMin, end: eMin, blockId: overrunBlock.id };
    }
  }

  // 1. Separate current blocks into immutable and candidates for rescheduling
  const immutableBlocks = [];
  const activeTaskIds = new Set();

  for (const block of currentBlocks) {
    if (!block || block.deleted) continue;

    // If this is the overrunning block itself, place it with updated duration
    if (overrunRange && block.id === overrunRange.blockId) {
      immutableBlocks.push({
        ...block,
        durationMinutes: overrun.actualDurationMinutes,
        endTime: minutesToTimeString(overrunRange.end),
        isLocked: true
      });
      continue;
    }

    const bStart = timeStringToMinutes(block.startTime);
    const bEnd = timeStringToMinutes(block.endTime);

    // If block overlaps the overrun window, it was displaced by the overrun and must be rescheduled
    const isDisplacedByOverrun = overrunRange && areIntervalsOverlapping({ start: bStart, end: bEnd }, overrunRange);
    const isMissed = missedSet.has(block.id) || (block.sourceEntityId && missedSet.has(block.sourceEntityId));

    const isPast = !isDisplacedByOverrun && !isMissed && currentMin !== null && bEnd <= currentMin;
    const isExplicitlyLocked = !isMissed && (block.isLocked || lockedSet.has(block.id));
    const isFixedCommitment = block.isFixed || block.blockType === 'fixed_event' || block.blockType === 'lecture';

    // Past completed blocks, locked blocks, and fixed commitments remain immutable
    if (!isDisplacedByOverrun && (isPast || isExplicitlyLocked || isFixedCommitment)) {
      immutableBlocks.push(block);
    } else if (block.blockType === 'task') {
      if (block.sourceEntityId) {
        activeTaskIds.add(block.sourceEntityId);
      }
    }
  }

  // If currentTimeStr is specified, reserve elapsed time before current time so future tasks cannot be placed in the past
  if (currentMin !== null) {
    const workStartStr = userAvailability.defaultWorkingHours?.start || '09:00';
    const workStartMin = timeStringToMinutes(workStartStr);
    if (!isNaN(workStartMin) && currentMin > workStartMin) {
      immutableBlocks.push({
        id: `past_elapsed_${dateStr}`,
        date: dateStr,
        startTime: workStartStr,
        endTime: minutesToTimeString(currentMin),
        durationMinutes: currentMin - workStartMin,
        blockType: 'fixed_event',
        title: 'Elapsed Time',
        isFixed: true,
        isLocked: true
      });
    }
  }

  // Include missed tasks and active uncompleted tasks in candidate task list
  const lockedSourceEntityIds = new Set(immutableBlocks.map(b => b.sourceEntityId).filter(Boolean));

  const candidateTasks = (tasks || []).filter(t => {
    if (!t || t.deleted || t.status === 'completed' || t.status === 'cancelled') return false;
    if (lockedSourceEntityIds.has(t.id)) return false; // Already locked and placed
    return activeTaskIds.has(t.id) || missedSet.has(t.id) || (missedSet.size === 0 && activeTaskIds.size === 0);
  });

  // 3. Generate proposal around immutable blocks and updated fixed commitments
  const baseProposal = generateScheduleProposal({
    targetDate: dateStr,
    tasks: candidateTasks,
    userAvailability,
    fixedEvents,
    timetable,
    lockedBlocks: immutableBlocks,
    preferences
  });

  // 4. Compute delta between currentBlocks and new proposedBlocks
  const currentBlockMap = new Map((currentBlocks || []).map(b => [b.id, b]));
  const currentTaskBlockMap = new Map();
  for (const b of (currentBlocks || [])) {
    if (b.blockType === 'task' && b.sourceEntityId) {
      currentTaskBlockMap.set(b.sourceEntityId, b);
    }
  }

  const rescheduledBlocks = [];
  const unaffectedBlocks = [];
  const displacedBlocks = [];

  for (const pBlock of baseProposal.proposedBlocks) {
    if (pBlock.blockType !== 'task') {
      unaffectedBlocks.push(pBlock);
      continue;
    }

    const prevBlock = currentBlockMap.get(pBlock.id) || currentTaskBlockMap.get(pBlock.sourceEntityId);
    if (!prevBlock) {
      // Newly added or split block
      rescheduledBlocks.push({
        ...pBlock,
        changeType: 'added',
        changeReason: 'Added to fill newly available time slot.'
      });
    } else if (prevBlock.startTime !== pBlock.startTime || prevBlock.endTime !== pBlock.endTime) {
      rescheduledBlocks.push({
        ...pBlock,
        previousStartTime: prevBlock.startTime,
        previousEndTime: prevBlock.endTime,
        changeType: 'shifted',
        changeReason: `Moved from ${prevBlock.startTime}-${prevBlock.endTime} to ${pBlock.startTime}-${pBlock.endTime} to accommodate schedule updates.`
      });
    } else {
      unaffectedBlocks.push(pBlock);
    }
  }

  // Displaced tasks that were in currentBlocks but are now unscheduled
  for (const unscheduled of baseProposal.unscheduledTasks) {
    const prevBlock = currentTaskBlockMap.get(unscheduled.taskId);
    if (prevBlock) {
      displacedBlocks.push({
        taskId: unscheduled.taskId,
        title: unscheduled.title,
        previousStartTime: prevBlock.startTime,
        previousEndTime: prevBlock.endTime,
        reason: unscheduled.reason || 'Could not fit in remaining available capacity.'
      });
    }
  }

  const changeSummary = {
    rescheduledCount: rescheduledBlocks.length,
    unaffectedCount: unaffectedBlocks.length,
    displacedCount: displacedBlocks.length,
    rescheduledBlocks,
    displacedBlocks,
    explanation: displacedBlocks.length > 0
      ? `Rescheduled ${rescheduledBlocks.length} task(s). ${displacedBlocks.length} task(s) could not fit in today's remaining time and need spillover.`
      : `Successfully adapted schedule: ${rescheduledBlocks.length} task(s) shifted to optimal slots.`
  };

  return normalizeScheduleProposal({
    ...baseProposal,
    status: PROPOSAL_STATUSES.PENDING_APPROVAL,
    algorithmVersion: ALGORITHM_VERSION,
    changeSummary,
    sourceSnapshotHash: generateSnapshotHash({
      baseHash: baseProposal.sourceSnapshotHash,
      rescheduleTime: Date.now(),
      missedCount: missedSet.size
    })
  });
}

/**
 * shared/domain/scheduling/scheduling.scoring.js
 * Decoupled task ranking and candidate slot suitability scoring.
 *
 * Task Ranking:
 * Global prioritization queue sorting tasks by deadline proximity, priority rank, and duration.
 *
 * Slot Suitability Scoring:
 * Evaluates candidate free intervals for a specific task using:
 * - Preferred focus hours match (40%)
 * - Contiguity and gap prevention (30%)
 * - Transition buffer proximity (20%)
 * - Earliness preference (10%)
 * Minus fragmentation penalty (up to 25 pts for unusable residual orphan slots).
 *
 * 100% deterministic, normalized, and platform-independent.
 */

import { 
  TASK_PRIORITY_RANKS, 
  SLOT_SUITABILITY_WEIGHTS, 
  FRAGMENTATION_PENALTY_MAX 
} from './scheduling.types.js';

import { 
  timeStringToMinutes, 
  resolveDeadlineMinutes 
} from './scheduling.utils.js';

/**
 * Ranks all flexible tasks into a deterministic scheduling queue.
 */
export function rankTasksForScheduling(tasks = [], targetDate, defaultWorkingEndStr = '18:00') {
  const eligible = (tasks || []).filter(t => {
    if (!t || t.deleted) return false;
    const isCompleted = t.status === 'completed' || t.completed === true;
    const isCancelled = t.status === 'cancelled';
    return !isCompleted && !isCancelled;
  });

  const scoredTasks = eligible.map(task => {
    const priority = (task.priority || 'medium').toLowerCase();
    const priorityRank = TASK_PRIORITY_RANKS[priority] || 2;

    // Deadline urgency calculation
    const deadlineMinutes = resolveDeadlineMinutes(task.dueDate, task.deadlineTime, targetDate, defaultWorkingEndStr);
    
    let urgencyScore = 0;
    if (deadlineMinutes < 0) {
      // Overdue
      urgencyScore = 100;
    } else if (deadlineMinutes <= 1440) {
      // Due today
      urgencyScore = 60;
    } else if (deadlineMinutes <= 2880) {
      // Due tomorrow
      urgencyScore = 35;
    } else if (deadlineMinutes <= 4320) {
      // Due in 2 days
      urgencyScore = 20;
    } else if (deadlineMinutes < Infinity) {
      // Due later
      urgencyScore = 10;
    } else {
      // No deadline
      urgencyScore = 0;
    }

    const priorityScore = priorityRank * 10; // urgent: 40, high: 30, med: 20, low: 10
    const totalRankScore = urgencyScore + priorityScore;

    return {
      task,
      priorityRank,
      deadlineMinutes,
      urgencyScore,
      priorityScore,
      totalRankScore,
      estimatedMinutes: typeof task.estimatedMinutes === 'number' && task.estimatedMinutes > 0 
        ? task.estimatedMinutes 
        : null
    };
  });

  // Deterministic tie-breaker sort
  scoredTasks.sort((a, b) => {
    // 1. Total rank score DESC
    if (b.totalRankScore !== a.totalRankScore) {
      return b.totalRankScore - a.totalRankScore;
    }
    // 2. Deadline minutes ASC (closer deadline first)
    if (a.deadlineMinutes !== b.deadlineMinutes) {
      return a.deadlineMinutes - b.deadlineMinutes;
    }
    // 3. Priority rank DESC
    if (b.priorityRank !== a.priorityRank) {
      return b.priorityRank - a.priorityRank;
    }
    // 4. Estimated minutes DESC (longer tasks first to minimize bin fragmentation)
    const durA = a.estimatedMinutes || 0;
    const durB = b.estimatedMinutes || 0;
    if (durB !== durA) {
      return durB - durA;
    }
    // 5. Creation timestamp ASC (first in queue)
    const createdA = a.task.createdAt || 0;
    const createdB = b.task.createdAt || 0;
    if (createdA !== createdB) {
      return createdA - createdB;
    }
    // 6. Stable ID alphabetical ASC
    return String(a.task.id).localeCompare(String(b.task.id));
  });

  return scoredTasks;
}

/**
 * Scores a candidate free slot for placing a specific task.
 * Returns { score: number, breakdown: object, candidateInterval: { start, end } }
 */
export function scoreCandidateSlot(slot, taskDurationMinutes, options = {}) {
  const {
    focusSlot = null,
    minSessionMinutes = 25,
    totalWorkingMinutes = 540,
    isAdjacentToBusyStart = false,
    isAdjacentToBusyEnd = false
  } = options;

  const slotCapacity = slot.end - slot.start;
  if (slotCapacity < taskDurationMinutes) {
    return {
      feasible: false,
      score: -1,
      reason: 'Slot capacity smaller than required duration'
    };
  }

  // Proposed task placement is at slot.start
  const proposedPlacement = {
    start: slot.start,
    end: slot.start + taskDurationMinutes
  };

  // 1. Preferred Focus Slot Match (Weight: 40)
  let focusScore = 0;
  if (focusSlot && focusSlot.start && focusSlot.end) {
    const fStart = timeStringToMinutes(focusSlot.start);
    const fEnd = timeStringToMinutes(focusSlot.end);

    if (!isNaN(fStart) && !isNaN(fEnd) && fEnd > fStart) {
      const overlapStart = Math.max(proposedPlacement.start, fStart);
      const overlapEnd = Math.min(proposedPlacement.end, fEnd);
      if (overlapEnd > overlapStart) {
        const overlapMinutes = overlapEnd - overlapStart;
        const ratio = Math.min(1, overlapMinutes / taskDurationMinutes);
        focusScore = ratio * SLOT_SUITABILITY_WEIGHTS.PREFERRED_FOCUS_MATCH;
      }
    }
  }

  // 2. Contiguity Bonus (Weight: 30)
  // Placing tasks abutting an existing block or lunch break prevents scattered fragmentation
  let contiguityScore = 0;
  if (isAdjacentToBusyStart || proposedPlacement.start === slot.start) {
    contiguityScore += (SLOT_SUITABILITY_WEIGHTS.CONTIGUITY_BONUS * 0.7);
  }
  if (isAdjacentToBusyEnd || proposedPlacement.end === slot.end) {
    contiguityScore += (SLOT_SUITABILITY_WEIGHTS.CONTIGUITY_BONUS * 0.3);
  }
  contiguityScore = Math.min(SLOT_SUITABILITY_WEIGHTS.CONTIGUITY_BONUS, contiguityScore);

  // 3. Buffer Proximity (Weight: 20)
  // Slot has at least standard 10-15 min transition buffer around it
  const bufferScore = SLOT_SUITABILITY_WEIGHTS.BUFFER_PROXIMITY;

  // 4. Earliness Preference (Weight: 10)
  // Higher energy early in the working day
  const normalizedStart = Math.max(0, Math.min(1440, proposedPlacement.start));
  const earlinessScore = Math.max(0, 1 - (normalizedStart / 1440)) * SLOT_SUITABILITY_WEIGHTS.EARLINESS_PREFERENCE;

  // 5. Fragmentation Penalty (Up to 25 pts)
  // If placement leaves residual orphan gap < minSessionMinutes
  const residualGap = slot.end - proposedPlacement.end;
  let fragmentationPenalty = 0;
  if (residualGap > 0 && residualGap < minSessionMinutes) {
    const severityRatio = (minSessionMinutes - residualGap) / minSessionMinutes;
    fragmentationPenalty = severityRatio * FRAGMENTATION_PENALTY_MAX;
  }

  const rawScore = focusScore + contiguityScore + bufferScore + earlinessScore - fragmentationPenalty;
  const finalScore = Number(Math.max(0, Math.min(100, rawScore)).toFixed(2));

  return {
    feasible: true,
    score: finalScore,
    proposedPlacement,
    breakdown: {
      focusScore,
      contiguityScore,
      bufferScore,
      earlinessScore,
      fragmentationPenalty
    }
  };
}


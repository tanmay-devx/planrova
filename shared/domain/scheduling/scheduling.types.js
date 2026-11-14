/**
 * shared/domain/scheduling/scheduling.types.js
 * Domain types, enumerations, constants, weights, and thresholds for Planrova 2.0 Adaptive Planning.
 */

export const ALGORITHM_VERSION = '1.0.0';

/**
 * Permitted schedule block types
 */
export const BLOCK_TYPES = Object.freeze({
  TASK: 'task',
  FIXED_EVENT: 'fixed_event',
  LECTURE: 'lecture',
  BUFFER: 'buffer',
  BREAK: 'break'
});

export const VALID_BLOCK_TYPES = Object.freeze(Object.values(BLOCK_TYPES));

/**
 * Schedule Proposal lifecycle statuses
 */
export const PROPOSAL_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  ACCEPTED: 'accepted',
  PARTIALLY_ACCEPTED: 'partially_accepted',
  REJECTED: 'rejected',
  STALE: 'stale',
  SUPERSEDED: 'superseded'
});

export const VALID_PROPOSAL_STATUSES = Object.freeze(Object.values(PROPOSAL_STATUSES));

/**
 * Scheduling conflict classifications and severities
 */
export const CONFLICT_TYPES = Object.freeze({
  OVERLAP: 'overlap',
  DEADLINE_VIOLATION: 'deadline_violation',
  AVAILABILITY_BREACH: 'availability_breach',
  LOCKED_BLOCK_CONFLICT: 'locked_block_conflict',
  INVALID_TIME_RANGE: 'invalid_time_range',
  INSUFFICIENT_BREAK: 'insufficient_break',
  EXCESSIVE_WORKLOAD: 'excessive_workload'
});

export const CONFLICT_SEVERITIES = Object.freeze({
  HARD: 'hard', // Infeasible: overlapping fixed commitments, past deadline, outside availability
  SOFT: 'soft'  // Quality warning: insufficient break, high fatigue, outside preferred focus hours
});

/**
 * Workload classification heuristics (non-overlapping boundaries)
 * Utilization = scheduledFlexibleMinutes / flexibleCapacity
 */
export const WORKLOAD_CLASSIFICATIONS = Object.freeze({
  LIGHT: 'light',           // [0.00, 0.40)
  BALANCED: 'balanced',     // [0.40, 0.80)
  HEAVY: 'heavy',           // [0.80, 1.00]
  OVERLOADED: 'overloaded'  // > 1.00 (or scheduled > flexibleCapacity, or capacity == 0 with scheduled > 0)
});

export const WORKLOAD_THRESHOLDS = Object.freeze({
  LIGHT_MAX: 0.40,
  BALANCED_MAX: 0.80,
  HEAVY_MAX: 1.00
});

/**
 * Deterministic Task Urgency and Priority Rank mapping
 */
export const TASK_PRIORITY_RANKS = Object.freeze({
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
});

/**
 * Calibrated Slot Suitability Weights (strictly summing to 100)
 * Evaluated for candidate free intervals for a given task.
 */
export const SLOT_SUITABILITY_WEIGHTS = Object.freeze({
  PREFERRED_FOCUS_MATCH: 40, // Overlap with user's preferred focus slot
  CONTIGUITY_BONUS: 30,      // Adjacent to existing block or break, preventing scattered gaps
  BUFFER_PROXIMITY: 20,      // Leaves adequate transition buffer before/after commitments
  EARLINESS_PREFERENCE: 10   // Preference for scheduling earlier in the working day
});

/**
 * Penalty applied when slot leaves an unusable residual orphan fragment (< minSessionMinutes)
 */
export const FRAGMENTATION_PENALTY_MAX = 25;

/**
 * Default Scheduling and Availability Preferences
 */
export const DEFAULT_SCHEDULING_PREFERENCES = Object.freeze({
  minSessionMinutes: 25,
  maxSessionMinutes: 90,
  breakBetweenSessionsMinutes: 10,
  defaultWorkingHours: Object.freeze({
    start: '09:00',
    end: '18:00'
  }),
  defaultFocusSlot: Object.freeze({
    start: '09:30',
    end: '12:30'
  }),
  lunchBreak: Object.freeze({
    start: '13:00',
    end: '14:00'
  }),
  allowTaskSplitting: false,
  timezone: 'Asia/Kolkata'
});


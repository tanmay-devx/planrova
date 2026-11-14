/**
 * shared/domain/scheduling/scheduling.validation.js
 * Comprehensive validation, schema verification, and normalization for Planrova 2.0 scheduling.
 */

import { 
  ALGORITHM_VERSION,
  VALID_BLOCK_TYPES, 
  VALID_PROPOSAL_STATUSES,
  PROPOSAL_STATUSES,
  DEFAULT_SCHEDULING_PREFERENCES 
} from './scheduling.types.js';

import { 
  timeStringToMinutes, 
  minutesToTimeString, 
  calculateDurationMinutes,
  generateSnapshotHash,
  classifyWorkload,
  calculateWorkloadUtilization
} from './scheduling.utils.js';

// ── 1. Availability Validation & Normalization ───────────────────────

export function validateAvailability(availability) {
  const errors = [];
  if (!availability || typeof availability !== 'object') {
    return { valid: false, errors: ['Availability must be an object'] };
  }

  if (availability.userId && typeof availability.userId !== 'string') {
    errors.push('userId must be a string');
  }

  // Working hours check
  if (availability.defaultWorkingHours) {
    const { start, end } = availability.defaultWorkingHours;
    const sMin = timeStringToMinutes(start);
    const eMin = timeStringToMinutes(end);
    if (isNaN(sMin) || isNaN(eMin)) {
      errors.push('defaultWorkingHours start and end must be valid "HH:MM" strings');
    } else if (sMin >= eMin) {
      errors.push('defaultWorkingHours start must precede end time');
    }
  }

  // Session limits check
  if (availability.preferences) {
    const { minSessionMinutes, maxSessionMinutes, breakBetweenSessionsMinutes } = availability.preferences;
    if (typeof minSessionMinutes === 'number' && minSessionMinutes < 5) {
      errors.push('minSessionMinutes must be at least 5 minutes');
    }
    if (typeof maxSessionMinutes === 'number' && maxSessionMinutes > 360) {
      errors.push('maxSessionMinutes cannot exceed 360 minutes');
    }
    if (typeof minSessionMinutes === 'number' && typeof maxSessionMinutes === 'number' && minSessionMinutes > maxSessionMinutes) {
      errors.push('minSessionMinutes cannot exceed maxSessionMinutes');
    }
    if (typeof breakBetweenSessionsMinutes === 'number' && breakBetweenSessionsMinutes < 0) {
      errors.push('breakBetweenSessionsMinutes cannot be negative');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeAvailability(raw = {}) {
  const userId = raw.userId || 'local';
  const timezone = raw.timezone || DEFAULT_SCHEDULING_PREFERENCES.timezone;
  const isUserConfigured = raw.isUserConfigured !== undefined 
    ? Boolean(raw.isUserConfigured) 
    : false;

  const defaultWorkingHours = {
    start: raw.defaultWorkingHours?.start || DEFAULT_SCHEDULING_PREFERENCES.defaultWorkingHours.start,
    end: raw.defaultWorkingHours?.end || DEFAULT_SCHEDULING_PREFERENCES.defaultWorkingHours.end
  };

  const defaultFocusSlot = {
    start: raw.preferences?.defaultFocusSlot?.start || DEFAULT_SCHEDULING_PREFERENCES.defaultFocusSlot.start,
    end: raw.preferences?.defaultFocusSlot?.end || DEFAULT_SCHEDULING_PREFERENCES.defaultFocusSlot.end
  };

  const preferences = {
    minSessionMinutes: raw.preferences?.minSessionMinutes || DEFAULT_SCHEDULING_PREFERENCES.minSessionMinutes,
    maxSessionMinutes: raw.preferences?.maxSessionMinutes || DEFAULT_SCHEDULING_PREFERENCES.maxSessionMinutes,
    breakBetweenSessionsMinutes: raw.preferences?.breakBetweenSessionsMinutes !== undefined
      ? raw.preferences.breakBetweenSessionsMinutes
      : DEFAULT_SCHEDULING_PREFERENCES.breakBetweenSessionsMinutes,
    allowTaskSplitting: raw.preferences?.allowTaskSplitting !== undefined
      ? Boolean(raw.preferences.allowTaskSplitting)
      : DEFAULT_SCHEDULING_PREFERENCES.allowTaskSplitting,
    lunchBreak: raw.preferences?.lunchBreak || raw.lunchBreak || DEFAULT_SCHEDULING_PREFERENCES.lunchBreak,
    defaultFocusSlot
  };

  // Default weekday rules (0=Sunday to 6=Saturday)
  const defaultWeekdayRules = {
    0: { active: false }, // Sunday off by default
    1: { active: true, start: defaultWorkingHours.start, end: defaultWorkingHours.end, focusSlot: defaultFocusSlot },
    2: { active: true, start: defaultWorkingHours.start, end: defaultWorkingHours.end, focusSlot: defaultFocusSlot },
    3: { active: true, start: defaultWorkingHours.start, end: defaultWorkingHours.end, focusSlot: defaultFocusSlot },
    4: { active: true, start: defaultWorkingHours.start, end: defaultWorkingHours.end, focusSlot: defaultFocusSlot },
    5: { active: true, start: defaultWorkingHours.start, end: defaultWorkingHours.end, focusSlot: defaultFocusSlot },
    6: { active: true, start: '10:00', end: '15:00', focusSlot: { start: '10:00', end: '13:00' } } // Saturday
  };

  const dayNameToIndex = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const rawWeekdayInput = raw.weekdayRules || raw.workingHours || {};
  const normalizedWeekdayRules = { ...defaultWeekdayRules };

  for (const [key, val] of Object.entries(rawWeekdayInput)) {
    if (!val || typeof val !== 'object') continue;
    const lowerKey = String(key).toLowerCase();
    const idx = dayNameToIndex[lowerKey] !== undefined ? dayNameToIndex[lowerKey] : Number(key);
    if (!isNaN(idx) && idx >= 0 && idx <= 6) {
      normalizedWeekdayRules[idx] = {
        active: val.active !== undefined ? Boolean(val.active) : true,
        start: val.start || defaultWorkingHours.start,
        end: val.end || defaultWorkingHours.end,
        focusSlot: val.focusSlot || defaultFocusSlot
      };
    }
  }

  const customExceptions = Array.isArray(raw.customExceptions) ? [...raw.customExceptions] : [];

  return {
    userId,
    timezone,
    isUserConfigured,
    defaultWorkingHours,
    weekdayRules: normalizedWeekdayRules,
    preferences,
    customExceptions,
    schemaVersion: 1
  };
}

// ── 2. ScheduleBlock Validation & Normalization ───────────────────────

export function validateScheduleBlock(block) {
  const errors = [];
  if (!block || typeof block !== 'object') {
    return { valid: false, errors: ['ScheduleBlock must be an object'] };
  }

  if (!block.id || typeof block.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  if (!block.date || !/^\d{4}-\d{2}-\d{2}$/.test(block.date)) {
    errors.push('date must be in YYYY-MM-DD format');
  }

  const sMin = timeStringToMinutes(block.startTime);
  const eMin = timeStringToMinutes(block.endTime);

  if (isNaN(sMin) || isNaN(eMin)) {
    errors.push('startTime and endTime must be valid "HH:MM" format');
  } else if (sMin >= eMin) {
    errors.push('startTime must be strictly before endTime');
  }

  if (block.blockType && !VALID_BLOCK_TYPES.includes(block.blockType)) {
    errors.push(`Invalid blockType "${block.blockType}". Valid: ${VALID_BLOCK_TYPES.join(', ')}`);
  }

  if (typeof block.durationMinutes === 'number' && !isNaN(sMin) && !isNaN(eMin)) {
    const expected = eMin - sMin;
    if (block.durationMinutes !== expected) {
      errors.push(`durationMinutes (${block.durationMinutes}) does not match time interval (${expected})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeScheduleBlock(raw = {}) {
  const now = Date.now();
  const date = raw.date || new Date().toISOString().split('T')[0];
  const startTime = raw.startTime || '09:00';
  const endTime = raw.endTime || '09:30';
  const durationMinutes = calculateDurationMinutes(startTime, endTime);
  const blockType = VALID_BLOCK_TYPES.includes(raw.blockType) ? raw.blockType : 'task';
  const sourceEntityId = raw.sourceEntityId || raw.taskId || null;
  const title = (raw.title || 'Scheduled Block').trim();
  const isFixed = Boolean(raw.isFixed);
  const isLocked = Boolean(raw.isLocked);
  const isCompleted = Boolean(raw.isCompleted);
  const splitInfo = raw.splitInfo ? {
    part: Number(raw.splitInfo.part) || 1,
    totalParts: Number(raw.splitInfo.totalParts) || 1,
    parentTaskId: String(raw.splitInfo.parentTaskId || sourceEntityId || '')
  } : null;

  // Stable deterministic ID generation
  let id = raw.id;
  if (!id) {
    if (splitInfo && splitInfo.parentTaskId) {
      id = `sb_${splitInfo.parentTaskId}_p${splitInfo.part}`;
    } else if (sourceEntityId) {
      id = `sb_${sourceEntityId}_${date}_${startTime.replace(':', '')}`;
    } else {
      id = `sb_${now}_${Math.floor(Math.random() * 1000)}`;
    }
  }

  const provenance = raw.provenance || {
    scheduledBy: 'user',
    score: 100,
    reason: 'Manually placed'
  };

  return {
    id,
    date,
    startTime,
    endTime,
    durationMinutes: Math.max(0, durationMinutes),
    blockType,
    sourceEntityId,
    title,
    isFixed,
    isLocked,
    isCompleted,
    splitInfo,
    provenance,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    schemaVersion: 1
  };
}

// ── 3. ScheduleProposal Validation & Normalization ────────────────────

export function validateScheduleProposal(proposal) {
  const errors = [];
  if (!proposal || typeof proposal !== 'object') {
    return { valid: false, errors: ['ScheduleProposal must be an object'] };
  }

  if (!proposal.id || typeof proposal.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  if (!proposal.targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(proposal.targetDate)) {
    errors.push('targetDate must be in YYYY-MM-DD format');
  }

  if (proposal.status && !VALID_PROPOSAL_STATUSES.includes(proposal.status)) {
    errors.push(`Invalid status "${proposal.status}". Valid: ${VALID_PROPOSAL_STATUSES.join(', ')}`);
  }

  if (!proposal.sourceSnapshotHash || typeof proposal.sourceSnapshotHash !== 'string') {
    errors.push('sourceSnapshotHash is required to ensure version freshness');
  }

  if (!Array.isArray(proposal.proposedBlocks)) {
    errors.push('proposedBlocks must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeScheduleProposal(raw = {}) {
  const now = Date.now();
  const id = raw.id || `prop_${now}_${Math.floor(Math.random() * 1000)}`;
  const userId = raw.userId || 'local';
  const targetDate = raw.targetDate || new Date().toISOString().split('T')[0];
  const timezone = raw.timezone || DEFAULT_SCHEDULING_PREFERENCES.timezone;
  const status = VALID_PROPOSAL_STATUSES.includes(raw.status) ? raw.status : PROPOSAL_STATUSES.DRAFT;
  const algorithmVersion = raw.algorithmVersion || ALGORITHM_VERSION;
  const sourceSnapshotHash = raw.sourceSnapshotHash || generateSnapshotHash({ targetDate, timestamp: now });

  const proposedBlocks = Array.isArray(raw.proposedBlocks)
    ? raw.proposedBlocks.map(normalizeScheduleBlock)
    : [];

  const unscheduledTasks = Array.isArray(raw.unscheduledTasks)
    ? [...raw.unscheduledTasks]
    : [];

  const conflicts = Array.isArray(raw.conflicts) ? [...raw.conflicts] : [];
  const buffers = Array.isArray(raw.buffers) ? [...raw.buffers] : [];

  const workload = raw.workload || {
    date: targetDate,
    totalAvailableMinutes: 480,
    fixedCommitmentMinutes: 0,
    scheduledWorkMinutes: proposedBlocks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0),
    breakMinutes: 0,
    unallocatedMinutes: 480,
    unscheduledTaskMinutes: unscheduledTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0),
    capacityUtilization: 0,
    classification: 'balanced',
    explanation: 'Proposal generated.',
    priorityDistribution: { urgent: 0, high: 0, medium: 0, low: 0 }
  };

  return {
    id,
    userId,
    targetDate,
    timezone,
    status,
    algorithmVersion,
    sourceSnapshotHash,
    proposedBlocks,
    unscheduledTasks,
    workload,
    conflicts,
    buffers,
    changeSummary: raw.changeSummary || null,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    schemaVersion: 1
  };
}

// ── 4. Proposal Freshness Validator (Stale Strategy) ──────────────────

/**
 * Validates whether a ScheduleProposal is still fresh against current tasks and fixed events.
 * Returns { isFresh: boolean, reason: string | null }
 */
export function validateProposalFreshness(proposal, currentSnapshot = {}) {
  if (!proposal) {
    return { isFresh: false, reason: 'Proposal does not exist' };
  }

  if (proposal.status === PROPOSAL_STATUSES.STALE || proposal.status === PROPOSAL_STATUSES.SUPERSEDED) {
    return { isFresh: false, reason: `Proposal has already been marked ${proposal.status}` };
  }

  // Check 1: Algorithm version compatibility
  if (proposal.algorithmVersion !== ALGORITHM_VERSION) {
    return {
      isFresh: false,
      reason: `Proposal algorithm version (${proposal.algorithmVersion}) differs from active version (${ALGORITHM_VERSION})`
    };
  }

  // Check 2: Full Snapshot Hash match
  if (currentSnapshot.hash) {
    if (proposal.sourceSnapshotHash !== currentSnapshot.hash) {
      return {
        isFresh: false,
        reason: 'Underlying tasks, calendar events, or availability have changed since proposal generation'
      };
    }
  }

  // Check 3: Task mutation drift check (if tasks array passed)
  if (Array.isArray(currentSnapshot.tasks)) {
    const taskMap = new Map(currentSnapshot.tasks.map(t => [t.id, t]));

    for (const block of (proposal.proposedBlocks || [])) {
      if (block.blockType === 'task' && block.sourceEntityId) {
        const liveTask = taskMap.get(block.sourceEntityId);

        if (!liveTask || liveTask.deleted) {
          return {
            isFresh: false,
            reason: `Task "${block.title}" was deleted after proposal was generated`
          };
        }

        if (liveTask.status === 'completed' || liveTask.completed === true) {
          return {
            isFresh: false,
            reason: `Task "${liveTask.title}" has already been completed`
          };
        }

        if (liveTask.status === 'cancelled') {
          return {
            isFresh: false,
            reason: `Task "${liveTask.title}" was cancelled after proposal was generated`
          };
        }

        if (liveTask.updatedAt && liveTask.updatedAt > proposal.createdAt) {
          return {
            isFresh: false,
            reason: `Task "${liveTask.title}" was modified after proposal was generated`
          };
        }
      }
    }
  }

  // Check 4: Calendar Event Drift (fixed commitments changed on target date)
  if (Array.isArray(currentSnapshot.calendarEvents)) {
    for (const ev of currentSnapshot.calendarEvents) {
      if (ev && (ev.date === proposal.targetDate || ev.startDate === proposal.targetDate)) {
        if (ev.updatedAt && ev.updatedAt > proposal.createdAt) {
          return {
            isFresh: false,
            reason: `Fixed calendar event "${ev.title || 'Event'}" was modified after proposal was generated`
          };
        }
      }
    }
  }

  // Check 5: Availability Configuration Drift
  if (currentSnapshot.availability && currentSnapshot.availability.updatedAt) {
    if (currentSnapshot.availability.updatedAt > proposal.createdAt) {
      return {
        isFresh: false,
        reason: 'User working hours or availability preferences were updated after proposal was generated'
      };
    }
  }

  // Check 6: Locked Schedule Blocks Drift
  if (Array.isArray(currentSnapshot.lockedBlocks)) {
    for (const lb of currentSnapshot.lockedBlocks) {
      if (lb && lb.date === proposal.targetDate && lb.updatedAt && lb.updatedAt > proposal.createdAt) {
        return {
          isFresh: false,
          reason: `Locked schedule block "${lb.title || 'Block'}" was modified after proposal was generated`
        };
      }
    }
  }

  return { isFresh: true, reason: null };
}


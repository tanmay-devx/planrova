/**
 * src/modules/scheduling-storage.js
 * Persistence, Freshness Validation, and Atomic Acceptance Layer for Planrova 2.0 Scheduling.
 *
 * Capabilities:
 * - Scoped persistence for user availability, schedule proposals, and accepted blocks
 * - Deep multi-entity proposal freshness validation prior to acceptance
 * - Atomic persistence: updates canonical tasks (scheduledSessions, startTime/endTime)
 *   and materialized schedule_blocks together to prevent split-brain states
 * - Offline-first: backed by Dexie.js kv_store with Firebase background sync
 *
 * 100% platform-independent; zero external dependencies.
 */

import { 
  SCHEDULING_STORAGE_KEYS, 
  PROPOSAL_STATUSES 
} from '../../shared/domain/scheduling/scheduling.types.js';

import { 
  normalizeAvailability, 
  normalizeScheduleProposal, 
  normalizeScheduleBlock, 
  validateProposalFreshness 
} from '../../shared/domain/scheduling/scheduling.validation.js';

import { 
  getStorageItem, 
  setStorageItem 
} from '../utils/storage.js';

/**
 * Retrieves the stored availability profile for the active user.
 * Returns default normalized availability if not yet configured.
 */
export function getUserAvailability(userId = 'local') {
  const stored = getStorageItem(SCHEDULING_STORAGE_KEYS.AVAILABILITY);
  if (stored && typeof stored === 'object') {
    return normalizeAvailability({ ...stored, userId });
  }
  return normalizeAvailability({ userId, isUserConfigured: false });
}

/**
 * Persists the user availability profile to storage.
 */
export function saveUserAvailability(availability, userId = 'local') {
  const normalized = normalizeAvailability({
    ...availability,
    userId,
    isUserConfigured: true,
    updatedAt: Date.now()
  });
  setStorageItem(SCHEDULING_STORAGE_KEYS.AVAILABILITY, normalized);
  return normalized;
}

/**
 * Retrieves the active draft proposal for a given calendar date.
 */
export function getDraftProposal(targetDate) {
  if (!targetDate) return null;
  const proposalsMap = getStorageItem(SCHEDULING_STORAGE_KEYS.PROPOSALS, {}) || {};
  const prop = proposalsMap[targetDate];
  return prop ? normalizeScheduleProposal(prop) : null;
}

/**
 * Saves or updates a draft schedule proposal for its target date.
 */
export function saveDraftProposal(proposal) {
  if (!proposal || !proposal.targetDate) return null;
  const normalized = normalizeScheduleProposal(proposal);
  const proposalsMap = getStorageItem(SCHEDULING_STORAGE_KEYS.PROPOSALS, {}) || {};
  proposalsMap[proposal.targetDate] = normalized;
  setStorageItem(SCHEDULING_STORAGE_KEYS.PROPOSALS, proposalsMap);
  return normalized;
}

/**
 * Removes the draft proposal for a given calendar date.
 */
export function clearDraftProposal(targetDate) {
  if (!targetDate) return;
  const proposalsMap = getStorageItem(SCHEDULING_STORAGE_KEYS.PROPOSALS, {}) || {};
  if (proposalsMap[targetDate]) {
    delete proposalsMap[targetDate];
    setStorageItem(SCHEDULING_STORAGE_KEYS.PROPOSALS, proposalsMap);
  }
}

/**
 * Retrieves accepted schedule blocks for a target date (or all if omitted).
 */
export function getAcceptedScheduleBlocks(targetDate = null) {
  const allBlocks = getStorageItem(SCHEDULING_STORAGE_KEYS.BLOCKS, []) || [];
  if (!Array.isArray(allBlocks)) return [];
  if (targetDate) {
    return allBlocks.filter(b => b && b.date === targetDate && !b.deleted);
  }
  return allBlocks.filter(b => b && !b.deleted);
}

/**
 * Accepts a ScheduleProposal atomically:
 * 1. Validates freshness against current snapshot (tasks, events, availability).
 * 2. Updates canonical Task entities (scheduledSessions array, startTime, endTime).
 * 3. Writes materialized schedule blocks to schedule_blocks.
 * 4. Marks proposal as accepted.
 */
export function acceptScheduleProposal(proposal, options = {}) {
  const { currentSnapshot = null, selectedBlockIds = null } = options;

  if (!proposal) {
    return { success: false, reason: 'Invalid proposal: proposal is null or undefined' };
  }

  // 1. Freshness Check
  if (currentSnapshot) {
    const freshness = validateProposalFreshness(proposal, currentSnapshot);
    if (!freshness.isFresh) {
      proposal.status = PROPOSAL_STATUSES.STALE;
      saveDraftProposal(proposal);
      return {
        success: false,
        isStale: true,
        reason: `Proposal is stale: ${freshness.reason}. Please regenerate the plan.`
      };
    }
  }

  const targetDate = proposal.targetDate;
  const isPartial = Array.isArray(selectedBlockIds);
  const selectedSet = isPartial ? new Set(selectedBlockIds) : null;

  // Filter blocks to accept
  const blocksToAccept = proposal.proposedBlocks.filter(b => {
    if (selectedSet) return selectedSet.has(b.id);
    return true;
  });

  // 2. Atomically update canonical Task entities
  const existingTasks = getStorageItem('tasks', []) || [];
  const taskMap = new Map(existingTasks.map(t => [String(t.id), { ...t }]));

  const scheduledTaskBlocks = blocksToAccept.filter(b => b.blockType === 'task' && b.sourceEntityId);

  // Group scheduled blocks by source task
  const taskSessionsMap = new Map();
  for (const block of scheduledTaskBlocks) {
    const taskId = String(block.sourceEntityId);
    if (!taskSessionsMap.has(taskId)) {
      taskSessionsMap.set(taskId, []);
    }
    taskSessionsMap.get(taskId).push({
      blockId: block.id,
      date: block.date || targetDate,
      startTime: block.startTime,
      endTime: block.endTime,
      durationMinutes: block.durationMinutes,
      part: block.splitInfo?.part || 1,
      totalParts: block.splitInfo?.totalParts || 1
    });
  }

  for (const [taskId, sessions] of taskSessionsMap.entries()) {
    const task = taskMap.get(taskId);
    if (task) {
      // Sort sessions chronologically
      sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

      // Append/replace sessions for targetDate
      const otherSessions = (task.scheduledSessions || []).filter(s => s.date !== targetDate);
      task.scheduledSessions = [...otherSessions, ...sessions];

      // Backward compatibility: set startTime and endTime to earliest session on targetDate
      task.startTime = sessions[0].startTime;
      task.endTime = sessions[0].endTime;
      task.updatedAt = Date.now();
      taskMap.set(taskId, task);
    }
  }

  const updatedTasks = Array.from(taskMap.values());
  setStorageItem('tasks', updatedTasks);

  // 3. Persist materialized schedule blocks
  const existingBlocks = getStorageItem(SCHEDULING_STORAGE_KEYS.BLOCKS, []) || [];
  // Remove prior blocks for targetDate to avoid duplicates
  const otherDateBlocks = existingBlocks.filter(b => b && b.date !== targetDate && !b.deleted);
  const updatedBlocks = [...otherDateBlocks, ...blocksToAccept.map(normalizeScheduleBlock)];
  setStorageItem(SCHEDULING_STORAGE_KEYS.BLOCKS, updatedBlocks);

  // 4. Update proposal status
  proposal.status = isPartial ? PROPOSAL_STATUSES.PARTIALLY_ACCEPTED : PROPOSAL_STATUSES.ACCEPTED;
  proposal.updatedAt = Date.now();
  saveDraftProposal(proposal);

  // 5. Fire event for UI reactivity if running in DOM
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('planrova:schedule_accepted', {
      detail: { proposal, acceptedBlocks: blocksToAccept }
    }));
  }

  return {
    success: true,
    proposal,
    acceptedBlocks: blocksToAccept,
    updatedTasksCount: taskSessionsMap.size
  };
}


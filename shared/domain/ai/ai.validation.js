/**
 * shared/domain/ai/ai.validation.js
 * Schema and Safety Validators for AI Assistance Layer.
 */

import { AI_ACTION_TYPES, AI_PROPOSAL_STATUSES } from './ai.types.js';

export function validateProposal(proposal, expectedUserId = null) {
  const errors = [];

  if (!proposal || typeof proposal !== 'object') {
    return { valid: false, errors: ['Proposal must be a non-null object'] };
  }

  if (!proposal.id) {
    errors.push('Proposal id is required');
  }

  if (expectedUserId && proposal.userId && proposal.userId !== expectedUserId) {
    errors.push(`Proposal ownership mismatch: caller is ${expectedUserId} but proposal belongs to ${proposal.userId}`);
  }

  if (!Object.values(AI_ACTION_TYPES).includes(proposal.actionType)) {
    errors.push(`Invalid actionType: ${proposal.actionType}`);
  }

  if (!proposal.payload || typeof proposal.payload !== 'object') {
    errors.push('Proposal payload must be an object');
  } else {
    // Action-specific payload validation
    switch (proposal.actionType) {
      case AI_ACTION_TYPES.CREATE_TASK:
        if (!proposal.payload.title || typeof proposal.payload.title !== 'string' || !proposal.payload.title.trim()) {
          errors.push('CREATE_TASK payload requires a valid non-empty title');
        }
        break;

      case AI_ACTION_TYPES.RESCHEDULE_TASK:
        if (!proposal.payload.taskId) {
          errors.push('RESCHEDULE_TASK payload requires a taskId');
        }
        if (!proposal.payload.targetDate) {
          errors.push('RESCHEDULE_TASK payload requires a targetDate');
        }
        break;

      case AI_ACTION_TYPES.CREATE_STUDY_PLAN:
        if (!proposal.payload.courseId && !proposal.payload.courseName) {
          errors.push('CREATE_STUDY_PLAN payload requires a courseId or courseName');
        }
        if (!Array.isArray(proposal.payload.sessions) || proposal.payload.sessions.length === 0) {
          errors.push('CREATE_STUDY_PLAN payload requires at least one study session');
        }
        break;

      case AI_ACTION_TYPES.CREATE_NOTE:
        if (!proposal.payload.title && !proposal.payload.content) {
          errors.push('CREATE_NOTE payload requires at least title or content');
        }
        break;

      case AI_ACTION_TYPES.ADJUST_BUDGET:
        if (!proposal.payload.categoryId) {
          errors.push('ADJUST_BUDGET payload requires a categoryId');
        }
        if (typeof proposal.payload.newLimitMinor !== 'number' || proposal.payload.newLimitMinor <= 0) {
          errors.push('ADJUST_BUDGET payload requires a positive newLimitMinor');
        }
        break;

      case AI_ACTION_TYPES.UPDATE_ROUTINE:
        if (!proposal.payload.routineId && !proposal.payload.title) {
          errors.push('UPDATE_ROUTINE payload requires routineId or title');
        }
        break;
    }
  }

  // Check expiration
  if (proposal.expiresAt && new Date(proposal.expiresAt).getTime() < Date.now()) {
    errors.push('Proposal has expired');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateMessage(message) {
  const errors = [];
  if (!message || typeof message !== 'object') {
    return { valid: false, errors: ['Message must be an object'] };
  }
  if (!message.content || typeof message.content !== 'string' || !message.content.trim()) {
    errors.push('Message content cannot be empty');
  }
  if (message.content && message.content.length > 5000) {
    errors.push('Message content exceeds 5,000 character limit');
  }
  return {
    valid: errors.length === 0,
    errors
  };
}


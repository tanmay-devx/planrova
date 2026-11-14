/**
 * shared/domain/ai/ai.orchestrator.js
 * Central Orchestrator for Planrova 2.0 Hybrid AI Assistance Layer.
 *
 * Implements:
 * 1. Safe query processing pipeline (Permission check -> Minimization -> Inference -> Proposal Validation).
 * 2. Proposal-and-Approval workflow (Strict separation between proposals and database commits).
 * 3. Daily Intelligence Briefing generator.
 */

import {
  AI_ROLES,
  AI_PROPOSAL_STATUSES,
  AI_ACTION_TYPES,
  AI_INTENTS
} from './ai.types.js';
import {
  normalizeAIMessage,
  normalizeAIActionProposal
} from './ai.schemas.js';
import { isAIEnabled } from './ai.permissions.js';
import { inspectQueryForSafety, enforceActionExecutionPolicy } from './ai.policy.js';
import { classifyAIIntent } from './ai.intent.js';
import { assembleAIContext } from './ai.context.js';
import { MockAIProvider } from './ai.provider.js';
import { validateProposal } from './ai.validation.js';
import { redactSensitiveData, generateContextPrivacyNotice } from './ai.privacy.js';
import { checkUsageLimit, recordUsageAttempt } from './ai.usage.js';

export async function processAIQuery({
  query,
  conversationId = 'default',
  userId = 'local',
  userData = {},
  permissions = { enabled: false },
  usageRecord = null,
  provider = new MockAIProvider()
} = {}) {
  const sanitizedQuery = redactSensitiveData((query || '').trim());

  // 1. Opt-In Check: If AI is disabled, refuse to process personal context
  if (!isAIEnabled(permissions)) {
    return {
      userMessage: normalizeAIMessage({ conversationId, userId, role: AI_ROLES.USER, content: sanitizedQuery }),
      assistantMessage: normalizeAIMessage({
        conversationId,
        userId,
        role: AI_ROLES.ASSISTANT,
        content: 'Planrova AI is currently disabled in your settings. To enable assistance, visit AI Settings & Privacy and toggle "Enable Planrova AI".'
      }),
      proposals: [],
      privacyNotice: generateContextPrivacyNotice([], []),
      updatedUsage: usageRecord
    };
  }

  // 2. Safety & Policy Inspection
  const safety = inspectQueryForSafety(sanitizedQuery);
  if (!safety.isSafe) {
    return {
      userMessage: normalizeAIMessage({ conversationId, userId, role: AI_ROLES.USER, content: sanitizedQuery }),
      assistantMessage: normalizeAIMessage({
        conversationId,
        userId,
        role: AI_ROLES.ASSISTANT,
        content: `Your request could not be processed due to Planrova safety policies: ${safety.flags.join('; ')}`
      }),
      proposals: [],
      privacyNotice: generateContextPrivacyNotice([], []),
      updatedUsage: usageRecord
    };
  }

  // 3. Usage Rate Limit Check
  const usageCheck = checkUsageLimit(usageRecord, permissions);
  if (!usageCheck.isAllowed) {
    return {
      userMessage: normalizeAIMessage({ conversationId, userId, role: AI_ROLES.USER, content: sanitizedQuery }),
      assistantMessage: normalizeAIMessage({
        conversationId,
        userId,
        role: AI_ROLES.ASSISTANT,
        content: `Daily AI usage limit reached (${usageCheck.limit} requests/day). Limit resets tomorrow.`
      }),
      proposals: [],
      privacyNotice: generateContextPrivacyNotice([], []),
      updatedUsage: usageRecord
    };
  }

  // 4. Intent Classification
  const { intent } = classifyAIIntent(sanitizedQuery);

  // 5. Minimized Context Assembly
  const { contextText, categoriesIncluded, categoriesExcluded } = assembleAIContext({
    permissions,
    userData
  });

  // 6. Provider Inference (Local Mock or Server Proxy)
  const response = await provider.generateResponse({
    prompt: sanitizedQuery,
    context: contextText,
    intent
  });

  // 7. Validate & Normalize Any Action Proposals
  const validProposals = [];
  if (Array.isArray(response.suggestedProposals)) {
    for (const rawProp of response.suggestedProposals) {
      const prop = normalizeAIActionProposal({
        ...rawProp,
        conversationId,
        userId
      }, userId);

      const val = validateProposal(prop);
      if (val.valid) {
        validProposals.push(prop);
      }
    }
  }

  // 8. Record Usage
  const updatedUsage = recordUsageAttempt(usageRecord, Math.ceil((sanitizedQuery.length + contextText.length) / 4));

  const userMsg = normalizeAIMessage({
    conversationId,
    userId,
    role: AI_ROLES.USER,
    content: sanitizedQuery
  }, userId);

  const assistantMsg = normalizeAIMessage({
    conversationId,
    userId,
    role: AI_ROLES.ASSISTANT,
    content: response.text,
    contextCategoriesUsed: categoriesIncluded,
    proposalIds: validProposals.map(p => p.id)
  }, userId);

  return {
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    proposals: validProposals,
    privacyNotice: generateContextPrivacyNotice(categoriesIncluded, categoriesExcluded),
    updatedUsage
  };
}

/**
 * Executes an approved action proposal through verified canonical domain handlers.
 * Strict Invariant: Proposal must be in APPROVED state and not expired.
 */
export async function approveAndExecuteProposal({
  proposal,
  expectedUserId = null,
  domainHandlers = {}
} = {}) {
  if (!proposal) throw new Error('Proposal required');

  if (expectedUserId && proposal.userId && proposal.userId !== expectedUserId) {
    throw new Error(`Proposal ownership mismatch: caller is ${expectedUserId} but proposal belongs to ${proposal.userId}`);
  }

  if (proposal.approvalStatus === AI_PROPOSAL_STATUSES.EXECUTED) {
    return { executed: false, alreadyExecuted: true, proposal };
  }

  if (proposal.approvalStatus === AI_PROPOSAL_STATUSES.REJECTED) {
    throw new Error('Cannot execute a rejected proposal.');
  }

  // Set proposal to approved before execution validation
  const approvedProposal = {
    ...proposal,
    approvalStatus: AI_PROPOSAL_STATUSES.APPROVED
  };

  const policyCheck = enforceActionExecutionPolicy(approvedProposal);
  if (!policyCheck.allowed) {
    throw new Error(policyCheck.reason);
  }

  const val = validateProposal(approvedProposal, expectedUserId);
  if (!val.valid) {
    throw new Error(`Proposal validation failed: ${val.errors.join(', ')}`);
  }

  let executionResult = null;
  const handler = domainHandlers[approvedProposal.actionType];

  if (typeof handler === 'function') {
    executionResult = await handler(approvedProposal.payload);
  }

  const executedProposal = {
    ...approvedProposal,
    approvalStatus: AI_PROPOSAL_STATUSES.EXECUTED,
    executedAt: new Date().toISOString()
  };

  return {
    executed: true,
    proposal: executedProposal,
    result: executionResult
  };
}

/**
 * Rejects a proposed action.
 */
export function rejectProposal({ proposal }) {
  if (!proposal) throw new Error('Proposal required');
  return {
    ...proposal,
    approvalStatus: AI_PROPOSAL_STATUSES.REJECTED,
    rejectedAt: new Date().toISOString()
  };
}

/**
 * Generates an automated Daily Intelligence Briefing using authorized context.
 */
export async function generateDailyBriefing({
  userData = {},
  permissions = { enabled: false },
  targetDateStr = new Date().toISOString().slice(0, 10),
  provider = new MockAIProvider()
} = {}) {
  if (!isAIEnabled(permissions)) {
    return {
      briefingText: 'Planrova AI is disabled. Enable AI in settings to generate your daily briefing.',
      categoriesIncluded: []
    };
  }

  const { contextText, categoriesIncluded } = assembleAIContext({
    permissions,
    userData,
    targetDateStr
  });

  const response = await provider.generateResponse({
    prompt: `Generate a concise, motivating daily briefing for today (${targetDateStr}).`,
    context: contextText,
    intent: AI_INTENTS.SUMMARIZE_DAY
  });

  return {
    briefingText: response.text,
    categoriesIncluded
  };
}


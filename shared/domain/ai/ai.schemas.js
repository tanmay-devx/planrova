/**
 * shared/domain/ai/ai.schemas.js
 * Normalizers and Schemas for AI Assistance entities in Planrova 2.0.
 */

import {
  AI_ROLES,
  AI_ACTION_TYPES,
  AI_PROPOSAL_STATUSES
} from './ai.types.js';

export function normalizeAIConversation(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  return {
    id: raw.id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: raw.userId || userId,
    title: (raw.title || 'New Conversation').trim().slice(0, 100),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now
  };
}

export function normalizeAIMessage(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  return {
    id: raw.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    conversationId: raw.conversationId || 'default',
    userId: raw.userId || userId,
    role: Object.values(AI_ROLES).includes(raw.role) ? raw.role : AI_ROLES.USER,
    content: (raw.content || '').trim(),
    contextCategoriesUsed: Array.isArray(raw.contextCategoriesUsed) ? raw.contextCategoriesUsed : [],
    proposalIds: Array.isArray(raw.proposalIds) ? raw.proposalIds : [],
    createdAt: raw.createdAt || now
  };
}

export function normalizeAIActionProposal(raw = {}, userId = 'local') {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24-hour expiration

  return {
    id: raw.id || `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: raw.userId || userId,
    conversationId: raw.conversationId || 'default',
    actionType: Object.values(AI_ACTION_TYPES).includes(raw.actionType)
      ? raw.actionType
      : AI_ACTION_TYPES.CREATE_TASK,
    payload: raw.payload && typeof raw.payload === 'object' ? raw.payload : {},
    summary: (raw.summary || 'Proposed action').trim().slice(0, 200),
    approvalStatus: Object.values(AI_PROPOSAL_STATUSES).includes(raw.approvalStatus)
      ? raw.approvalStatus
      : AI_PROPOSAL_STATUSES.PENDING_APPROVAL,
    createdAt: raw.createdAt || now.toISOString(),
    expiresAt: raw.expiresAt || expiresAt
  };
}

export function normalizeAIPermissions(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  return {
    userId: raw.userId || userId,
    enabled: Boolean(raw.enabled), // Opt-in: defaults to FALSE
    cloudConsent: Boolean(raw.cloudConsent), // Explicit consent for cloud inference: defaults to FALSE
    domains: {
      tasks: raw.domains?.tasks !== undefined ? Boolean(raw.domains.tasks) : true,
      schedule: raw.domains?.schedule !== undefined ? Boolean(raw.domains.schedule) : true,
      academic: raw.domains?.academic !== undefined ? Boolean(raw.domains.academic) : true,
      notes: Boolean(raw.domains?.notes), // Default FALSE (sensitive user content)
      finance: Boolean(raw.domains?.finance), // Default FALSE (sensitive monetary data)
      habits: raw.domains?.habits !== undefined ? Boolean(raw.domains.habits) : true,
      wellbeing: Boolean(raw.domains?.wellbeing), // Default FALSE (sensitive private check-in reflections)
      preferences: raw.domains?.preferences !== undefined ? Boolean(raw.domains.preferences) : true
    },
    maxTokensPerRequest: Number(raw.maxTokensPerRequest) || 1000,
    dailyRequestLimit: Number(raw.dailyRequestLimit) || 30,
    updatedAt: raw.updatedAt || now
  };
}

export function normalizeAIUsageRecord(raw = {}, userId = 'local') {
  const safe = raw || {};
  const todayKey = new Date().toISOString().slice(0, 10);
  return {
    id: `usage_${userId}_${todayKey}`,
    userId: safe.userId || userId,
    dateKey: safe.dateKey || todayKey,
    requestCount: Number(safe.requestCount) || 0,
    totalTokensEstimated: Number(safe.totalTokensEstimated) || 0,
    lastRequestAt: safe.lastRequestAt || new Date().toISOString()
  };
}

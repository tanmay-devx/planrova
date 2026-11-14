/**
 * shared/domain/ai/ai.types.js
 * Canonical Types & Enums for Planrova 2.0 Hybrid AI Assistance Layer.
 *
 * Invariants:
 * 1. AI assistance is strictly opt-in and privacy-first.
 * 2. Deterministic engines remain authoritative for calculations and scheduling.
 * 3. AI generates proposals; only explicit user approval commits mutations.
 */

export const AI_ROLES = Object.freeze({
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant'
});

export const AI_CONTEXT_CATEGORIES = Object.freeze({
  TASKS: 'tasks',
  SCHEDULE: 'schedule',
  ACADEMIC: 'academic',
  NOTES: 'notes',
  FINANCE: 'finance',
  HABITS: 'habits',
  WELLBEING: 'wellbeing',
  PREFERENCES: 'preferences'
});

export const AI_INTENTS = Object.freeze({
  QUESTION: 'question',
  SUMMARIZE_DAY: 'summarize_day',
  EXPLAIN_CONFLICT: 'explain_conflict',
  TASK_PROPOSAL: 'task_proposal',
  EXPLAIN_ACADEMIC: 'explain_academic',
  ORGANIZE_NOTES: 'organize_notes',
  ROUTINE_IMPROVEMENT: 'routine_improvement',
  BUDGET_ADVICE: 'budget_advice',
  WELLBEING_ADVICE: 'wellbeing_advice',
  QUICK_CAPTURE: 'quick_capture'
});

export const AI_ACTION_TYPES = Object.freeze({
  CREATE_TASK: 'create_task',
  RESCHEDULE_TASK: 'reschedule_task',
  CREATE_STUDY_PLAN: 'create_study_plan',
  ADJUST_BUDGET: 'adjust_budget',
  CREATE_NOTE: 'create_note',
  UPDATE_ROUTINE: 'update_routine'
});

export const AI_PROPOSAL_STATUSES = Object.freeze({
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  EXECUTED: 'executed',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
});

export const AI_STORAGE_KEYS = Object.freeze({
  CONVERSATIONS: 'planrova_ai_conversations',
  MESSAGES: 'planrova_ai_messages',
  PROPOSALS: 'planrova_ai_proposals',
  PERMISSIONS: 'planrova_ai_permissions',
  USAGE: 'planrova_ai_usage'
});


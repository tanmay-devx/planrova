/**
 * shared/domain/ai/ai.intent.js
 * Deterministic Local Intent Classifier for Planrova AI.
 * Runs locally with 100% offline availability.
 */

import { AI_INTENTS } from './ai.types.js';

export function classifyAIIntent(query = '') {
  const q = (query || '').toLowerCase().trim();

  if (!q) {
    return { intent: AI_INTENTS.QUESTION, confidence: 1.0, entities: {} };
  }

  // Daily summary / today focus
  if (/focus\s+on\s+today|today'?s\s+plan|summarize\s+(my\s+)?day|what\s+should\s+i\s+do\s+today|daily\s+briefing/i.test(q)) {
    return { intent: AI_INTENTS.SUMMARIZE_DAY, confidence: 0.95, entities: {} };
  }

  // Schedule conflicts
  if (/conflict|overlap|clash|double\s+booked|reschedule/i.test(q)) {
    return { intent: AI_INTENTS.EXPLAIN_CONFLICT, confidence: 0.90, entities: {} };
  }

  // Academic / courses / flashcards / GPA
  if (/gpa|academic|syllabus|course|flashcard|study\s+plan|revision/i.test(q)) {
    return { intent: AI_INTENTS.EXPLAIN_ACADEMIC, confidence: 0.90, entities: {} };
  }

  // Budget / finance / expenses
  if (/budget|spent|money|expense|recurring\s+bill|subscription/i.test(q)) {
    return { intent: AI_INTENTS.BUDGET_ADVICE, confidence: 0.90, entities: {} };
  }

  // Wellbeing / habits / hydration / routine
  if (/habit|streak|water|hydration|routine|morning\s+ritual/i.test(q)) {
    return { intent: AI_INTENTS.WELLBEING_ADVICE, confidence: 0.90, entities: {} };
  }

  // Quick task proposal / reminder
  if (/remind\s+me|create\s+(a\s+)?task|add\s+(a\s+)?task|schedule\s+task|plan\s+\d+\s+hours/i.test(q)) {
    return { intent: AI_INTENTS.TASK_PROPOSAL, confidence: 0.85, entities: {} };
  }

  // Notes
  if (/note|organize\s+notes|summarize\s+notes/i.test(q)) {
    return { intent: AI_INTENTS.ORGANIZE_NOTES, confidence: 0.85, entities: {} };
  }

  return {
    intent: AI_INTENTS.QUESTION,
    confidence: 0.70,
    entities: {}
  };
}


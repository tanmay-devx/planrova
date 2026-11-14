/**
 * shared/domain/capture/capture.classifier.js
 * Deterministic Intent Classifier for Universal Quick Capture in Planrova 2.0
 */

import { CAPTURE_TYPES, CONFIDENCE_THRESHOLD } from './capture.schema.js';

/**
 * Classifies raw user input into one of the 7 supported entity types.
 * Returns:
 * {
 *   suggestedType: string,
 *   confidence: number,
 *   needsConfirmation: boolean,
 *   reasons: string[]
 * }
 */
export function classifyCapture(text = '', context = {}) {
  const raw = text.trim();
  if (!raw) {
    return {
      suggestedType: 'brain_dump',
      confidence: 0.1,
      needsConfirmation: true,
      reasons: ['Empty input']
    };
  }

  const lower = raw.toLowerCase();
  const reasons = [];

  // 1. Expense Detection
  // Keywords: spent, spend, bought, paid, cost, expense, ₹, $, rs, rupees
  const hasCurrencySign = /(?:₹|\$|\brs\.?|\brupees?\b)/i.test(lower);
  const hasSpendVerb = /\b(?:spent|spend|bought|paid|cost|expense|bill|kharcha)\b/i.test(lower);
  const hasAmount = /\b\d+(?:\.\d{1,2})?\b/.test(lower);

  if ((hasSpendVerb || hasCurrencySign) && hasAmount) {
    reasons.push('Contains spending keywords and currency/amount indicator');
    return {
      suggestedType: 'expense',
      confidence: hasCurrencySign && hasSpendVerb ? 0.98 : 0.92,
      needsConfirmation: false,
      reasons
    };
  }

  // 2. Reminder Detection
  // Keywords: remind me to, remind me, remember to, alert me
  const isReminder = /^(?:remind\s+(?:me\s+)?(?:to\s+)?|remember\s+to\s+|alert\s+me\s+to\s+|yaad\s+dilana)/i.test(lower);
  if (isReminder) {
    reasons.push('Explicit reminder imperative phrase detected');
    return {
      suggestedType: 'reminder',
      confidence: 0.95,
      needsConfirmation: false,
      reasons
    };
  }

  // 3. Habit Detection
  // Keywords: every day, daily, every morning, every evening, start reading, build habit
  const hasRecurrence = /\b(?:every\s+(?:day|morning|evening|night|week)|daily|roz|har\s+din)\b/i.test(lower);
  const hasHabitVerb = /\b(?:habit|routine|streak|build\s+habit|start\s+habit)\b/i.test(lower);
  if (hasRecurrence || hasHabitVerb) {
    reasons.push('Contains daily/recurring cadence or habit formation cues');
    return {
      suggestedType: 'habit',
      confidence: hasRecurrence && hasHabitVerb ? 0.96 : 0.90,
      needsConfirmation: false,
      reasons
    };
  }

  // 4. Calendar Event Detection
  // Keywords: lecture, meeting, class, appointment, interview, exam, webinar, call with
  // or explicit time range "from X to Y", "at 10am" with event nouns
  const hasEventNoun = /\b(?:lecture|class|meeting|sync|interview|exam|webinar|call\s+with|appointment|doctor|dentist|session|workshop)\b/i.test(lower);
  const hasTimeIndicator = /\b(?:at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|from\s+\d{1,2}\s*(?:am|pm)?\s*to\s+\d{1,2}\s*(?:am|pm)?|\d{1,2}\s*baje)\b/i.test(lower);
  
  if (hasEventNoun && hasTimeIndicator) {
    reasons.push('Contains scheduled event noun with specific start/end timing');
    return {
      suggestedType: 'calendar_event',
      confidence: 0.94,
      needsConfirmation: false,
      reasons
    };
  } else if (hasEventNoun) {
    reasons.push('Contains calendar event noun');
    return {
      suggestedType: 'calendar_event',
      confidence: 0.85,
      needsConfirmation: false,
      reasons
    };
  }

  // 5. Note / Knowledge Detection
  // Keywords: note:, remember that, summary:, formula:, key point:, idea:
  const isExplicitNote = /^(?:note:|remember\s+that|summary:|definition:|formula:|key\s+point:)/i.test(lower);
  const isDefinition = /\b(?:is\s+defined\s+as|stands\s+for|difference\s+between)\b/i.test(lower);
  if (isExplicitNote || isDefinition) {
    reasons.push('Contains knowledge definition, formula, or explicit note prefix');
    return {
      suggestedType: 'note',
      confidence: isExplicitNote ? 0.95 : 0.85,
      needsConfirmation: false,
      reasons
    };
  }

  // 6. Task Detection
  // Action verbs + deadlines
  const hasActionVerb = /\b(?:finish|complete|submit|read|study|prepare|write|clean|fix|solve|do|organize|review|send|email|draft|buy|purchase|khatam|bhejna)\b/i.test(lower);
  const hasTaskDeadline = /\b(?:tomorrow|today|tonight|kal|parso|next\s+week|by\s+\w+|before\s+\w+)\b/i.test(lower);
  
  if (hasActionVerb || hasTaskDeadline) {
    reasons.push('Action verb or executable deadline phrase detected');
    return {
      suggestedType: 'task',
      confidence: hasActionVerb && hasTaskDeadline ? 0.95 : 0.82,
      needsConfirmation: false,
      reasons
    };
  }

  // 7. Fallback to Brain Dump
  // General ideas, unclassified thoughts, low confidence inputs
  reasons.push('Ambiguous phrasing without distinct action verbs or entity markers; safely routing to Brain Dump');
  return {
    suggestedType: 'brain_dump',
    confidence: 0.50,
    needsConfirmation: true,
    reasons
  };
}


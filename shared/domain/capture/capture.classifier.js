/**
 * shared/domain/capture/capture.classifier.js
 * Deterministic Intent Classifier for Universal Quick Capture in Planrova 2.0
 */

import { CAPTURE_TYPES, CONFIDENCE_THRESHOLD } from './capture.schema.js';

/**
 * Classifies raw user input into one of the supported entity types.
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

  // 1. Hydration Detection
  // e.g. "drink 300 ml water", "drank 500ml", "log 250 ml water", "drink water"
  const isHydrationVerb = /\b(?:drink|drank|water|hydration|paani)\b/i.test(lower);
  const hasVolume = /\b\d+\s*(?:ml|milliliters?|liters?|l)\b/i.test(lower);
  if (isHydrationVerb) {
    if (hasVolume) {
      reasons.push('Contains hydration keywords and specific liquid volume');
      return {
        suggestedType: 'hydration',
        confidence: 0.96,
        needsConfirmation: false,
        reasons
      };
    } else if (lower.includes('water') || lower.startsWith('drink')) {
      reasons.push('Hydration intent detected but volume is unspecified');
      return {
        suggestedType: 'hydration',
        confidence: 0.70,
        needsConfirmation: true,
        reasons
      };
    }
  }

  // 2. Budget Detection
  // e.g. "set a monthly budget of 6000 for food", "monthly budget 5000", "budget 10000 for study"
  const isBudgetIntent = /\b(?:budget)\b/i.test(lower);
  const hasAmount = /\b\d+(?:\.\d{1,2})?\b/.test(lower);
  if (isBudgetIntent && hasAmount) {
    reasons.push('Contains budget configuration keywords and monetary limit');
    return {
      suggestedType: 'budget',
      confidence: 0.95,
      needsConfirmation: false,
      reasons
    };
  }

  // 3. Savings Goal Detection
  // e.g. "save 1000 every month", "savings goal 50000 for laptop"
  const isSavingsIntent = /\b(?:save|savings|bachat)\b/i.test(lower);
  if (isSavingsIntent && hasAmount) {
    const hasFrequencyOrGoal = /\b(?:every\s+(?:month|week|year)|monthly|weekly|for|goal)\b/i.test(lower);
    if (hasFrequencyOrGoal) {
      reasons.push('Savings goal with contribution cadence or target item detected');
      return {
        suggestedType: 'savings_goal',
        confidence: 0.94,
        needsConfirmation: false,
        reasons
      };
    } else {
      reasons.push('Savings intent detected but missing frequency or target goal details');
      return {
        suggestedType: 'savings_goal',
        confidence: 0.72,
        needsConfirmation: true,
        reasons
      };
    }
  }

  // 4. Income Detection
  // e.g. "received 5000 from internship", "got 1000 cashback", "salary credited 45000"
  const isIncomeVerb = /\b(?:received|receive|got|credited|salary|cashback|earned|income|kamaya)\b/i.test(lower);
  if (isIncomeVerb && hasAmount) {
    reasons.push('Contains income / credit keywords and received amount');
    return {
      suggestedType: 'income',
      confidence: 0.95,
      needsConfirmation: false,
      reasons
    };
  }

  // 5. Expense Detection
  // Keywords: spent, spend, bought, paid, cost, expense, ₹, $, rs, rupees
  const hasCurrencySign = /(?:₹|\$|\brs\.?|\brupees?\b)/i.test(lower);
  const hasSpendVerb = /\b(?:spent|spend|bought|paid|cost|expense|bill|kharcha)\b/i.test(lower);

  if ((hasSpendVerb || hasCurrencySign) && hasAmount) {
    // Check if ambiguous (e.g. "paid 500" alone without context/category)
    const cleanedText = lower
      .replace(/(?:spent|spend|bought|paid|cost|expense|bill|kharcha|\$|₹|\brs\.?|\brupees?)/gi, '')
      .replace(/\b\d+(?:\.\d{1,2})?\b/g, '')
      .trim();
    const isAmbiguous = cleanedText.length === 0;

    reasons.push(isAmbiguous
      ? 'Ambiguous expense: missing description or item details'
      : 'Contains spending keywords and currency/amount indicator'
    );
    return {
      suggestedType: 'expense',
      confidence: isAmbiguous ? 0.75 : (hasCurrencySign && hasSpendVerb ? 0.98 : 0.92),
      needsConfirmation: isAmbiguous,
      reasons
    };
  }

  // 6. Reminder Detection
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

  // 7. Routine Detection
  // e.g. "add my evening routine", "morning routine: stretch, plan"
  const hasRoutineVerb = /\b(?:morning\s+routine|evening\s+routine|study\s+prep\s+routine|workout\s+routine|add\s+routine|my\s+routine)\b/i.test(lower);
  if (hasRoutineVerb) {
    reasons.push('Specific personal routine keyword detected');
    return {
      suggestedType: 'routine',
      confidence: 0.93,
      needsConfirmation: false,
      reasons
    };
  }

  // 8. Habit Detection
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

  // 9. Calendar Event Detection
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

  // 10. Note / Knowledge Detection
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

  // 11. Task Detection
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

  // 12. Fallback to Brain Dump
  reasons.push('Ambiguous phrasing without distinct action verbs or entity markers; safely routing to Brain Dump');
  return {
    suggestedType: 'brain_dump',
    confidence: 0.50,
    needsConfirmation: true,
    reasons
  };
}

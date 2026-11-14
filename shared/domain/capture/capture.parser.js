/**
 * shared/domain/capture/capture.parser.js
 * Entity-Specific Field Extractor for Universal Quick Capture in Planrova 2.0
 */

import { toMinorUnits } from '../finance/finance.utils.js';

/**
 * Parses raw text into structured entity fields based on candidate type.
 */
export function parseCapture(text = '', targetType = 'task', referenceDate = new Date()) {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  
  switch (targetType) {
    case 'expense':
      return parseExpenseFields(raw, lower, referenceDate);
    case 'income':
      return parseIncomeFields(raw, lower, referenceDate);
    case 'budget':
      return parseBudgetFields(raw, lower, referenceDate);
    case 'savings_goal':
      return parseSavingsGoalFields(raw, lower, referenceDate);
    case 'hydration':
      return parseHydrationFields(raw, lower, referenceDate);
    case 'routine':
      return parseRoutineFields(raw, lower, referenceDate);
    case 'reminder':
      return parseReminderFields(raw, lower, referenceDate);
    case 'habit':
      return parseHabitFields(raw, lower, referenceDate);
    case 'calendar_event':
      return parseCalendarEventFields(raw, lower, referenceDate);
    case 'note':
      return parseNoteFields(raw, lower, referenceDate);
    case 'task':
      return parseTaskFields(raw, lower, referenceDate);
    case 'brain_dump':
    default:
      return {
        text: raw,
        date: referenceDate.toISOString()
      };
  }
}

// ── 1. EXPENSE PARSER ─────────────────────────────────────────────
function parseExpenseFields(raw, lower, now) {
  let amount = 0;
  let currency = 'INR';

  if (raw.includes('$')) currency = 'USD';
  else if (raw.includes('€')) currency = 'EUR';

  const amtMatch = raw.match(/(?:₹|\$|€|rs\.?|rupees?)?\s*(\d+(?:\.\d{1,2})?)\s*(?:₹|\$|€|rs\.?|rupees?)?/i);
  if (amtMatch) {
    amount = parseFloat(amtMatch[1]);
  }

  let desc = raw
    .replace(/(?:spent|spend|bought|paid|cost|expense|kharcha|for|on|\$|₹|€|\brs\.?|\brupees?)/gi, '')
    .replace(/\b\d+(?:\.\d{1,2})?\b/g, '')
    .trim();

  if (!desc) desc = 'Quick Expense';

  let category = 'Other';
  if (/food|lunch|dinner|breakfast|snack|chai|coffee|pizza|burger|swiggy|zomato|cafe/i.test(lower)) {
    category = 'Food';
  } else if (/cab|uber|ola|auto|metro|bus|petrol|fuel|ticket|train|flight/i.test(lower)) {
    category = 'Transport';
  } else if (/book|course|udemy|exam|tuition|pen|notebook|stationery/i.test(lower)) {
    category = 'Study';
  } else if (/movie|cinema|netflix|game|concert|outing/i.test(lower)) {
    category = 'Entertainment';
  } else if (/bill|recharge|wifi|electricity|rent|water/i.test(lower)) {
    category = 'Bills';
  } else if (/medicine|doctor|pharmacy|hospital/i.test(lower)) {
    category = 'Health';
  } else if (/clothes|shoes|amazon|flipkart|shopping/i.test(lower)) {
    category = 'Shopping';
  }

  const { date } = extractDate(raw, now);

  return {
    amountMinor: toMinorUnits(amount),
    amount,
    currency,
    category,
    description: desc,
    date
  };
}

// ── 2. INCOME PARSER ──────────────────────────────────────────────
function parseIncomeFields(raw, lower, now) {
  let amount = 0;
  let currency = 'INR';

  if (raw.includes('$')) currency = 'USD';
  else if (raw.includes('€')) currency = 'EUR';

  const amtMatch = raw.match(/(?:₹|\$|€|rs\.?|rupees?)?\s*(\d+(?:\.\d{1,2})?)\s*(?:₹|\$|€|rs\.?|rupees?)?/i);
  if (amtMatch) {
    amount = parseFloat(amtMatch[1]);
  }

  let desc = raw
    .replace(/(?:received|receive|got|credited|salary|cashback|earned|income|kamaya|from|\$|₹|€|\brs\.?|\brupees?)/gi, '')
    .replace(/\b\d+(?:\.\d{1,2})?\b/g, '')
    .trim();

  if (!desc) desc = 'Income';

  const { date } = extractDate(raw, now);

  return {
    type: 'income',
    amountMinor: toMinorUnits(amount),
    amount,
    currency,
    title: desc,
    description: desc,
    date
  };
}

// ── 3. BUDGET PARSER ──────────────────────────────────────────────
function parseBudgetFields(raw, lower, now) {
  let limit = 0;
  let currency = 'INR';

  if (raw.includes('$')) currency = 'USD';
  else if (raw.includes('€')) currency = 'EUR';

  const amtMatch = raw.match(/(?:₹|\$|€|rs\.?|rupees?)?\s*(\d+(?:\.\d{1,2})?)\s*(?:₹|\$|€|rs\.?|rupees?)?/i);
  if (amtMatch) {
    limit = parseFloat(amtMatch[1]);
  }

  const period = /weekly|week/i.test(lower) ? 'weekly' : 'monthly';

  let category = 'Other';
  if (/food|groceries|dining/i.test(lower)) category = 'Food';
  else if (/transport|travel|fuel/i.test(lower)) category = 'Transport';
  else if (/entertainment|movies|games/i.test(lower)) category = 'Entertainment';
  else if (/shopping|clothes/i.test(lower)) category = 'Shopping';
  else if (/study|books|education/i.test(lower)) category = 'Education';

  return {
    limitMinor: toMinorUnits(limit),
    limit,
    currency,
    period,
    category,
    name: `${category} Budget`
  };
}

// ── 4. SAVINGS GOAL PARSER ────────────────────────────────────────
function parseSavingsGoalFields(raw, lower, now) {
  let targetAmount = 0;
  let currency = 'INR';

  if (raw.includes('$')) currency = 'USD';
  else if (raw.includes('€')) currency = 'EUR';

  const amtMatch = raw.match(/(?:₹|\$|€|rs\.?|rupees?)?\s*(\d+(?:\.\d{1,2})?)\s*(?:₹|\$|€|rs\.?|rupees?)?/i);
  if (amtMatch) {
    targetAmount = parseFloat(amtMatch[1]);
  }

  let title = raw
    .replace(/(?:save|savings|bachat|goal|for|every\s+month|monthly|every\s+week|weekly|\$|₹|€|\brs\.?|\brupees?)/gi, '')
    .replace(/\b\d+(?:\.\d{1,2})?\b/g, '')
    .trim();

  if (!title) title = 'Savings Goal';

  const contributionFrequency = /weekly|week/i.test(lower) ? 'weekly' : 'monthly';

  return {
    targetAmountMinor: toMinorUnits(targetAmount),
    targetAmount,
    currency,
    title,
    contributionFrequency
  };
}

// ── 5. HYDRATION PARSER ───────────────────────────────────────────
function parseHydrationFields(raw, lower, now) {
  let amountMl = 250; // default glass

  const match = lower.match(/(\d+)\s*(?:ml|milliliters?|liters?|l)\b/);
  if (match) {
    const val = parseFloat(match[1]);
    if (/liters?|l\b/.test(match[0]) && !/ml|milliliters?/.test(match[0])) {
      amountMl = Math.round(val * 1000);
    } else {
      amountMl = Math.round(val);
    }
  }

  let beverageType = 'water';
  if (/coffee/i.test(lower)) beverageType = 'coffee';
  else if (/tea|chai/i.test(lower)) beverageType = 'tea';
  else if (/juice/i.test(lower)) beverageType = 'juice';

  const { date } = extractDate(raw, now);

  return {
    amountMl,
    beverageType,
    dateKey: date,
    date
  };
}

// ── 6. ROUTINE PARSER ─────────────────────────────────────────────
function parseRoutineFields(raw, lower, now) {
  let type = 'custom';
  if (/morning/i.test(lower)) type = 'morning';
  else if (/evening|night|wind\s*down/i.test(lower)) type = 'evening';
  else if (/study/i.test(lower)) type = 'study_prep';
  else if (/workout|exercise/i.test(lower)) type = 'workout';

  let title = raw
    .replace(/^(?:add\s+my\s+|create\s+|new\s+)?/i, '')
    .trim();

  if (!title) title = `${type.charAt(0).toUpperCase() + type.slice(1)} Routine`;

  return {
    title,
    type,
    estimatedDurationMinutes: 20
  };
}

// ── 7. REMINDER PARSER ────────────────────────────────────────────
function parseReminderFields(raw, lower, now) {
  const { date, textWithoutDate } = extractDate(raw, now);
  const { time, textWithoutTime } = extractTime(textWithoutDate);

  let title = textWithoutTime
    .replace(/^(?:remind\s+(?:me\s+)?(?:to\s+)?|remember\s+to\s+|alert\s+me\s+to\s+|yaad\s+dilana)/i, '')
    .replace(/\b(?:tomorrow|today|tonight|kal|parso|at|on)\b/gi, '')
    .trim();

  if (!title) title = 'Reminder';

  return {
    title,
    dueDate: date,
    dueTime: time,
    priority: 'medium'
  };
}

// ── 8. HABIT PARSER ───────────────────────────────────────────────
function parseHabitFields(raw, lower, now) {
  let name = raw
    .replace(/^(?:start\s+|build\s+habit\s+to\s+|build\s+|make\s+a\s+habit\s+of\s+)/i, '')
    .replace(/\b(?:every\s+(?:day|morning|evening|night|week)|daily|roz|har\s+din)\b/gi, '')
    .trim();

  if (!name) name = 'Daily Habit';

  let frequencyType = 'daily';
  if (/every\s+week|weekly/i.test(lower)) {
    frequencyType = 'weekly';
  } else if (/weekdays|somvaar\s+se\s+shukravaar/i.test(lower)) {
    frequencyType = 'weekdays';
  }

  return {
    name,
    frequency: {
      type: frequencyType,
      days: []
    }
  };
}

// ── 9. CALENDAR EVENT PARSER ──────────────────────────────────────
function parseCalendarEventFields(raw, lower, now) {
  const { date, textWithoutDate } = extractDate(raw, now);
  const { startTime, endTime, textWithoutTime } = extractTimeRange(textWithoutDate);

  let title = textWithoutTime
    .replace(/\b(?:tomorrow|today|tonight|kal|parso|at|from|to)\b/gi, '')
    .trim();

  if (!title) title = 'Scheduled Event';

  return {
    title,
    date,
    startTime: startTime || '09:00',
    endTime: endTime || '10:00',
    location: ''
  };
}

// ── 10. NOTE PARSER ───────────────────────────────────────────────
function parseNoteFields(raw, lower, now) {
  let content = raw
    .replace(/^(?:note:|remember\s+that|summary:|definition:|formula:|key\s+point:)/i, '')
    .trim();

  const lines = content.split('\n');
  const title = lines[0].slice(0, 50) || 'Quick Note';

  return {
    title,
    content,
    tags: []
  };
}

// ── 11. TASK PARSER ───────────────────────────────────────────────
function parseTaskFields(raw, lower, now) {
  const { date, textWithoutDate } = extractDate(raw, now);
  const { time, textWithoutTime } = extractTime(textWithoutDate);

  let priority = 'medium';
  if (/\b(?:urgent|important|priority|asap|zaroori)\b/i.test(lower)) {
    priority = 'urgent';
  } else if (/\b(?:low|chill|whenever|fursat)\b/i.test(lower)) {
    priority = 'low';
  }

  let title = textWithoutTime
    .replace(/\b(?:urgent|important|priority|asap|zaroori|low|chill|whenever)\b/gi, '')
    .replace(/\b(?:tomorrow|today|tonight|kal|parso|by|before|at)\b/gi, '')
    .trim();

  if (!title) title = raw;

  return {
    title,
    dueDate: date,
    startTime: time,
    priority,
    estimatedMinutes: 30
  };
}

// ── DATE & TIME EXTRACTION HELPERS ────────────────────────────────
export function extractDate(text, now = new Date()) {
  const lower = text.toLowerCase();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  let targetDate = new Date(year, month, day);
  let matchedStr = '';

  if (/\b(?:today|aaj)\b/i.test(lower)) {
    matchedStr = lower.match(/\b(?:today|aaj)\b/i)[0];
  } else if (/\b(?:tomorrow|kal)\b/i.test(lower)) {
    targetDate.setDate(targetDate.getDate() + 1);
    matchedStr = lower.match(/\b(?:tomorrow|kal)\b/i)[0];
  } else if (/\b(?:parso|day\s+after\s+tomorrow)\b/i.test(lower)) {
    targetDate.setDate(targetDate.getDate() + 2);
    matchedStr = lower.match(/\b(?:parso|day\s+after\s+tomorrow)\b/i)[0];
  } else {
    // Check specific days of week: "on monday", "this friday"
    const daysMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const dayMatch = lower.match(/\b(?:on\s+|this\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (dayMatch) {
      const targetDay = daysMap[dayMatch[1].toLowerCase()];
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      targetDate.setDate(targetDate.getDate() + diff);
      matchedStr = dayMatch[0];
    }
  }

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  return {
    date: dateStr,
    textWithoutDate: matchedStr ? text.replace(new RegExp(matchedStr, 'i'), '').trim() : text
  };
}

export function extractTime(text) {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?\b/i);
  if (!match) {
    return { time: '', textWithoutTime: text };
  }

  let h = parseInt(match[1]);
  let m = match[2] ? parseInt(match[2]) : 0;
  const meridian = match[3] ? match[3].toLowerCase() : '';

  if (meridian === 'pm' && h < 12) h += 12;
  if (meridian === 'am' && h === 12) h = 0;
  if (meridian === 'baje' && h >= 1 && h <= 7) h += 12;

  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return {
    time: timeStr,
    textWithoutTime: text.replace(match[0], '').trim()
  };
}

export function extractTimeRange(text) {
  const rangeMatch = text.match(/(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1]);
    let startM = rangeMatch[2] ? parseInt(rangeMatch[2]) : 0;
    const startMeridian = rangeMatch[3] ? rangeMatch[3].toLowerCase() : '';

    let endH = parseInt(rangeMatch[4]);
    let endM = rangeMatch[5] ? parseInt(rangeMatch[5]) : 0;
    const endMeridian = rangeMatch[6] ? rangeMatch[6].toLowerCase() : '';

    if (endMeridian === 'pm' && endH < 12) endH += 12;
    if (startMeridian === 'pm' && startH < 12) startH += 12;
    if (!startMeridian && endMeridian === 'pm' && startH < endH && startH < 12) startH += 12;

    const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    return {
      startTime,
      endTime,
      textWithoutTime: text.replace(rangeMatch[0], '').trim()
    };
  }

  const single = extractTime(text);
  return {
    startTime: single.time,
    endTime: '',
    textWithoutTime: single.textWithoutTime
  };
}

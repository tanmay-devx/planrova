/**
 * shared/domain/capture/capture.parser.js
 * Entity-Specific Field Extractor for Universal Quick Capture in Planrova 2.0
 */

import { toMinorUnits } from '../entities/expense.schema.js';

/**
 * Parses raw text into structured entity fields based on candidate type.
 */
export function parseCapture(text = '', targetType = 'task', referenceDate = new Date()) {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  
  switch (targetType) {
    case 'expense':
      return parseExpenseFields(raw, lower, referenceDate);
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
  // Extract amount: e.g. "spent 150 on lunch", "₹250 for groceries", "bought book for 499 rs"
  let amount = 0;
  let currency = 'INR';

  if (raw.includes('$')) currency = 'USD';
  else if (raw.includes('€')) currency = 'EUR';

  // Amount match
  const amtMatch = raw.match(/(?:₹|\$|€|rs\.?|rupees?)?\s*(\d+(?:\.\d{1,2})?)\s*(?:₹|\$|€|rs\.?|rupees?)?/i);
  if (amtMatch) {
    amount = parseFloat(amtMatch[1]);
  }

  // Clean description
  let desc = raw
    .replace(/(?:spent|spend|bought|paid|cost|expense|kharcha|for|on|\$|₹|€|\brs\.?|\brupees?)/gi, '')
    .replace(/\b\d+(?:\.\d{1,2})?\b/g, '')
    .trim();

  if (!desc) desc = 'Quick Expense';

  // Infer Category
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

// ── 2. REMINDER PARSER ────────────────────────────────────────────
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
    priority: /urgent|important|asap/i.test(lower) ? 'high' : 'medium'
  };
}

// ── 3. HABIT PARSER ───────────────────────────────────────────────
function parseHabitFields(raw, lower, now) {
  let name = raw
    .replace(/^(?:build\s+(?:a\s+)?habit|start\s+(?:a\s+)?habit|start|track)\s+/i, '')
    .replace(/\b(?:every\s+(?:day|morning|evening|night)|daily|roz|har\s+din)\b/gi, '')
    .trim();

  if (!name) name = 'Daily Habit';

  let icon = 'sparkles';
  if (/read|book|pages/i.test(lower)) icon = 'book';
  else if (/water|drink|hydrate/i.test(lower)) icon = 'water';
  else if (/workout|exercise|gym|run|walk|yoga/i.test(lower)) icon = 'fitness';
  else if (/meditat|mindful|breathe/i.test(lower)) icon = 'leaf';
  else if (/code|program|dev/i.test(lower)) icon = 'code';

  return {
    name,
    icon,
    frequency: { type: 'daily', days: [] }
  };
}

// ── 4. CALENDAR EVENT PARSER ──────────────────────────────────────
function parseCalendarEventFields(raw, lower, now) {
  const { date, textWithoutDate } = extractDate(raw, now);
  const { startTime, endTime, textWithoutTime } = extractTimeRange(textWithoutDate);

  let title = textWithoutTime
    .replace(/\b(?:tomorrow|today|tonight|kal|parso|from|to|at|on)\b/gi, '')
    .trim();

  if (!title) title = 'Calendar Event';

  let category = 'academic';
  if (/meeting|sync|interview|client|standup/i.test(lower)) category = 'work';
  else if (/party|dinner|birthday|movie/i.test(lower)) category = 'personal';

  return {
    title,
    date,
    startTime: startTime || '10:00',
    endTime: endTime || '11:00',
    allDay: !startTime && !endTime,
    category
  };
}

// ── 5. NOTE PARSER ────────────────────────────────────────────────
function parseNoteFields(raw, lower, now) {
  let text = raw
    .replace(/^(?:note:|remember\s+that|summary:|definition:|key\s+point:)\s*/i, '')
    .trim();

  // Extract a concise title from the first 5-8 words
  const words = text.split(/\s+/).filter(Boolean);
  const title = words.slice(0, 6).join(' ') || 'Quick Note';

  let subject = 'General';
  const tagMatch = raw.match(/\[([^\]]+)\]/);
  if (tagMatch) {
    subject = tagMatch[1].trim();
  } else if (/physics/i.test(lower)) subject = 'Physics';
  else if (/math/i.test(lower)) subject = 'Maths';
  else if (/cs|code|dbms|os|algorithm/i.test(lower)) subject = 'CS101';

  return {
    title,
    content: text,
    text,
    subject,
    date: now.toISOString().split('T')[0]
  };
}

// ── 6. TASK PARSER ────────────────────────────────────────────────
function parseTaskFields(raw, lower, now) {
  const { date, textWithoutDate } = extractDate(raw, now);
  const { startTime, endTime, textWithoutTime } = extractTimeRange(textWithoutDate);

  let title = textWithoutTime
    .replace(/\b(?:tomorrow|today|tonight|kal|parso|at|by|before)\b/gi, '')
    .trim();

  if (!title) title = 'Quick Task';

  // Infer Priority
  let priority = 'medium';
  if (/urgent|asap|high\s+priority|critical/i.test(lower)) priority = 'urgent';
  else if (/important|soon/i.test(lower)) priority = 'high';
  else if (/low\s+priority|someday|optional/i.test(lower)) priority = 'low';

  // Infer Category
  let category = 'study';
  if (/work|office|client|meeting|email|pr\b|deploy/i.test(lower)) category = 'work';
  else if (/health|run|gym|walk|medicine|water/i.test(lower)) category = 'health';
  else if (/finance|budget|bank|pay|bill/i.test(lower)) category = 'finance';
  else if (/buy|shop|grocery|call|home|room/i.test(lower)) category = 'personal';

  return {
    title,
    dueDate: date,
    startTime: startTime || '',
    endTime: endTime || '',
    priority,
    category
  };
}

// ── HELPERS: DATE & TIME EXTRACTION ──────────────────────────────
export function extractDate(text, now = new Date()) {
  const lower = text.toLowerCase();
  const date = new Date(now);
  let textWithoutDate = text;

  // Tomorrow / Kal
  if (/\b(?:tomorrow|kal)\b/i.test(lower)) {
    date.setDate(now.getDate() + 1);
    textWithoutDate = textWithoutDate.replace(/\b(?:tomorrow|kal)\b/gi, '');
  }
  // Day after tomorrow / Parso
  else if (/\b(?:day\s+after\s+tomorrow|parso)\b/i.test(lower)) {
    date.setDate(now.getDate() + 2);
    textWithoutDate = textWithoutDate.replace(/\b(?:day\s+after\s+tomorrow|parso)\b/gi, '');
  }
  // Next week
  else if (/\bnext\s+week\b/i.test(lower)) {
    date.setDate(now.getDate() + 7);
    textWithoutDate = textWithoutDate.replace(/\bnext\s+week\b/gi, '');
  }
  // Days of week (mon..sun, somvar..ravivar)
  else {
    const daysMap = {
      monday: 1, mon: 1, somvar: 1,
      tuesday: 2, tue: 2, mangalvar: 2,
      wednesday: 3, wed: 3, budhvar: 3,
      thursday: 4, thu: 4, veerwar: 4, guruvar: 4,
      friday: 5, fri: 5, shukravar: 5,
      saturday: 6, sat: 6, shanivar: 6,
      sunday: 0, sun: 0, ravivar: 0
    };
    for (const [dayName, dayIndex] of Object.entries(daysMap)) {
      const regex = new RegExp(`\\b${dayName}\\b`, 'i');
      if (regex.test(lower)) {
        const currentDayIndex = now.getDay();
        let diff = dayIndex - currentDayIndex;
        if (diff <= 0) diff += 7;
        date.setDate(now.getDate() + diff);
        textWithoutDate = textWithoutDate.replace(regex, '');
        break;
      }
    }
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return {
    date: `${y}-${m}-${d}`,
    textWithoutDate: textWithoutDate.trim()
  };
}

export function extractTime(text) {
  const match = text.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?\b/i);
  if (!match) return { time: '', textWithoutTime: text };

  let h = parseInt(match[1]);
  let m = match[2] ? parseInt(match[2]) : 0;
  const meridian = match[3] ? match[3].toLowerCase() : '';

  if (meridian === 'pm' && h < 12) h += 12;
  if (meridian === 'am' && h === 12) h = 0;
  // If baje and reasonable afternoon hour (1..7), assume PM
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

  // Single time fallback
  const single = extractTime(text);
  return {
    startTime: single.time,
    endTime: '',
    textWithoutTime: single.textWithoutTime
  };
}


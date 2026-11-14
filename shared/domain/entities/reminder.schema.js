/**
 * shared/domain/entities/reminder.schema.js
 * Canonical Reminder Schema & Validation for Planrova 2.0
 */

export function validateReminder(reminder) {
  const errors = [];
  if (!reminder || typeof reminder !== 'object') {
    return { valid: false, errors: ['Reminder must be an object'] };
  }

  if (!reminder.id || typeof reminder.id !== 'string') {
    errors.push('Reminder id is required and must be a string');
  }

  if (!reminder.title || typeof reminder.title !== 'string' || reminder.title.trim().length === 0) {
    errors.push('Reminder title is required and cannot be empty');
  }

  if (reminder.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(reminder.dueDate)) {
    errors.push('dueDate must be in YYYY-MM-DD format');
  }

  if (reminder.dueTime && !/^\d{2}:\d{2}$/.test(reminder.dueTime)) {
    errors.push('dueTime must be in HH:MM format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeReminder(raw = {}) {
  const now = Date.now();
  const id = raw.id || `rem_${now}_${Math.floor(Math.random() * 1000)}`;
  const title = (raw.title || raw.text || 'Reminder').trim();
  const dueDate = raw.dueDate || raw.date || new Date().toISOString().split('T')[0];
  const dueTime = raw.dueTime || raw.time || '';
  
  // Calculate target timestamp if date and time are provided
  let targetTimestamp = null;
  if (dueDate && dueTime) {
    const [y, m, d] = dueDate.split('-').map(Number);
    const [h, min] = dueTime.split(':').map(Number);
    targetTimestamp = new Date(y, m - 1, d, h, min, 0).getTime();
  } else if (raw.targetTimestamp) {
    targetTimestamp = raw.targetTimestamp;
  }

  return {
    ...raw,
    id,
    title,
    dueDate,
    date: dueDate,
    dueTime,
    time: dueTime,
    targetTimestamp,
    completed: Boolean(raw.completed),
    priority: raw.priority || 'medium',
    category: raw.category || 'reminder',
    createdAt: raw.createdAt || raw.created_at || now,
    updatedAt: raw.updatedAt || raw.updated_at || now,
    deleted: Boolean(raw.deleted),
    schemaVersion: 1
  };
}


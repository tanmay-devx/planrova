/**
 * shared/domain/entities/calendar-event.schema.js
 * Canonical Calendar Event Schema & Validation for Planrova 2.0
 */

export function validateCalendarEvent(event) {
  const errors = [];
  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['CalendarEvent must be an object'] };
  }

  if (!event.id || typeof event.id !== 'string') {
    errors.push('CalendarEvent id is required and must be a string');
  }

  if (!event.title || typeof event.title !== 'string' || event.title.trim().length === 0) {
    errors.push('CalendarEvent title is required and cannot be empty');
  }

  if (event.date && !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
    errors.push('date must be in YYYY-MM-DD format');
  }

  if (event.startTime && !/^\d{2}:\d{2}$/.test(event.startTime)) {
    errors.push('startTime must be in HH:MM format');
  }

  if (event.endTime && !/^\d{2}:\d{2}$/.test(event.endTime)) {
    errors.push('endTime must be in HH:MM format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeCalendarEvent(raw = {}) {
  const now = Date.now();
  const id = raw.id || `cal_${now}_${Math.floor(Math.random() * 1000)}`;
  const title = (raw.title || raw.text || 'Calendar Event').trim();
  const description = raw.description || raw.desc || '';
  const date = raw.date || raw.dueDate || new Date().toISOString().split('T')[0];
  const startTime = raw.startTime || '';
  const endTime = raw.endTime || '';
  const allDay = raw.allDay !== undefined ? Boolean(raw.allDay) : (!startTime && !endTime);
  const category = raw.category || 'academic';
  const location = raw.location || '';

  return {
    ...raw,
    id,
    title,
    description,
    date,
    startTime,
    endTime,
    allDay,
    category,
    location,
    createdAt: raw.createdAt || raw.created_at || now,
    updatedAt: raw.updatedAt || raw.updated_at || now,
    deleted: Boolean(raw.deleted),
    schemaVersion: 1
  };
}


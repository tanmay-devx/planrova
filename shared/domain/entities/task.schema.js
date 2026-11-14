/**
 * shared/domain/entities/task.schema.js
 * Canonical Task Schema & Validation for Planrova 2.0
 */

export const TASK_STATUSES = Object.freeze(['todo', 'in_progress', 'completed', 'cancelled']);
export const TASK_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'urgent']);
export const TASK_CATEGORIES = Object.freeze(['study', 'work', 'personal', 'health', 'finance', 'other']);

/**
 * Validates a canonical Task object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateTask(task) {
  const errors = [];
  if (!task || typeof task !== 'object') {
    return { valid: false, errors: ['Task must be an object'] };
  }

  if (!task.id || typeof task.id !== 'string') {
    errors.push('Task id is required and must be a string');
  }

  if (!task.title || typeof task.title !== 'string' || task.title.trim().length === 0) {
    errors.push('Task title is required and cannot be empty');
  }

  if (task.status && !TASK_STATUSES.includes(task.status)) {
    errors.push(`Invalid status "${task.status}". Valid: ${TASK_STATUSES.join(', ')}`);
  }

  if (task.priority && !TASK_PRIORITIES.includes(task.priority)) {
    errors.push(`Invalid priority "${task.priority}". Valid: ${TASK_PRIORITIES.join(', ')}`);
  }

  if (task.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
    errors.push('dueDate must be in YYYY-MM-DD format');
  }

  if (task.startTime && !/^\d{2}:\d{2}$/.test(task.startTime)) {
    errors.push('startTime must be in HH:MM format');
  }

  if (task.endTime && !/^\d{2}:\d{2}$/.test(task.endTime)) {
    errors.push('endTime must be in HH:MM format');
  }

  if (task.linkedNoteIds && !Array.isArray(task.linkedNoteIds)) {
    errors.push('linkedNoteIds must be an array of string IDs');
  }

  if (task.scheduledSessions && !Array.isArray(task.scheduledSessions)) {
    errors.push('scheduledSessions must be an array of session objects');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes any task (legacy or new) into the Canonical Task schema
 * preserving all custom and legacy fields for backwards compatibility.
 */
export function normalizeTask(raw = {}) {
  const now = Date.now();
  const id = raw.id || `t_${now}_${Math.floor(Math.random() * 1000)}`;
  const title = (raw.title || raw.text || 'Untitled Task').trim();
  const description = raw.description !== undefined ? raw.description : (raw.desc || '');
  
  // Status resolution (maps legacy completed boolean)
  let status = 'todo';
  if (raw.status && TASK_STATUSES.includes(raw.status)) {
    status = raw.status;
  } else if (raw.completed === true) {
    status = 'completed';
  }

  const priority = TASK_PRIORITIES.includes(raw.priority) ? raw.priority : 'medium';
  const category = TASK_CATEGORIES.includes(raw.category) ? raw.category : 'study';
  
  // Date resolution (maps legacy date property)
  const dueDate = raw.dueDate || raw.date || new Date().toISOString().split('T')[0];
  const startTime = raw.startTime || '';
  const endTime = raw.endTime || '';

  // Extract linked notes from linkedNoteIds or legacy linkedNotes
  const linkedNoteIds = Array.isArray(raw.linkedNoteIds) 
    ? [...new Set(raw.linkedNoteIds)]
    : (Array.isArray(raw.linkedNotes) ? [...new Set(raw.linkedNotes)] : []);

  const allowSplit = raw.allowSplit !== undefined ? Boolean(raw.allowSplit) : false;
  const scheduledSessions = Array.isArray(raw.scheduledSessions) ? [...raw.scheduledSessions] : [];

  return {
    ...raw, // preserve legacy properties
    id,
    title,
    description,
    desc: description, // preserve legacy key for UI templates
    status,
    completed: status === 'completed', // preserve legacy boolean flag
    priority,
    category,
    dueDate,
    date: dueDate, // preserve legacy key for timetable grid
    startTime,
    endTime,
    estimatedMinutes: typeof raw.estimatedMinutes === 'number' ? raw.estimatedMinutes : null,
    allowSplit,
    scheduledSessions,
    completedAt: raw.completedAt || (status === 'completed' ? (raw.updated_at || now) : null),
    linkedNoteIds,
    createdAt: raw.createdAt || raw.created_at || now,
    updatedAt: raw.updatedAt || raw.updated_at || now,
    deleted: Boolean(raw.deleted),
    schemaVersion: 1
  };
}


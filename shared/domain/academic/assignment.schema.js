/**
 * shared/domain/academic/assignment.schema.js
 * Assignment entity schema, validation, and normalization for Planrova 2.0.
 *
 * 100% platform-independent; zero external dependencies.
 */

export const ASSIGNMENT_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed'
});

export const VALID_ASSIGNMENT_STATUSES = Object.freeze(Object.values(ASSIGNMENT_STATUSES));

export const ASSIGNMENT_PRIORITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
});

export const VALID_ASSIGNMENT_PRIORITIES = Object.freeze(Object.values(ASSIGNMENT_PRIORITIES));

export function validateAssignment(assignment) {
  const errors = [];
  if (!assignment || typeof assignment !== 'object') {
    return { valid: false, errors: ['Assignment must be an object'] };
  }

  if (!assignment.id || typeof assignment.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  if (!assignment.courseId || typeof assignment.courseId !== 'string') {
    errors.push('courseId is required and must be a string');
  }

  if (!assignment.title || typeof assignment.title !== 'string' || assignment.title.trim().length === 0) {
    errors.push('title is required and must be a non-empty string');
  }

  if (assignment.status && !VALID_ASSIGNMENT_STATUSES.includes(assignment.status)) {
    errors.push(`status must be one of: ${VALID_ASSIGNMENT_STATUSES.join(', ')}`);
  }

  if (assignment.priority && !VALID_ASSIGNMENT_PRIORITIES.includes(assignment.priority)) {
    errors.push(`priority must be one of: ${VALID_ASSIGNMENT_PRIORITIES.join(', ')}`);
  }

  if (assignment.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(assignment.dueDate)) {
    errors.push('dueDate must be in YYYY-MM-DD format');
  }

  if (assignment.dueTime && !/^\d{2}:\d{2}$/.test(assignment.dueTime)) {
    errors.push('dueTime must be in HH:MM format');
  }

  if (assignment.estimatedMinutes !== undefined) {
    if (typeof assignment.estimatedMinutes !== 'number' || assignment.estimatedMinutes < 0) {
      errors.push('estimatedMinutes must be a non-negative number');
    }
  }

  if (assignment.actualMinutes !== undefined) {
    if (typeof assignment.actualMinutes !== 'number' || assignment.actualMinutes < 0) {
      errors.push('actualMinutes must be a non-negative number');
    }
  }

  if (assignment.dependencyIds && !Array.isArray(assignment.dependencyIds)) {
    errors.push('dependencyIds must be an array of string IDs');
  }

  if (assignment.linkedTaskIds && !Array.isArray(assignment.linkedTaskIds)) {
    errors.push('linkedTaskIds must be an array of string IDs');
  }

  if (assignment.topicIds && !Array.isArray(assignment.topicIds)) {
    errors.push('topicIds must be an array of string IDs');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeAssignment(raw = {}) {
  const now = Date.now();
  const id = raw.id || `asgn_${now}_${Math.floor(Math.random() * 1000)}`;
  const userId = raw.userId || 'local';
  const courseId = raw.courseId ? String(raw.courseId).trim() : '';
  const title = (raw.title || 'Untitled Assignment').trim();
  const description = raw.description ? String(raw.description).trim() : '';
  const status = VALID_ASSIGNMENT_STATUSES.includes(raw.status) ? raw.status : ASSIGNMENT_STATUSES.NOT_STARTED;
  const priority = VALID_ASSIGNMENT_PRIORITIES.includes(raw.priority) ? raw.priority : ASSIGNMENT_PRIORITIES.MEDIUM;
  
  const dueDate = raw.dueDate ? String(raw.dueDate).trim() : '';
  const dueTime = raw.dueTime ? String(raw.dueTime).trim() : null;

  const estimatedMinutes = typeof raw.estimatedMinutes === 'number' && raw.estimatedMinutes >= 0 
    ? Math.round(raw.estimatedMinutes) 
    : 60;
  
  const actualMinutes = typeof raw.actualMinutes === 'number' && raw.actualMinutes >= 0 
    ? Math.round(raw.actualMinutes) 
    : 0;

  const dependencyIds = Array.isArray(raw.dependencyIds) 
    ? Array.from(new Set(raw.dependencyIds.map(d => String(d).trim()).filter(Boolean)))
    : [];

  const linkedTaskIds = Array.isArray(raw.linkedTaskIds)
    ? Array.from(new Set(raw.linkedTaskIds.map(t => String(t).trim()).filter(Boolean)))
    : [];

  const topicIds = Array.isArray(raw.topicIds)
    ? Array.from(new Set(raw.topicIds.map(tp => String(tp).trim()).filter(Boolean)))
    : [];

  const assessmentId = raw.assessmentId ? String(raw.assessmentId).trim() : null;

  const weightPercentage = typeof raw.weightPercentage === 'number' && raw.weightPercentage >= 0 && raw.weightPercentage <= 100
    ? raw.weightPercentage
    : null;

  const completedAt = status === ASSIGNMENT_STATUSES.COMPLETED 
    ? (raw.completedAt || now) 
    : null;

  return {
    id,
    userId,
    courseId,
    title,
    description,
    status,
    priority,
    dueDate,
    dueTime,
    estimatedMinutes,
    actualMinutes,
    dependencyIds,
    linkedTaskIds,
    topicIds,
    assessmentId,
    weightPercentage,
    completedAt,
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}


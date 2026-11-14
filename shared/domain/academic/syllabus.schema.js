/**
 * shared/domain/academic/syllabus.schema.js
 * Syllabus Topic entity schema, validation, and normalization for Planrova 2.0.
 *
 * 100% platform-independent; zero external dependencies.
 */

import { TOPIC_MASTERY_LEVELS, VALID_TOPIC_MASTERY_LEVELS } from './academic.types.js';

export function validateTopic(topic) {
  const errors = [];
  if (!topic || typeof topic !== 'object') {
    return { valid: false, errors: ['Topic must be an object'] };
  }

  if (!topic.id || typeof topic.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  if (!topic.courseId || typeof topic.courseId !== 'string') {
    errors.push('courseId is required and must be a string');
  }

  if (!topic.title || typeof topic.title !== 'string' || topic.title.trim().length === 0) {
    errors.push('title is required and must be a non-empty string');
  }

  const pId = topic.parentTopicId || topic.parentId;
  if (pId && (pId === topic.id || pId === topic.title)) {
    errors.push('A topic cannot be its own parent');
  }

  if (topic.estimatedMinutes !== undefined && (typeof topic.estimatedMinutes !== 'number' || topic.estimatedMinutes < 0)) {
    errors.push('estimatedMinutes must be a non-negative number');
  }

  if (topic.masteryLevel && !VALID_TOPIC_MASTERY_LEVELS.includes(topic.masteryLevel)) {
    errors.push(`masteryLevel must be one of: ${VALID_TOPIC_MASTERY_LEVELS.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeTopic(raw = {}) {
  const now = Date.now();
  const id = raw.id || `tpc_${now}_${Math.floor(Math.random() * 1000)}`;
  const userId = raw.userId || 'local';
  const courseId = raw.courseId ? String(raw.courseId).trim() : '';
  const rawParent = raw.parentTopicId || raw.parentId;
  const parentTopicId = rawParent && String(rawParent) !== id ? String(rawParent).trim() : null;
  const parentId = parentTopicId;
  const title = (raw.title || 'Untitled Topic').trim();
  const description = raw.description ? String(raw.description).trim() : '';
  const order = typeof raw.order === 'number' ? Math.floor(raw.order) : 0;
  const estimatedMinutes = typeof raw.estimatedMinutes === 'number' && raw.estimatedMinutes >= 0 ? raw.estimatedMinutes : 45;
  const completed = Boolean(raw.completed);
  const completedAt = completed ? (raw.completedAt || now) : null;
  const masteryLevel = VALID_TOPIC_MASTERY_LEVELS.includes(raw.masteryLevel) 
    ? raw.masteryLevel 
    : (completed ? TOPIC_MASTERY_LEVELS.MASTERED : TOPIC_MASTERY_LEVELS.UNSTARTED);

  const linkedNoteIds = Array.isArray(raw.linkedNoteIds) ? [...new Set(raw.linkedNoteIds.map(String))] : [];
  const linkedTaskIds = Array.isArray(raw.linkedTaskIds) ? [...new Set(raw.linkedTaskIds.map(String))] : [];

  return {
    id,
    userId,
    courseId,
    parentTopicId,
    parentId,
    title,
    description,
    order,
    estimatedMinutes,
    completed,
    completedAt,
    masteryLevel,
    linkedNoteIds,
    linkedTaskIds,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    deleted: Boolean(raw.deleted),
    deletedAt: raw.deletedAt || null,
    schemaVersion: 1
  };
}

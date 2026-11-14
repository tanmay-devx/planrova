/**
 * shared/domain/academic/assessment.schema.js
 * Assessment entity schema, validation, and normalization for Planrova 2.0.
 *
 * 100% platform-independent; zero external dependencies.
 */

import { 
  ASSESSMENT_TYPES, 
  VALID_ASSESSMENT_TYPES, 
  ASSESSMENT_STATUSES, 
  VALID_ASSESSMENT_STATUSES 
} from './academic.types.js';

export function validateAssessment(assessment) {
  const errors = [];
  if (!assessment || typeof assessment !== 'object') {
    return { valid: false, errors: ['Assessment must be an object'] };
  }

  if (!assessment.id || typeof assessment.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  if (!assessment.courseId || typeof assessment.courseId !== 'string') {
    errors.push('courseId is required and must be a string');
  }

  if (!assessment.title || typeof assessment.title !== 'string' || assessment.title.trim().length === 0) {
    errors.push('title is required and must be a non-empty string');
  }

  if (assessment.type && !VALID_ASSESSMENT_TYPES.includes(assessment.type)) {
    errors.push(`type must be one of: ${VALID_ASSESSMENT_TYPES.join(', ')}`);
  }

  if (assessment.status && !VALID_ASSESSMENT_STATUSES.includes(assessment.status)) {
    errors.push(`status must be one of: ${VALID_ASSESSMENT_STATUSES.join(', ')}`);
  }

  if (assessment.totalMarks !== undefined) {
    if (typeof assessment.totalMarks !== 'number' || assessment.totalMarks <= 0) {
      errors.push('totalMarks must be a positive number');
    }
  }

  if (assessment.obtainedMarks !== undefined && assessment.obtainedMarks !== null) {
    if (typeof assessment.obtainedMarks !== 'number' || assessment.obtainedMarks < 0) {
      errors.push('obtainedMarks must be a non-negative number');
    } else if (assessment.totalMarks && assessment.obtainedMarks > assessment.totalMarks) {
      errors.push('obtainedMarks cannot exceed totalMarks');
    }
  }

  if (assessment.weightPercentage !== undefined) {
    if (typeof assessment.weightPercentage !== 'number' || assessment.weightPercentage < 0 || assessment.weightPercentage > 100) {
      errors.push('weightPercentage must be a number between 0 and 100');
    }
  }

  if (assessment.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(assessment.dueDate)) {
    errors.push('dueDate must be in YYYY-MM-DD format');
  }

  if (assessment.examDate && !/^\d{4}-\d{2}-\d{2}$/.test(assessment.examDate)) {
    errors.push('examDate must be in YYYY-MM-DD format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeAssessment(raw = {}) {
  const now = Date.now();
  const id = raw.id || `asm_${now}_${Math.floor(Math.random() * 1000)}`;
  const userId = raw.userId || 'local';
  const courseId = raw.courseId ? String(raw.courseId).trim() : '';
  const title = (raw.title || 'Untitled Assessment').trim();
  const type = VALID_ASSESSMENT_TYPES.includes(raw.type) ? raw.type : ASSESSMENT_TYPES.ASSIGNMENT;
  const status = VALID_ASSESSMENT_STATUSES.includes(raw.status) ? raw.status : ASSESSMENT_STATUSES.PENDING;
  const totalMarks = typeof raw.totalMarks === 'number' && raw.totalMarks > 0 ? raw.totalMarks : 100;
  
  let obtainedMarks = null;
  if (typeof raw.obtainedMarks === 'number' && !isNaN(raw.obtainedMarks)) {
    obtainedMarks = Math.min(totalMarks, Math.max(0, raw.obtainedMarks));
  }

  const weightPercentage = typeof raw.weightPercentage === 'number' && raw.weightPercentage >= 0 && raw.weightPercentage <= 100
    ? raw.weightPercentage
    : 10;

  const dueDate = raw.dueDate ? String(raw.dueDate).trim() : '';
  const examDate = raw.examDate ? String(raw.examDate).trim() : '';
  const notes = raw.notes ? String(raw.notes).trim() : '';

  return {
    id,
    userId,
    courseId,
    title,
    type,
    status,
    totalMarks,
    obtainedMarks,
    weightPercentage,
    dueDate,
    examDate,
    notes,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    deleted: Boolean(raw.deleted),
    deletedAt: raw.deletedAt || null,
    schemaVersion: 1
  };
}


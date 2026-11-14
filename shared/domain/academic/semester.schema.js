/**
 * shared/domain/academic/semester.schema.js
 * Semester entity schema, validation, and normalization for Planrova 2.0.
 *
 * 100% platform-independent; zero external dependencies.
 */

import { SEMESTER_STATUSES, VALID_SEMESTER_STATUSES, GRADING_SCALE_TYPES } from './academic.types.js';

export function validateSemester(semester) {
  const errors = [];
  if (!semester || typeof semester !== 'object') {
    return { valid: false, errors: ['Semester must be an object'] };
  }

  if (!semester.id || typeof semester.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  const semesterName = semester.name || semester.title;
  if (!semesterName || typeof semesterName !== 'string' || semesterName.trim().length === 0) {
    errors.push('name or title is required and must be a non-empty string');
  }

  if (semester.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(semester.startDate)) {
    errors.push('startDate must be in YYYY-MM-DD format');
  }

  if (semester.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(semester.endDate)) {
    errors.push('endDate must be in YYYY-MM-DD format');
  }

  if (semester.startDate && semester.endDate && semester.startDate > semester.endDate) {
    errors.push('startDate cannot be after endDate');
  }

  if (semester.status && !VALID_SEMESTER_STATUSES.includes(semester.status)) {
    errors.push(`status must be one of: ${VALID_SEMESTER_STATUSES.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeSemester(raw = {}) {
  const now = Date.now();
  const id = raw.id || `sem_${now}_${Math.floor(Math.random() * 1000)}`;
  const userId = raw.userId || 'local';
  const name = (raw.name || raw.title || 'Untitled Semester').trim();
  const title = name;
  const academicYear = raw.academicYear ? String(raw.academicYear).trim() : new Date().getFullYear().toString();
  const term = raw.term ? String(raw.term).trim() : 'Fall';
  const startDate = raw.startDate ? String(raw.startDate).trim() : '';
  const endDate = raw.endDate ? String(raw.endDate).trim() : '';
  const gradingScaleId = raw.gradingScaleId || GRADING_SCALE_TYPES.LETTER_4_0;
  const status = VALID_SEMESTER_STATUSES.includes(raw.status) ? raw.status : SEMESTER_STATUSES.UPCOMING;
  const targetSGPA = typeof raw.targetSGPA === 'number' ? raw.targetSGPA : null;
  const actualSGPA = typeof raw.actualSGPA === 'number' ? raw.actualSGPA : null;
  const isDefault = Boolean(raw.isDefault);

  return {
    id,
    userId,
    name,
    title,
    academicYear,
    term,
    startDate,
    endDate,
    gradingScaleId,
    status,
    targetSGPA,
    actualSGPA,
    isDefault,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    deleted: Boolean(raw.deleted),
    deletedAt: raw.deletedAt || null,
    schemaVersion: 1
  };
}

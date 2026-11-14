/**
 * shared/domain/academic/course.schema.js
 * Course entity schema, validation, and normalization for Planrova 2.0.
 *
 * 100% platform-independent; zero external dependencies.
 */

import { COURSE_STATUSES, VALID_COURSE_STATUSES } from './academic.types.js';

export function validateCourse(course) {
  const errors = [];
  if (!course || typeof course !== 'object') {
    return { valid: false, errors: ['Course must be an object'] };
  }

  if (!course.id || typeof course.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  const courseName = course.name || course.title;
  if (!courseName || typeof courseName !== 'string' || courseName.trim().length === 0) {
    errors.push('title is required and must be a non-empty string');
    errors.push('name is required and must be a non-empty string');
  }

  if (course.credits !== undefined && (typeof course.credits !== 'number' || course.credits < 0)) {
    errors.push('credits must be a non-negative number');
  }

  if (course.instructorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(course.instructorEmail)) {
    errors.push('instructorEmail must be a valid email address');
  }

  if (course.status && !VALID_COURSE_STATUSES.includes(course.status)) {
    errors.push(`status must be one of: ${VALID_COURSE_STATUSES.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeCourse(raw = {}) {
  const now = Date.now();
  const id = raw.id || `crs_${now}_${Math.floor(Math.random() * 1000)}`;
  const userId = raw.userId || 'local';
  const semesterId = raw.semesterId ? String(raw.semesterId).trim() : null;
  const courseCode = (raw.courseCode || raw.code || '').trim().toUpperCase();
  const name = (raw.name || raw.title || 'Untitled Course').trim();
  const title = name;
  const description = raw.description ? String(raw.description).trim() : '';
  const credits = typeof raw.credits === 'number' && raw.credits >= 0 ? raw.credits : 3;
  const gradingScaleId = raw.gradingScaleId || 'letter_4_0';
  const instructorName = raw.instructorName ? String(raw.instructorName).trim() : '';
  const instructorEmail = raw.instructorEmail ? String(raw.instructorEmail).trim() : '';
  const color = raw.color ? String(raw.color).trim() : '#C2A878';
  const status = VALID_COURSE_STATUSES.includes(raw.status) ? raw.status : COURSE_STATUSES.ACTIVE;

  return {
    id,
    userId,
    semesterId,
    courseCode,
    name,
    title,
    description,
    credits,
    gradingScaleId,
    name,
    description,
    credits,
    instructorName,
    instructorEmail,
    color,
    status,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    deleted: Boolean(raw.deleted),
    deletedAt: raw.deletedAt || null,
    schemaVersion: 1
  };
}

/**
 * shared/domain/wellbeing/wellbeing.validation.js
 * Validation logic for Planrova 2.0 Wellbeing Entities.
 */

import { BEVERAGE_TYPES, ROUTINE_TYPES, MOOD_LABELS } from './wellbeing.types.js';

export function validateHydrationLog(log) {
  const errors = [];
  if (!log || typeof log !== 'object') {
    return { valid: false, errors: ['HydrationLog must be an object'] };
  }
  if (!log.id || typeof log.id !== 'string') {
    errors.push('id is required');
  }
  if (!log.userId || typeof log.userId !== 'string') {
    errors.push('userId is required');
  }
  if (typeof log.amountMl !== 'number' || !Number.isInteger(log.amountMl) || log.amountMl <= 0) {
    errors.push('amountMl must be a positive integer');
  }
  if (!log.dateKey || !/^\d{4}-\d{2}-\d{2}/.test(log.dateKey)) {
    errors.push('dateKey must be in YYYY-MM-DD format');
  }
  if (log.beverageType && !BEVERAGE_TYPES.includes(log.beverageType)) {
    errors.push(`beverageType must be one of: ${BEVERAGE_TYPES.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateWellbeingCheckIn(checkIn) {
  const errors = [];
  if (!checkIn || typeof checkIn !== 'object') {
    return { valid: false, errors: ['WellbeingCheckIn must be an object'] };
  }
  if (!checkIn.id || typeof checkIn.id !== 'string') {
    errors.push('id is required');
  }
  if (!checkIn.userId || typeof checkIn.userId !== 'string') {
    errors.push('userId is required');
  }
  if (!checkIn.dateKey || !/^\d{4}-\d{2}-\d{2}/.test(checkIn.dateKey)) {
    errors.push('dateKey must be in YYYY-MM-DD format');
  }
  if (typeof checkIn.energyLevel !== 'number' || checkIn.energyLevel < 1 || checkIn.energyLevel > 5) {
    errors.push('energyLevel must be an integer between 1 and 5');
  }
  if (checkIn.moodLabel && !MOOD_LABELS.includes(checkIn.moodLabel)) {
    errors.push(`moodLabel must be one of: ${MOOD_LABELS.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateRoutine(routine) {
  const errors = [];
  if (!routine || typeof routine !== 'object') {
    return { valid: false, errors: ['Routine must be an object'] };
  }
  if (!routine.id || typeof routine.id !== 'string') {
    errors.push('id is required');
  }
  if (!routine.title || !routine.title.trim()) {
    errors.push('title is required');
  }
  if (routine.type && !ROUTINE_TYPES.includes(routine.type)) {
    errors.push(`type must be one of: ${ROUTINE_TYPES.join(', ')}`);
  }
  if (typeof routine.estimatedDurationMinutes !== 'number' || routine.estimatedDurationMinutes <= 0) {
    errors.push('estimatedDurationMinutes must be a positive number');
  }
  return { valid: errors.length === 0, errors };
}


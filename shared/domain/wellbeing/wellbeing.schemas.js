/**
 * shared/domain/wellbeing/wellbeing.schemas.js
 * Canonical Schemas & Normalizers for Planrova 2.0 Wellbeing Domain.
 */

import {
  BEVERAGE_TYPES,
  ROUTINE_TYPES,
  MOOD_LABELS,
  HABIT_FREQUENCY_TYPES
} from './wellbeing.types.js';
import { normalizeHabit, validateHabit, calculateHabitStreaks } from '../entities/habit.schema.js';

export { normalizeHabit, validateHabit, calculateHabitStreaks };

/**
 * Normalizes a HydrationLog entity.
 */
export function normalizeHydrationLog(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  const id = raw.id || `hyd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const dateKey = raw.dateKey || raw.date || now.slice(0, 10);
  const amountMl = typeof raw.amountMl === 'number' && Number.isInteger(raw.amountMl)
    ? Math.abs(raw.amountMl)
    : Math.abs(parseInt(raw.amount || raw.volume || 250, 10) || 250);
  
  const beverageType = BEVERAGE_TYPES.includes(raw.beverageType) ? raw.beverageType : 'water';
  const source = raw.source || 'manual';

  return {
    id,
    userId: raw.userId || userId,
    amountMl,
    amount: amountMl, // compatibility
    beverageType,
    dateKey,
    date: dateKey, // compatibility
    source,
    loggedAt: raw.loggedAt || now,
    createdAt: raw.createdAt || now
  };
}

/**
 * Normalizes a WellbeingCheckIn entity.
 * Private, lightweight, non-clinical personal reflection.
 */
export function normalizeWellbeingCheckIn(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  const id = raw.id || `chk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const dateKey = raw.dateKey || raw.date || now.slice(0, 10);

  let energyLevel = parseInt(raw.energyLevel, 10);
  if (isNaN(energyLevel) || energyLevel < 1 || energyLevel > 5) {
    energyLevel = 3;
  }

  const moodLabel = MOOD_LABELS.includes(raw.moodLabel) ? raw.moodLabel : 'neutral';

  return {
    id,
    userId: raw.userId || userId,
    dateKey,
    energyLevel,
    moodLabel,
    personalNote: (raw.personalNote || raw.notes || '').trim(),
    tags: Array.isArray(raw.tags) ? [...raw.tags] : [],
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}

/**
 * Normalizes a Routine entity (e.g. Morning Routine, Evening Wind Down).
 */
export function normalizeRoutine(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  const id = raw.id || `rtn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const type = ROUTINE_TYPES.includes(raw.type) ? raw.type : 'custom';
  
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  let calculatedDuration = 0;
  const steps = rawSteps.map((step, idx) => {
    const sDuration = Math.max(1, parseInt(step.durationMinutes || step.duration || 5, 10) || 5);
    calculatedDuration += sDuration;
    return {
      id: step.id || `step_${idx + 1}`,
      title: (step.title || `Step ${idx + 1}`).trim(),
      durationMinutes: sDuration,
      isCompleted: Boolean(step.isCompleted),
      order: typeof step.order === 'number' ? step.order : idx + 1
    };
  });

  const estimatedDurationMinutes = typeof raw.estimatedDurationMinutes === 'number' && raw.estimatedDurationMinutes > 0
    ? raw.estimatedDurationMinutes
    : (calculatedDuration > 0 ? calculatedDuration : 15);

  const daysOfWeek = Array.isArray(raw.daysOfWeek) ? [...raw.daysOfWeek] : [0, 1, 2, 3, 4, 5, 6];

  return {
    id,
    userId: raw.userId || userId,
    title: (raw.title || 'Personal Routine').trim(),
    type,
    steps,
    estimatedDurationMinutes,
    daysOfWeek,
    preferredTime: raw.preferredTime || null, // e.g. "07:30"
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}


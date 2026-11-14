/**
 * shared/domain/wellbeing/wellbeing.types.js
 * Canonical Wellbeing Types, Constants, and Storage Keys for Planrova 2.0.
 */

export const HABIT_FREQUENCY_TYPES = Object.freeze([
  'daily',
  'weekly',
  'weekdays',
  'custom'
]);

export const BEVERAGE_TYPES = Object.freeze([
  'water',
  'coffee',
  'tea',
  'juice',
  'other'
]);

export const ROUTINE_TYPES = Object.freeze([
  'morning',
  'evening',
  'study_prep',
  'workout',
  'wind_down',
  'custom'
]);

export const MOOD_LABELS = Object.freeze([
  'great',
  'good',
  'neutral',
  'tired',
  'stressed'
]);

export const WELLBEING_STORAGE_KEYS = Object.freeze({
  HABITS: 'user_habits',
  HABIT_LOGS: 'habit_logs',
  HYDRATION_LOGS: 'hydration_logs',
  HYDRATION_SETTINGS: 'hydration_settings',
  CHECK_INS: 'wellbeing_check_ins',
  ROUTINES: 'wellbeing_routines'
});


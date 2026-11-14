/**
 * shared/domain/capture/capture.schema.js
 * Universal Quick Capture Schemas & Constants for Planrova 2.0
 */

export const CAPTURE_TYPES = Object.freeze([
  'task',
  'reminder',
  'note',
  'expense',
  'habit',
  'calendar_event',
  'brain_dump'
]);

export const CAPTURE_TYPE_LABELS = Object.freeze({
  task: 'Task',
  reminder: 'Reminder',
  note: 'Note',
  expense: 'Expense',
  habit: 'Habit',
  calendar_event: 'Calendar Event',
  brain_dump: 'Brain Dump'
});

export const CAPTURE_TYPE_ICONS = Object.freeze({
  task: '✓',
  reminder: '⏰',
  note: '📝',
  expense: '💸',
  habit: '🔥',
  calendar_event: '📅',
  brain_dump: '💡'
});

export const CONFIDENCE_THRESHOLD = 0.65;


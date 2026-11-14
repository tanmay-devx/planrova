/**
 * shared/domain/capture/capture.schema.js
 * Universal Quick Capture Schemas & Constants for Planrova 2.0
 */

export const CAPTURE_TYPES = Object.freeze([
  'task',
  'reminder',
  'note',
  'expense',
  'income',
  'budget',
  'savings_goal',
  'habit',
  'hydration',
  'routine',
  'calendar_event',
  'brain_dump'
]);

export const CAPTURE_TYPE_LABELS = Object.freeze({
  task: 'Task',
  reminder: 'Reminder',
  note: 'Note',
  expense: 'Expense',
  income: 'Income',
  budget: 'Budget',
  savings_goal: 'Savings Goal',
  habit: 'Habit',
  hydration: 'Hydration',
  routine: 'Routine',
  calendar_event: 'Calendar Event',
  brain_dump: 'Brain Dump'
});

export const CAPTURE_TYPE_ICONS = Object.freeze({
  task: '✓',
  reminder: '⏰',
  note: '📝',
  expense: '💸',
  income: '💵',
  budget: '📊',
  savings_goal: '🎯',
  habit: '🔥',
  hydration: '💧',
  routine: '🔄',
  calendar_event: '📅',
  brain_dump: '💡'
});

export const CONFIDENCE_THRESHOLD = 0.65;

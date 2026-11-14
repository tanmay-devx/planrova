/**
 * src/modules/wellbeing/wellbeing-storage.js
 * Scoped Local-First Storage Adapter for Planrova 2.0 Wellbeing Domain.
 */

import { getStorageItem, setStorageItem } from '../../utils/storage.js';
import { WELLBEING_STORAGE_KEYS } from '../../../shared/domain/wellbeing/wellbeing.types.js';
import {
  normalizeHydrationLog,
  normalizeWellbeingCheckIn,
  normalizeRoutine
} from '../../../shared/domain/wellbeing/wellbeing.schemas.js';
import { migrateHabitsToCanonical } from '../../../shared/domain/migrations/habit.migration.js';

// ── HABITS ────────────────────────────────────────────────────────
export function getStoredHabits() {
  const rawHabits = getStorageItem(WELLBEING_STORAGE_KEYS.HABITS, []);
  const rawLogs = getStorageItem(WELLBEING_STORAGE_KEYS.HABIT_LOGS, {});
  return migrateHabitsToCanonical(rawHabits, rawLogs);
}

export function saveStoredHabit(habit) {
  const habits = getStoredHabits();
  const idx = habits.findIndex(h => h.id === habit.id);
  if (idx >= 0) {
    habits[idx] = habit;
  } else {
    habits.push(habit);
  }
  setStorageItem(WELLBEING_STORAGE_KEYS.HABITS, habits);
  return habit;
}

// ── HYDRATION ─────────────────────────────────────────────────────
export function getStoredHydrationLogs() {
  const raw = getStorageItem(WELLBEING_STORAGE_KEYS.HYDRATION_LOGS, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(l => normalizeHydrationLog(l));
}

export function saveStoredHydrationLog(log) {
  const logs = getStoredHydrationLogs();
  const normalized = normalizeHydrationLog(log);
  logs.unshift(normalized);
  setStorageItem(WELLBEING_STORAGE_KEYS.HYDRATION_LOGS, logs);
  return normalized;
}

export function getStoredHydrationSettings() {
  return getStorageItem(WELLBEING_STORAGE_KEYS.HYDRATION_SETTINGS, {
    goal: 2000,
    interval: 60,
    quietHours: true
  });
}

export function saveStoredHydrationSettings(settings) {
  setStorageItem(WELLBEING_STORAGE_KEYS.HYDRATION_SETTINGS, settings);
  return settings;
}

// ── CHECK-INS ─────────────────────────────────────────────────────
export function getStoredCheckIns() {
  const raw = getStorageItem(WELLBEING_STORAGE_KEYS.CHECK_INS, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(c => normalizeWellbeingCheckIn(c));
}

export function saveStoredCheckIn(checkIn) {
  const checkIns = getStoredCheckIns();
  const normalized = normalizeWellbeingCheckIn(checkIn);
  const idx = checkIns.findIndex(c => c.dateKey === normalized.dateKey);
  if (idx >= 0) {
    checkIns[idx] = normalized;
  } else {
    checkIns.unshift(normalized);
  }
  setStorageItem(WELLBEING_STORAGE_KEYS.CHECK_INS, checkIns);
  return normalized;
}

// ── ROUTINES ──────────────────────────────────────────────────────
export function getStoredRoutines() {
  const raw = getStorageItem(WELLBEING_STORAGE_KEYS.ROUTINES, []);
  if (!Array.isArray(raw) || raw.length === 0) {
    // Provide default morning and evening routines if none exist
    const defaultMorning = normalizeRoutine({
      id: 'rtn_morning_default',
      title: 'Morning Momentum',
      type: 'morning',
      preferredTime: '07:30',
      steps: [
        { id: 's1', title: 'Hydrate (500ml water)', durationMinutes: 5, isCompleted: false },
        { id: 's2', title: 'Light stretching or movement', durationMinutes: 10, isCompleted: false },
        { id: 's3', title: 'Review today’s adaptive plan', durationMinutes: 10, isCompleted: false }
      ]
    });
    const defaultEvening = normalizeRoutine({
      id: 'rtn_evening_default',
      title: 'Evening Wind Down',
      type: 'evening',
      preferredTime: '21:30',
      steps: [
        { id: 's4', title: 'Clear workspace and capture loose thoughts', durationMinutes: 10, isCompleted: false },
        { id: 's5', title: 'Quick wellbeing check-in', durationMinutes: 5, isCompleted: false },
        { id: 's6', title: 'Read or relax without screens', durationMinutes: 15, isCompleted: false }
      ]
    });
    const defaults = [defaultMorning, defaultEvening];
    setStorageItem(WELLBEING_STORAGE_KEYS.ROUTINES, defaults);
    return defaults;
  }
  return raw.map(r => normalizeRoutine(r));
}

export function saveStoredRoutine(routine) {
  const routines = getStoredRoutines();
  const normalized = normalizeRoutine(routine);
  const idx = routines.findIndex(r => r.id === normalized.id);
  if (idx >= 0) {
    routines[idx] = normalized;
  } else {
    routines.push(normalized);
  }
  setStorageItem(WELLBEING_STORAGE_KEYS.ROUTINES, routines);
  return normalized;
}


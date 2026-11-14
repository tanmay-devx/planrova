/**
 * shared/domain/migrations/habit.migration.js
 * Idempotent Migration Adapter for Canonical Habit Unification in Planrova 2.0
 */

import { normalizeHabit } from '../entities/habit.schema.js';

/**
 * Migrates a collection of habits from legacy representations
 * (habit.streak, habit.fire, habit.logs, habit_logs map) to canonical habits.
 * 
 * Idempotent: Can be run multiple times safely without corrupting streaks or dates.
 */
export function migrateHabitsToCanonical(habits = [], legacyLogsMap = {}) {
  if (!Array.isArray(habits)) {
    return [];
  }

  return habits.map(habit => {
    if (!habit || typeof habit !== 'object') return habit;
    return normalizeHabit(habit, legacyLogsMap);
  });
}


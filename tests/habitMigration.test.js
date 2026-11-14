import { describe, it, expect } from 'vitest';
import { calculateHabitStreaks, normalizeHabit } from '../shared/domain/entities/habit.schema.js';
import { migrateHabitsToCanonical } from '../shared/domain/migrations/habit.migration.js';

describe('Habit Deterministic Streaks & Canonical Migration', () => {
  const refDate = new Date(2026, 10, 14); // 2026-11-14

  describe('calculateHabitStreaks', () => {
    it('calculates current streak when completed today', () => {
      const dates = ['2026-11-12', '2026-11-13', '2026-11-14'];
      const { currentStreak, longestStreak } = calculateHabitStreaks(dates, refDate);
      expect(currentStreak).toBe(3);
      expect(longestStreak).toBe(3);
    });

    it('preserves active streak when completed yesterday but not yet today', () => {
      const dates = ['2026-11-12', '2026-11-13']; // Today (2026-11-14) not yet done
      const { currentStreak, longestStreak } = calculateHabitStreaks(dates, refDate);
      expect(currentStreak).toBe(2);
      expect(longestStreak).toBe(2);
    });

    it('resets current streak to 0 if a day was missed', () => {
      const dates = ['2026-11-10', '2026-11-11']; // Missed 12, 13, 14
      const { currentStreak, longestStreak } = calculateHabitStreaks(dates, refDate);
      expect(currentStreak).toBe(0);
      expect(longestStreak).toBe(2); // Preserves longest historical streak
    });

    it('correctly tracks highest historical longest streak across gaps', () => {
      const dates = [
        '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', // 5-day streak
        '2026-11-13', '2026-11-14' // current 2-day streak
      ];
      const { currentStreak, longestStreak } = calculateHabitStreaks(dates, refDate);
      expect(currentStreak).toBe(2);
      expect(longestStreak).toBe(5);
    });
  });

  describe('migrateHabitsToCanonical', () => {
    it('unifies web (streak + habit_logs) and mobile (fire + logs[]) into completionDates without duplicate dates', () => {
      const legacyHabits = [
        {
          id: 'h_read',
          name: 'Read 20 Pages',
          streak: 2,
          fire: 2,
          logs: ['2026-11-12', '2026-11-13'] // Mobile logs
        }
      ];

      const legacyLogsMap = {
        h_read: ['2026-11-13', '2026-11-14'] // Web logs (overlap on 13, new on 14)
      };

      const migrated = migrateHabitsToCanonical(legacyHabits, legacyLogsMap);
      expect(migrated.length).toBe(1);

      const habit = migrated[0];
      expect(habit.id).toBe('h_read');
      // All unique dates merged and sorted
      expect(habit.completionDates).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
      expect(habit.currentStreak).toBe(3);
      expect(habit.longestStreak).toBe(3);
      // Dual-compatibility properties updated
      expect(habit.streak).toBe(3);
      expect(habit.fire).toBe(3);
      expect(habit.logs).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
      expect(habit.schemaVersion).toBe(1);
    });

    it('is completely idempotent across multiple execution cycles', () => {
      const raw = [{ id: 'h_1', name: 'Exercise', fire: 1, logs: ['2026-11-14'] }];
      const pass1 = migrateHabitsToCanonical(raw, {});
      const pass2 = migrateHabitsToCanonical(pass1, {});

      expect(pass1).toEqual(pass2);
      expect(pass2[0].completionDates).toEqual(['2026-11-14']);
    });
  });
});


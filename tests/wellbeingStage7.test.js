import { describe, it, expect } from 'vitest';
import {
  evaluateHabitConsistency,
  toggleHabitCompletion,
  isHabitScheduledForDay,
  normalizeHabit
} from '../shared/domain/wellbeing/index.js';

describe('Wellbeing Domain - Stage 7: Habit Intelligence, Streaks & Consistency', () => {
  const refDate = new Date(2026, 10, 14); // Saturday Nov 14, 2026 (day 6)

  describe('Habit Scheduling by Recurrence', () => {
    it('recognizes daily habits as scheduled for every day', () => {
      const dailyHabit = normalizeHabit({ name: 'Meditation', frequency: { type: 'daily' } });
      for (let day = 0; day < 7; day++) {
        expect(isHabitScheduledForDay(dailyHabit, day)).toBe(true);
      }
    });

    it('recognizes weekday habits only for Monday through Friday', () => {
      const weekdayHabit = normalizeHabit({ name: 'Study Prep', frequency: { type: 'weekdays' } });
      expect(isHabitScheduledForDay(weekdayHabit, 0)).toBe(false); // Sunday
      expect(isHabitScheduledForDay(weekdayHabit, 1)).toBe(true);  // Monday
      expect(isHabitScheduledForDay(weekdayHabit, 5)).toBe(true);  // Friday
      expect(isHabitScheduledForDay(weekdayHabit, 6)).toBe(false); // Saturday
    });
  });

  describe('Streak & Consistency Evaluations', () => {
    it('evaluates streaks and weekly/monthly completion rates', () => {
      const habit = normalizeHabit({
        name: 'Morning Workout',
        frequency: { type: 'daily' },
        completionDates: [
          '2026-11-14',
          '2026-11-13',
          '2026-11-12',
          '2026-11-11',
          '2026-11-10'
        ]
      });

      const res = evaluateHabitConsistency(habit, refDate);
      expect(res.currentStreak).toBe(5);
      expect(res.longestStreak).toBe(5);
      expect(res.isCompletedToday).toBe(true);
      expect(res.completedLast7).toBe(5);
      expect(res.weeklyCompletionRate).toBe(Math.round((5 / 7) * 100)); // 71%
      expect(res.insights.length).toBeGreaterThan(0);
    });

    it('paused habits do not accrue missed-day penalties', () => {
      const pausedHabit = normalizeHabit({
        name: 'Gym',
        isPaused: true,
        completionDates: ['2026-10-01']
      });

      const res = evaluateHabitConsistency(pausedHabit, refDate);
      expect(res.isPaused).toBe(true);
      expect(res.missedDays.length).toBe(0);
      expect(res.insights.some(i => i.includes('paused'))).toBe(true);
    });
  });

  describe('Toggling Habit Completion', () => {
    it('toggles completion date and deterministically updates streaks', () => {
      let habit = normalizeHabit({
        name: 'Read Book',
        completionDates: ['2026-11-13']
      });

      // Mark completed today
      habit = toggleHabitCompletion(habit, '2026-11-14', refDate);
      expect(habit.completionDates.includes('2026-11-14')).toBe(true);
      expect(habit.currentStreak).toBe(2);

      // Unmark completed today
      habit = toggleHabitCompletion(habit, '2026-11-14', refDate);
      expect(habit.completionDates.includes('2026-11-14')).toBe(false);
      expect(habit.currentStreak).toBe(1);
    });
  });
});


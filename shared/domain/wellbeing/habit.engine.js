/**
 * shared/domain/wellbeing/habit.engine.js
 * Deterministic Habit Intelligence, Recurrence & Consistency Engine for Planrova 2.0.
 *
 * Invariants:
 * 1. Streaks evaluate against the habit's actual recurrence schedule (daily, weekly, selected weekdays).
 * 2. Paused habits NEVER accrue missed-day penalties.
 * 3. Insights are supportive and non-judgmental (zero guilt-inducing messaging).
 */

import { calculateHabitStreaks } from '../entities/habit.schema.js';

/**
 * Checks whether a habit is scheduled for a given day of the week (0 = Sun, 1 = Mon, ..., 6 = Sat).
 */
export function isHabitScheduledForDay(habit, dayOfWeek) {
  if (habit.isPaused || habit.isArchived) return false;
  const freq = habit.frequency || {};

  if (!freq.type || freq.type === 'daily') {
    return true;
  }
  if (freq.type === 'weekdays') {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }
  if (freq.type === 'weekly' || freq.type === 'custom') {
    if (Array.isArray(freq.days) && freq.days.length > 0) {
      return freq.days.includes(dayOfWeek);
    }
    return true;
  }
  return true;
}

/**
 * Evaluates comprehensive habit consistency, streaks, and completion rates.
 */
export function evaluateHabitConsistency(habit, referenceDate = new Date()) {
  const completionDates = Array.isArray(habit.completionDates) ? [...new Set(habit.completionDates)] : [];
  const completionSet = new Set(completionDates);

  // 1. Calculate standard consecutive streaks
  const { currentStreak, longestStreak } = calculateHabitStreaks(completionDates, referenceDate);

  // 2. Evaluate scheduled days vs completed days over last 7 and 30 calendar days
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  let scheduledLast7 = 0;
  let completedLast7 = 0;
  let scheduledLast30 = 0;
  let completedLast30 = 0;
  const missedDays = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(refYear, refMonth, refDay - i);
    const dayOfWeek = d.getDay();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const isScheduled = isHabitScheduledForDay(habit, dayOfWeek);
    const isCompleted = completionSet.has(dateStr);

    if (isScheduled) {
      if (i < 7) {
        scheduledLast7++;
        if (isCompleted) completedLast7++;
      }
      scheduledLast30++;
      if (isCompleted) {
        completedLast30++;
      } else if (i > 0) { // Don't penalize today as missed if not yet completed
        missedDays.push(dateStr);
      }
    }
  }

  const weeklyRate = scheduledLast7 > 0
    ? Math.round((completedLast7 / scheduledLast7) * 100)
    : 0;
  const monthlyRate = scheduledLast30 > 0
    ? Math.round((completedLast30 / scheduledLast30) * 100)
    : 0;

  // Today's status
  const todayStr = `${refYear}-${String(refMonth + 1).padStart(2, '0')}-${String(refDay).padStart(2, '0')}`;
  const isCompletedToday = completionSet.has(todayStr);
  const isScheduledToday = isHabitScheduledForDay(habit, referenceDate.getDay());

  // Supportive insights
  const insights = [];
  if (habit.isPaused) {
    insights.push('This habit is currently paused. No streak penalties apply.');
  } else if (isCompletedToday) {
    insights.push(`Completed today! Current streak: ${currentStreak} days.`);
  } else if (isScheduledToday) {
    insights.push('Scheduled for today. Keep up your momentum!');
  }

  if (weeklyRate >= 80) {
    insights.push(`Strong consistency this week (${completedLast7}/${scheduledLast7} days).`);
  }

  return {
    habitId: habit.id,
    name: habit.name || habit.title,
    currentStreak,
    longestStreak,
    weeklyCompletionRate: weeklyRate,
    monthlyCompletionRate: monthlyRate,
    completedLast7,
    scheduledLast7,
    completedLast30,
    scheduledLast30,
    missedDays,
    isCompletedToday,
    isScheduledToday,
    isPaused: Boolean(habit.isPaused),
    insights
  };
}

/**
 * Toggles or updates completion date for a habit and deterministically recomputes streaks.
 */
export function toggleHabitCompletion(habit, dateStr, referenceDate = new Date()) {
  const existing = Array.isArray(habit.completionDates) ? [...habit.completionDates] : [];
  const set = new Set(existing);

  if (set.has(dateStr)) {
    set.delete(dateStr);
  } else {
    set.add(dateStr);
  }

  const updatedDates = [...set].sort();
  const { currentStreak, longestStreak } = calculateHabitStreaks(updatedDates, referenceDate);

  return {
    ...habit,
    completionDates: updatedDates,
    currentStreak,
    longestStreak,
    streak: currentStreak, // compatibility
    fire: currentStreak, // compatibility
    updatedAt: new Date().toISOString()
  };
}


/**
 * shared/domain/entities/habit.schema.js
 * Canonical Habit Schema, Deterministic Streak Engine & Validation for Planrova 2.0
 */

/**
 * Calculates current and longest streaks from an array of completion dates (YYYY-MM-DD).
 * Deterministic and timezone-safe using local calendar dates.
 */
export function calculateHabitStreaks(completionDates = [], referenceDate = new Date()) {
  if (!Array.isArray(completionDates) || completionDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Deduplicate and sort dates chronologically (oldest to newest)
  const sortedDates = [...new Set(completionDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  if (sortedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // 1. Calculate Longest Historical Streak
  let longestStreak = 0;
  let runningStreak = 0;
  let prevTimestamp = null;

  for (const dateStr of sortedDates) {
    const parts = dateStr.split('-').map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const currentTimestamp = dateObj.getTime();

    if (prevTimestamp === null) {
      runningStreak = 1;
    } else {
      const diffDays = Math.round((currentTimestamp - prevTimestamp) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        runningStreak += 1;
      } else if (diffDays > 1) {
        runningStreak = 1;
      }
      // If diffDays === 0 (duplicate), leave runningStreak unchanged
    }

    prevTimestamp = currentTimestamp;
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
  }

  // 2. Calculate Current Active Streak relative to referenceDate
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  const todayStr = `${refYear}-${String(refMonth + 1).padStart(2, '0')}-${String(refDay).padStart(2, '0')}`;
  
  const yesterdayObj = new Date(refYear, refMonth, refDay - 1);
  const yesterdayStr = `${yesterdayObj.getFullYear()}-${String(yesterdayObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayObj.getDate()).padStart(2, '0')}`;

  const dateSet = new Set(sortedDates);
  let currentStreak = 0;

  // Determine starting point: today or yesterday
  let checkObj = null;
  if (dateSet.has(todayStr)) {
    currentStreak = 1;
    checkObj = new Date(refYear, refMonth, refDay - 1);
  } else if (dateSet.has(yesterdayStr)) {
    currentStreak = 1;
    checkObj = new Date(refYear, refMonth, refDay - 2);
  }

  // Count backwards day by day as long as consecutive days were completed
  while (checkObj !== null) {
    const checkStr = `${checkObj.getFullYear()}-${String(checkObj.getMonth() + 1).padStart(2, '0')}-${String(checkObj.getDate()).padStart(2, '0')}`;
    if (dateSet.has(checkStr)) {
      currentStreak += 1;
      checkObj.setDate(checkObj.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak)
  };
}

/**
 * Validates a canonical Habit object.
 */
export function validateHabit(habit) {
  const errors = [];
  if (!habit || typeof habit !== 'object') {
    return { valid: false, errors: ['Habit must be an object'] };
  }

  if (!habit.id || typeof habit.id !== 'string') {
    errors.push('Habit id is required and must be a string');
  }

  if (!habit.name || typeof habit.name !== 'string' || habit.name.trim().length === 0) {
    errors.push('Habit name is required and cannot be empty');
  }

  if (habit.completionDates && !Array.isArray(habit.completionDates)) {
    errors.push('completionDates must be an array of date strings');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes any habit (legacy or new) into the Canonical Habit schema.
 * Reconciles streak, fire, logs array, and completion history into completionDates.
 */
export function normalizeHabit(raw = {}, legacyLogsMap = {}) {
  const now = Date.now();
  const id = raw.id || `h_${now}_${Math.floor(Math.random() * 1000)}`;
  const name = (raw.name || raw.title || 'Daily Habit').trim();
  const icon = raw.icon || 'sparkles';
  const color = raw.color || null;

  // Reconcile dates from all legacy sources
  const dateCandidates = [];
  if (Array.isArray(raw.completionDates)) dateCandidates.push(...raw.completionDates);
  if (Array.isArray(raw.logs)) dateCandidates.push(...raw.logs);
  if (Array.isArray(legacyLogsMap[id])) dateCandidates.push(...legacyLogsMap[id]);

  const completionDates = [...new Set(dateCandidates.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();

  // Deterministically compute streak from completion dates
  const { currentStreak, longestStreak } = calculateHabitStreaks(completionDates);

  // Preserve legacy frequency
  const frequency = raw.frequency || { type: 'daily', days: [] };

  return {
    ...raw,
    id,
    name,
    icon,
    color,
    frequency,
    completionDates,
    currentStreak,
    longestStreak,
    // Transitional compatibility properties for legacy code:
    streak: currentStreak,
    fire: currentStreak,
    logs: completionDates,
    createdAt: raw.createdAt || raw.created_at || now,
    updatedAt: raw.updatedAt || raw.updated_at || now,
    deleted: Boolean(raw.deleted),
    schemaVersion: 1
  };
}


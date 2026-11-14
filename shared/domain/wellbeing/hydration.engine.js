/**
 * shared/domain/wellbeing/hydration.engine.js
 * Hydration Analytics, Daily Tracking & Reminder Scheduling Engine for Planrova 2.0.
 *
 * Invariants:
 * 1. Volume measured authoritatively in millilitres (ml).
 * 2. User-configured targets; never infers medical hydration requirements.
 * 3. Daily reset based strictly on local date key (YYYY-MM-DD).
 */

/**
 * Aggregates daily hydration progress from hydration logs for a specific target date.
 */
export function calculateDailyHydration(logs = [], targetDateStr = new Date().toISOString().slice(0, 10), targetGoalMl = 2000) {
  const safeGoal = Math.max(500, parseInt(targetGoalMl, 10) || 2000);
  const dayLogs = (logs || []).filter(l => (l.dateKey === targetDateStr || l.date === targetDateStr));

  let totalMl = 0;
  const beverageBreakdown = {};

  for (const log of dayLogs) {
    const ml = typeof log.amountMl === 'number' ? log.amountMl : (parseInt(log.amount, 10) || 0);
    totalMl += ml;
    const type = log.beverageType || 'water';
    beverageBreakdown[type] = (beverageBreakdown[type] || 0) + ml;
  }

  const percentage = Math.min(100, Math.round((totalMl / safeGoal) * 100));
  const remainingMl = Math.max(0, safeGoal - totalMl);
  const isGoalReached = totalMl >= safeGoal;

  return {
    dateKey: targetDateStr,
    totalMl,
    targetGoalMl: safeGoal,
    remainingMl,
    percentage,
    isGoalReached,
    logCount: dayLogs.length,
    beverageBreakdown,
    logs: dayLogs
  };
}

/**
 * Computes weekly hydration progress (past 7 days) up to reference date.
 */
export function calculateWeeklyHydration(logs = [], referenceDate = new Date(), targetGoalMl = 2000) {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  const days = [];
  let weeklyTotalMl = 0;
  let goalsReachedCount = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date(refYear, refMonth, refDay - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const daily = calculateDailyHydration(logs, dateStr, targetGoalMl);
    
    days.push({
      dateKey: dateStr,
      dayOfWeek: d.getDay(),
      dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      totalMl: daily.totalMl,
      percentage: daily.percentage,
      isGoalReached: daily.isGoalReached
    });

    weeklyTotalMl += daily.totalMl;
    if (daily.isGoalReached) goalsReachedCount++;
  }

  const dailyAverageMl = Math.round(weeklyTotalMl / 7);

  return {
    days,
    weeklyTotalMl,
    dailyAverageMl,
    goalsReachedCount,
    consistencyPercentage: Math.round((goalsReachedCount / 7) * 100)
  };
}

/**
 * Computes non-spam reminder candidate slots for hydration during waking hours.
 */
export function generateHydrationReminderSlots({
  wakeTime = '08:00',
  sleepTime = '22:00',
  intervalMinutes = 90
} = {}) {
  const [wH, wM] = wakeTime.split(':').map(Number);
  const [sH, sM] = sleepTime.split(':').map(Number);

  const startTotalMin = wH * 60 + wM;
  const endTotalMin = sH * 60 + sM;
  const slots = [];

  if (startTotalMin >= endTotalMin) {
    return slots;
  }

  let currentMin = startTotalMin + intervalMinutes;
  while (currentMin <= endTotalMin - 30) {
    const h = String(Math.floor(currentMin / 60)).padStart(2, '0');
    const m = String(currentMin % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    currentMin += intervalMinutes;
  }

  return slots;
}


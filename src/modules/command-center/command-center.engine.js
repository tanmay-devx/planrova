/**
 * Planrova 2.0 — Daily Command Center Engine
 * Pure, deterministic logic for the command center dashboard:
 * - Dynamic context-aware greetings
 * - Aggregated daily health metrics
 * - Ranked priority actions (tasks, assessments, habits)
 * - Explainable "Next Best Action" recommendation engine
 * - 7-day weekly outlook distribution
 */

/**
 * Returns dynamic greeting based on time of day and user name.
 * @param {number} hour (0-23)
 * @param {string} [userName='Builder']
 * @returns {string}
 */
export function computeGreeting(hour, userName = 'Builder') {
  const safeName = (userName && userName.trim()) || 'Builder';
  if (hour >= 5 && hour < 12) {
    return `Good morning, ${safeName}`;
  }
  if (hour >= 12 && hour < 17) {
    return `Good afternoon, ${safeName}`;
  }
  if (hour >= 17 && hour < 22) {
    return `Good evening, ${safeName}`;
  }
  return `Working late, ${safeName}`;
}

/**
 * Computes consolidated daily metrics across productivity, habits, water, and focus.
 */
export function computeTodayStats({
  tasks = [],
  habits = [],
  habitLogs = {},
  hydration = {},
  pomodoroStats = {},
  todayStr
}) {
  const safeToday = todayStr || new Date().toISOString().split('T')[0];

  // 1. Tasks
  const todayTasks = tasks.filter(t => !t.deleted && (t.date === safeToday || (!t.date && !t.completed)));
  const tasksDone = todayTasks.filter(t => t.completed).length;
  const tasksRemaining = todayTasks.filter(t => !t.completed).length;
  const highPriorityRemaining = todayTasks.filter(t => !t.completed && (t.priority === 'high' || t.priority === 'p1' || t.priority === 'critical')).length;

  // 2. Habits
  const todayCompletedHabitIds = new Set(habitLogs[safeToday] || []);
  const activeHabits = habits.filter(h => !h.archived && !h.deleted);
  const habitsDone = activeHabits.filter(h => todayCompletedHabitIds.has(h.id)).length;
  const habitsTotal = activeHabits.length;

  // 3. Hydration
  const water = Number(hydration.water) || 0;
  const waterTarget = Number(hydration.target) || 2000;
  const waterPct = Math.min(100, Math.round((water / Math.max(1, waterTarget)) * 100));

  // 4. Focus / Pomodoro
  const rounds = Number(pomodoroStats.roundsToday) || 0;
  const focusMinutes = rounds * 25;

  return {
    todayStr: safeToday,
    tasksTotal: todayTasks.length,
    tasksDone,
    tasksRemaining,
    highPriorityRemaining,
    habitsDone,
    habitsTotal,
    habitsPct: habitsTotal > 0 ? Math.round((habitsDone / habitsTotal) * 100) : 0,
    water,
    waterTarget,
    waterPct,
    focusRounds: rounds,
    focusMinutes
  };
}

/**
 * Derives top priority actions across tasks, assessments, and habits.
 * @param {object} params
 * @returns {Array<object>} Top ranked actions
 */
export function computePriorityActions({
  tasks = [],
  assessments = [],
  habits = [],
  habitLogs = {},
  todayStr,
  limit = 5
}) {
  const safeToday = todayStr || new Date().toISOString().split('T')[0];
  const todayLogIds = new Set(habitLogs[safeToday] || []);
  const candidates = [];

  // 1. Academic Assessments (highest weight if due today or within 48h)
  assessments.forEach(ass => {
    if (ass.deleted || ass.status === 'completed' || ass.status === 'graded') return;
    const isDueToday = ass.dueDate === safeToday;
    const isOverdue = ass.dueDate && ass.dueDate < safeToday;
    const weight = isOverdue ? 120 : (isDueToday ? 100 : 70);

    candidates.push({
      id: ass.id,
      title: ass.title || 'Upcoming Assessment',
      type: 'academic',
      badge: ass.courseCode || 'Exam / Due',
      due: ass.dueDate || 'Soon',
      weight,
      isOverdue,
      isDueToday,
      priority: 'critical'
    });
  });

  // 2. High-priority & regular tasks
  tasks.forEach(task => {
    if (task.deleted || task.completed) return;
    const isToday = task.date === safeToday;
    const isOverdue = task.date && task.date < safeToday;
    const isHigh = task.priority === 'high' || task.priority === 'p1' || task.priority === 'critical';

    let weight = 20;
    if (isOverdue && isHigh) weight = 95;
    else if (isOverdue) weight = 80;
    else if (isToday && isHigh) weight = 75;
    else if (isToday) weight = 50;
    else if (isHigh) weight = 40;

    candidates.push({
      id: task.id,
      title: task.title || 'Untitled Task',
      type: 'task',
      badge: task.category || 'Task',
      due: task.date || 'Anytime',
      weight,
      isOverdue,
      isDueToday: isToday,
      priority: task.priority || 'medium'
    });
  });

  // 3. Incomplete habits
  habits.forEach(habit => {
    if (habit.archived || habit.deleted) return;
    if (todayLogIds.has(habit.id)) return; // already done

    candidates.push({
      id: habit.id,
      title: habit.name || 'Daily Habit',
      type: 'habit',
      badge: 'Habit',
      due: 'Today',
      weight: 45,
      isOverdue: false,
      isDueToday: true,
      priority: 'medium'
    });
  });

  // Sort by weight descending
  candidates.sort((a, b) => b.weight - a.weight);

  return candidates.slice(0, limit);
}

/**
 * Computes a single, explainable "Next Best Action" recommendation.
 */
export function computeNextBestAction({
  tasks = [],
  assessments = [],
  habits = [],
  habitLogs = {},
  hour = new Date().getHours(),
  todayStr
}) {
  const safeToday = todayStr || new Date().toISOString().split('T')[0];
  const todayLogIds = new Set(habitLogs[safeToday] || []);

  // 1. Critical academic assessment check
  const urgentAssessment = assessments.find(a =>
    !a.deleted &&
    a.status !== 'completed' &&
    a.status !== 'graded' &&
    (a.dueDate === safeToday || (a.dueDate && a.dueDate < safeToday))
  );

  if (urgentAssessment) {
    return {
      title: `Prepare for ${urgentAssessment.title}`,
      reason: `High Stakes Deadline: Assessment is ${urgentAssessment.dueDate === safeToday ? 'due today' : 'overdue'} (${urgentAssessment.courseCode || 'Academic'})`,
      badge: 'Urgent Assessment',
      actionType: 'academic',
      targetId: urgentAssessment.id,
      ctaText: 'Open Academic Workspace'
    };
  }

  // 2. High priority task in peak morning focus window
  const highPriorityTask = tasks.find(t =>
    !t.deleted &&
    !t.completed &&
    (t.priority === 'high' || t.priority === 'p1' || t.priority === 'critical') &&
    (t.date === safeToday || !t.date)
  );

  if (hour < 12 && highPriorityTask) {
    return {
      title: highPriorityTask.title,
      reason: 'Peak Morning Focus: Your cognitive energy is highest for deep, complex work',
      badge: 'Deep Work',
      actionType: 'task',
      targetId: highPriorityTask.id,
      ctaText: 'Start Focus Session'
    };
  }

  // 3. Afternoon execution
  const dueTodayTask = tasks.find(t => !t.deleted && !t.completed && t.date === safeToday);
  if (hour >= 12 && hour < 17 && dueTodayTask) {
    return {
      title: dueTodayTask.title,
      reason: 'Afternoon Execution: High momentum window to clear scheduled daily actions',
      badge: 'Action Item',
      actionType: 'task',
      targetId: dueTodayTask.id,
      ctaText: 'Focus on Task'
    };
  }

  // 4. Evening wind-down habit
  const pendingHabit = habits.find(h => !h.archived && !h.deleted && !todayLogIds.has(h.id));
  if (hour >= 17 && pendingHabit) {
    return {
      title: `Complete: ${pendingHabit.name}`,
      reason: 'Evening Consistency: Maintain your daily streak before the day wraps up',
      badge: 'Habit Streak',
      actionType: 'habit',
      targetId: pendingHabit.id,
      ctaText: 'Mark Habit Complete'
    };
  }

  // 5. Fallback to any pending task
  const anyTask = tasks.find(t => !t.deleted && !t.completed);
  if (anyTask) {
    return {
      title: anyTask.title,
      reason: 'Next Daily Action: Clear your pending backlog step-by-step',
      badge: 'Priority Task',
      actionType: 'task',
      targetId: anyTask.id,
      ctaText: 'Start Focus'
    };
  }

  // 6. All caught up
  return {
    title: 'Daily Objectives Cleared!',
    reason: 'All priority actions for today are complete. Take time to recharge or review tomorrow’s plan.',
    badge: 'All Clear',
    actionType: 'done',
    targetId: null,
    ctaText: 'Review Tomorrow'
  };
}

/**
 * Computes 7-day compact weekly outlook strip.
 */
export function computeWeeklyOutlook({ tasks = [], baseDate = new Date() }) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const current = new Date(baseDate);
  const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...

  // Calculate Monday of current week
  const diffToMonday = current.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(current);
  monday.setDate(diffToMonday);

  const todayIso = new Date(baseDate).toISOString().split('T')[0];
  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = dateStr === todayIso;

    const dayTasks = tasks.filter(t => !t.deleted && t.date === dateStr);
    const totalCount = dayTasks.length;
    const doneCount = dayTasks.filter(t => t.completed).length;
    const hasHigh = dayTasks.some(t => !t.completed && (t.priority === 'high' || t.priority === 'p1' || t.priority === 'critical'));

    days.push({
      dateStr,
      dayName: dayNames[d.getDay()],
      dayNum: d.getDate(),
      isToday,
      totalCount,
      doneCount,
      hasHigh
    });
  }

  return days;
}


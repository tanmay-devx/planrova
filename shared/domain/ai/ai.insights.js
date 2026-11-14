/**
 * shared/domain/ai/ai.insights.js
 * Planrova 2.0 Personal Insights & Cross-Domain Pattern Detection Engine.
 *
 * Implements deterministic, explainable pattern analytics across:
 * 1. Study time (Pomodoro/focus) vs Academic assessment scores.
 * 2. Wellbeing (Hydration/Habits) vs Task completion productivity.
 * 3. Day-of-week Financial spending velocity (Weekend bursts).
 * 4. Project and assessment deadline pacing diagnostics.
 *
 * All insights are strictly deterministic, evidence-backed, and local-first.
 */

export const INSIGHT_TYPES = Object.freeze({
  ACADEMIC_STUDY_CORRELATION: 'ACADEMIC_STUDY_CORRELATION',
  ACADEMIC_PREPARATION_DEFICIT: 'ACADEMIC_PREPARATION_DEFICIT',
  WELLBEING_PRODUCTIVITY_CORRELATION: 'WELLBEING_PRODUCTIVITY_CORRELATION',
  FINANCIAL_SPENDING_BURST: 'FINANCIAL_SPENDING_BURST',
  DEADLINE_PACING_PRESSURE: 'DEADLINE_PACING_PRESSURE'
});

export const INSIGHT_DOMAINS = Object.freeze({
  ACADEMIC: 'academic',
  WELLBEING: 'wellbeing',
  FINANCE: 'finance',
  PRODUCTIVITY: 'productivity'
});

export const INSIGHT_IMPACTS = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
});

/**
 * Analyzes correlation between logged focus/study time and academic performance.
 */
export function analyzeStudyAcademicCorrelation({
  pomodoros = [],
  assessments = [],
  courses = [],
  now = new Date()
} = {}) {
  const insights = [];
  const nowDate = new Date(now);

  // 1. Map focus minutes per course
  const focusMinutesByCourse = {};
  for (const session of pomodoros) {
    if (session.completed || session.status === 'completed' || session.durationMinutes || session.duration) {
      const courseId = session.courseId || session.subjectId || session.tag || 'general';
      const duration = Number(session.durationMinutes || session.duration || 25);
      if (duration > 0) {
        focusMinutesByCourse[courseId] = (focusMinutesByCourse[courseId] || 0) + duration;
      }
    }
  }

  // 2. Score assessments with percentage grades
  const scoredByCourse = {};
  for (const ass of assessments) {
    if (ass.courseId && (ass.status === 'graded' || ass.grade !== undefined || ass.score !== undefined)) {
      const maxScore = Number(ass.maxScore || 100);
      const score = Number(ass.score !== undefined ? ass.score : (ass.grade !== undefined ? ass.grade : 0));
      if (maxScore > 0 && !isNaN(score)) {
        const pct = (score / maxScore) * 100;
        if (!scoredByCourse[ass.courseId]) scoredByCourse[ass.courseId] = [];
        scoredByCourse[ass.courseId].push(pct);
      }
    }
  }

  // Correlate courses with high focus vs low focus
  const courseComparisons = [];
  for (const course of courses) {
    const courseId = course.id;
    const focusMin = focusMinutesByCourse[courseId] || 0;
    const scores = scoredByCourse[courseId] || [];
    if (scores.length > 0) {
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      courseComparisons.push({
        courseId,
        courseName: course.name || course.code || 'Course',
        focusMin,
        avgScore
      });
    }
  }

  if (courseComparisons.length >= 2) {
    const highStudy = courseComparisons.filter(c => c.focusMin >= 90);
    const lowStudy = courseComparisons.filter(c => c.focusMin < 90);

    if (highStudy.length > 0 && lowStudy.length > 0) {
      const highAvg = highStudy.reduce((sum, c) => sum + c.avgScore, 0) / highStudy.length;
      const lowAvg = lowStudy.reduce((sum, c) => sum + c.avgScore, 0) / lowStudy.length;
      const delta = highAvg - lowAvg;

      if (delta >= 4.0) {
        insights.push({
          id: `insight-study-acad-${Date.now()}`,
          type: INSIGHT_TYPES.ACADEMIC_STUDY_CORRELATION,
          domain: INSIGHT_DOMAINS.ACADEMIC,
          title: 'Focus Time Strongly Correlates with Higher Grades',
          evidence: `Courses with 90+ minutes of logged focus study average ${highAvg.toFixed(1)}% on assessments, compared to ${lowAvg.toFixed(1)}% with lower focus time (+${delta.toFixed(1)}% boost).`,
          dataPoints: {
            highStudyAvg: Number(highAvg.toFixed(1)),
            lowStudyAvg: Number(lowAvg.toFixed(1)),
            deltaPct: Number(delta.toFixed(1)),
            highCoursesCount: highStudy.length,
            lowCoursesCount: lowStudy.length
          },
          recommendation: 'Maintain a minimum of two 45-minute focus blocks per course each week to keep exam performance high.',
          suggestedAction: {
            type: 'START_FOCUS',
            label: 'Start Focus Session',
            targetView: 'pomodoro'
          },
          confidence: 0.88,
          impact: INSIGHT_IMPACTS.HIGH,
          generatedAt: nowDate.toISOString()
        });
      }
    }
  }

  // 3. Upcoming assessment with zero preparation
  for (const ass of assessments) {
    if (ass.dueDate && ass.status !== 'graded' && ass.status !== 'submitted') {
      const due = new Date(ass.dueDate);
      const diffDays = Math.ceil((due.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 5) {
        const focusMin = focusMinutesByCourse[ass.courseId] || 0;
        if (focusMin < 30) {
          const course = courses.find(c => c.id === ass.courseId);
          const courseName = course ? (course.name || course.code) : 'Upcoming Course';
          insights.push({
            id: `insight-prep-def-${ass.id}`,
            type: INSIGHT_TYPES.ACADEMIC_PREPARATION_DEFICIT,
            domain: INSIGHT_DOMAINS.ACADEMIC,
            title: `Low Study Time for Imminent Assessment: ${ass.title || 'Assessment'}`,
            evidence: `${ass.title || 'Assessment'} in ${courseName} is due in ${diffDays} day(s), but only ${focusMin} minutes of focus study have been logged.`,
            dataPoints: {
              assessmentId: ass.id,
              courseId: ass.courseId,
              daysRemaining: diffDays,
              focusMinutesLogged: focusMin
            },
            recommendation: `Schedule an urgent 60-minute review session today to cover pending syllabus topics before ${due.toLocaleDateString()}.`,
            suggestedAction: {
              type: 'START_FOCUS',
              label: 'Launch Focus Timer',
              targetView: 'pomodoro'
            },
            confidence: 0.95,
            impact: INSIGHT_IMPACTS.HIGH,
            generatedAt: nowDate.toISOString()
          });
        }
      }
    }
  }

  return insights;
}

/**
 * Analyzes correlation between wellbeing (hydration) and task throughput.
 */
export function analyzeWellbeingProductivityCorrelation({
  tasks = [],
  hydration = [],
  targetMl = 2000,
  now = new Date()
} = {}) {
  const insights = [];
  const nowDate = new Date(now);

  if (!tasks.length || !hydration.length) return insights;

  // Group tasks by completion date or dueDate
  const tasksByDate = {};
  for (const t of tasks) {
    const dateKey = (t.completedAt || t.dueDate || t.updatedAt || '').slice(0, 10);
    if (dateKey && dateKey.length === 10) {
      if (!tasksByDate[dateKey]) tasksByDate[dateKey] = { total: 0, completed: 0 };
      tasksByDate[dateKey].total += 1;
      if (t.completed || t.status === 'completed') {
        tasksByDate[dateKey].completed += 1;
      }
    }
  }

  // Group hydration by date
  const hydrationByDate = {};
  for (const h of hydration) {
    const dateKey = (h.date || h.timestamp || h.createdAt || '').slice(0, 10);
    if (dateKey && dateKey.length === 10) {
      const ml = Number(h.amountMl || (h.glasses ? h.glasses * 250 : 0) || h.amount || 0);
      hydrationByDate[dateKey] = (hydrationByDate[dateKey] || 0) + ml;
    }
  }

  const hydratedDays = [];
  const dehydratedDays = [];

  for (const [dateKey, stats] of Object.entries(tasksByDate)) {
    if (stats.total >= 2) {
      const intake = hydrationByDate[dateKey] || 0;
      const rate = (stats.completed / stats.total) * 100;
      if (intake >= targetMl) {
        hydratedDays.push(rate);
      } else {
        dehydratedDays.push(rate);
      }
    }
  }

  if (hydratedDays.length >= 2 && dehydratedDays.length >= 2) {
    const hydratedAvg = hydratedDays.reduce((a, b) => a + b, 0) / hydratedDays.length;
    const dehydratedAvg = dehydratedDays.reduce((a, b) => a + b, 0) / dehydratedDays.length;
    const delta = hydratedAvg - dehydratedAvg;

    if (delta >= 10.0) {
      insights.push({
        id: `insight-wellbeing-prod-${Date.now()}`,
        type: INSIGHT_TYPES.WELLBEING_PRODUCTIVITY_CORRELATION,
        domain: INSIGHT_DOMAINS.WELLBEING,
        title: 'Hydration Significantly Boosts Daily Task Throughput',
        evidence: `On days you met your hydration target (${targetMl}ml+), task completion rate averaged ${hydratedAvg.toFixed(1)}% compared to ${dehydratedAvg.toFixed(1)}% on low-intake days (+${delta.toFixed(1)}% productivity boost).`,
        dataPoints: {
          hydratedAvgPct: Number(hydratedAvg.toFixed(1)),
          dehydratedAvgPct: Number(dehydratedAvg.toFixed(1)),
          deltaPct: Number(delta.toFixed(1)),
          sampleHydratedDays: hydratedDays.length,
          sampleDehydratedDays: dehydratedDays.length
        },
        recommendation: `Drink a glass of water first thing in the morning and maintain a bottle at your desk to hit ${targetMl}ml consistently.`,
        suggestedAction: {
          type: 'LOG_HYDRATION',
          label: 'Log Water Intake',
          targetView: 'hydration'
        },
        confidence: 0.84,
        impact: INSIGHT_IMPACTS.MEDIUM,
        generatedAt: nowDate.toISOString()
      });
    }
  }

  return insights;
}

/**
 * Analyzes financial spending patterns across days of the week (weekend spending bursts).
 */
export function analyzeSpendingPatterns({
  transactions = [],
  now = new Date()
} = {}) {
  const insights = [];
  const nowDate = new Date(now);

  const expenses = transactions.filter(t => {
    const amt = Number(t.amount || 0);
    const isExpType = t.type === 'expense' || t.category !== 'income';
    return isExpType && (amt > 0 || (amt < 0 && t.type === 'expense'));
  });

  if (expenses.length < 5) return insights;

  let weekdayTotal = 0;
  let weekdayCount = 0;
  let weekendTotal = 0;
  let weekendCount = 0;

  for (const txn of expenses) {
    const dateStr = txn.date || txn.timestamp || txn.createdAt;
    if (!dateStr) continue;
    const day = new Date(dateStr).getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
    const absAmount = Math.abs(Number(txn.amount || 0));

    if (day === 0 || day === 5 || day === 6) {
      weekendTotal += absAmount;
      weekendCount += 1;
    } else {
      weekdayTotal += absAmount;
      weekdayCount += 1;
    }
  }

  const avgWeekday = weekdayCount > 0 ? (weekdayTotal / weekdayCount) : 0;
  const avgWeekend = weekendCount > 0 ? (weekendTotal / weekendCount) : 0;

  if (avgWeekend > 0 && avgWeekday > 0 && avgWeekend >= avgWeekday * 1.45 && weekendTotal >= 100) {
    const multiplier = (avgWeekend / avgWeekday).toFixed(1);
    insights.push({
      id: `insight-fin-weekend-${Date.now()}`,
      type: INSIGHT_TYPES.FINANCIAL_SPENDING_BURST,
      domain: INSIGHT_DOMAINS.FINANCE,
      title: 'Elevated Weekend Spending Pattern Detected',
      evidence: `Your average spending on weekends ($${avgWeekend.toFixed(2)}/transaction) is ${multiplier}x higher than on weekdays ($${avgWeekday.toFixed(2)}/transaction). Total weekend outflow: $${weekendTotal.toFixed(2)}.`,
      dataPoints: {
        avgWeekend: Number(avgWeekend.toFixed(2)),
        avgWeekday: Number(avgWeekday.toFixed(2)),
        multiplier: Number(multiplier),
        weekendTotal: Number(weekendTotal.toFixed(2)),
        weekdayTotal: Number(weekdayTotal.toFixed(2))
      },
      recommendation: 'Consider allocating a dedicated weekend discretionary envelope in your budget to prevent rapid cash flow depletion.',
      suggestedAction: {
        type: 'MANAGE_BUDGET',
        label: 'Review Budgets',
        targetView: 'finance'
      },
      confidence: 0.91,
      impact: INSIGHT_IMPACTS.HIGH,
      generatedAt: nowDate.toISOString()
    });
  }

  return insights;
}

/**
 * Analyzes active project milestone pacing and deadline pressure.
 */
export function analyzeProjectPacing({
  projects = [],
  tasks = [],
  now = new Date()
} = {}) {
  const insights = [];
  const nowDate = new Date(now);

  for (const project of projects) {
    if (project.status === 'completed' || project.status === 'archived') continue;

    const projectTasks = tasks.filter(t => t.projectId === project.id);
    const uncompletedTasks = projectTasks.filter(t => !t.completed && t.status !== 'completed');

    if (project.targetDate && uncompletedTasks.length >= 2) {
      const deadline = new Date(project.targetDate);
      const diffDays = Math.ceil((deadline.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 7) {
        insights.push({
          id: `insight-project-pace-${project.id}`,
          type: INSIGHT_TYPES.DEADLINE_PACING_PRESSURE,
          domain: INSIGHT_DOMAINS.PRODUCTIVITY,
          title: `Deadline Velocity Alert: ${project.title}`,
          evidence: `Project "${project.title}" has ${uncompletedTasks.length} uncompleted tasks remaining with only ${diffDays} day(s) until target deadline (${deadline.toLocaleDateString()}).`,
          dataPoints: {
            projectId: project.id,
            remainingTasksCount: uncompletedTasks.length,
            daysRemaining: diffDays,
            deadline: project.targetDate
          },
          recommendation: `Schedule dedicated high-priority focus sessions today to close remaining milestones before deadline pressure spikes.`,
          suggestedAction: {
            type: 'OPEN_PROJECT',
            label: 'Open Project Workspace',
            targetView: 'projects-workspace-view'
          },
          confidence: 0.93,
          impact: INSIGHT_IMPACTS.HIGH,
          generatedAt: nowDate.toISOString()
        });
      }
    }
  }

  return insights;
}

/**
 * Unified Personal Insights Pipeline.
 * Aggregates all cross-domain analytical modules and sorts by impact.
 */
export function generatePersonalInsights({
  tasks = [],
  pomodoros = [],
  assessments = [],
  courses = [],
  hydration = [],
  transactions = [],
  projects = [],
  now = new Date()
} = {}) {
  const insights = [
    ...analyzeStudyAcademicCorrelation({ pomodoros, assessments, courses, now }),
    ...analyzeWellbeingProductivityCorrelation({ tasks, hydration, now }),
    ...analyzeSpendingPatterns({ transactions, now }),
    ...analyzeProjectPacing({ projects, tasks, now })
  ];

  // Sort by impact: HIGH first, then MEDIUM, then LOW
  const impactOrder = { [INSIGHT_IMPACTS.HIGH]: 0, [INSIGHT_IMPACTS.MEDIUM]: 1, [INSIGHT_IMPACTS.LOW]: 2 };
  insights.sort((a, b) => {
    const diff = (impactOrder[a.impact] ?? 3) - (impactOrder[b.impact] ?? 3);
    if (diff !== 0) return diff;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  return {
    insights,
    summary: {
      total: insights.length,
      highImpactCount: insights.filter(i => i.impact === INSIGHT_IMPACTS.HIGH).length,
      mediumImpactCount: insights.filter(i => i.impact === INSIGHT_IMPACTS.MEDIUM).length,
      domains: [...new Set(insights.map(i => i.domain))]
    },
    generatedAt: new Date(now).toISOString()
  };
}


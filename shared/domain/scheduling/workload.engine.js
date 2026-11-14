/**
 * shared/domain/scheduling/workload.engine.js
 * Workload Intelligence and Cognitive Load Analytics for Planrova 2.0.
 *
 * Capabilities:
 * - Deterministic flexible capacity and capacity utilization calculation
 * - Non-overlapping workload classifications (light, balanced, heavy, overloaded)
 * - Cognitive load scoring (0-100) combining task priorities, session lengths, and density
 * - Day fatigue risk assessment (low, moderate, high)
 * - Actionable workload recommendations and plain-language explanations
 *
 * 100% platform-independent; zero external dependencies.
 */

import { 
  WORKLOAD_CLASSIFICATIONS, 
  WORKLOAD_THRESHOLDS 
} from './scheduling.types.js';

import { 
  timeStringToMinutes, 
  calculateWorkloadUtilization, 
  classifyWorkload 
} from './scheduling.utils.js';

/**
 * Calculates cognitive load score (0 - 100) for a given set of blocks on a day.
 * Factors:
 * 1. Deep focus intensity (sessions >= 90 min)
 * 2. High urgency / high priority concentration
 * 3. Density / back-to-back blocks without >= 10m gaps
 */
export function calculateCognitiveLoad(blocks = [], tasks = []) {
  const taskMap = new Map((tasks || []).map(t => [String(t.id), t]));
  const sorted = [...(blocks || [])]
    .filter(b => !b.deleted && b.startTime && b.endTime)
    .sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));

  if (sorted.length === 0) return 0;

  let totalDeepFocusMinutes = 0;
  let highUrgencyMinutes = 0;
  let backToBackTransitions = 0;
  let totalScheduledWorkMinutes = 0;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const duration = current.durationMinutes || Math.max(0, timeStringToMinutes(current.endTime) - timeStringToMinutes(current.startTime));

    if (current.blockType === 'task' || current.blockType === 'lecture') {
      totalScheduledWorkMinutes += duration;

      // Deep focus session penalty if session > 90 min without break
      if (duration >= 90) {
        totalDeepFocusMinutes += duration;
      }

      // Check task priority
      const task = taskMap.get(String(current.sourceEntityId));
      const priority = (task?.priority || 'medium').toLowerCase();
      if (priority === 'urgent' || priority === 'high') {
        highUrgencyMinutes += duration;
      }
    }

    // Check transition gap to next block
    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      const gap = timeStringToMinutes(next.startTime) - timeStringToMinutes(current.endTime);
      if (gap >= 0 && gap < 10) {
        backToBackTransitions++;
      }
    }
  }

  if (totalScheduledWorkMinutes === 0) return 0;

  // Factor 1: Duration ratio (up to 40 pts)
  const durationScore = Math.min(40, (totalScheduledWorkMinutes / 480) * 40);

  // Factor 2: High urgency pressure (up to 25 pts)
  const urgencyRatio = totalScheduledWorkMinutes > 0 ? (highUrgencyMinutes / totalScheduledWorkMinutes) : 0;
  const urgencyScore = urgencyRatio * 25;

  // Factor 3: Extended deep focus fatigue (up to 20 pts)
  const deepFocusScore = Math.min(20, (totalDeepFocusMinutes / 180) * 20);

  // Factor 4: Back-to-back density without breaks (up to 15 pts)
  const densityScore = Math.min(15, backToBackTransitions * 5);

  const totalCognitiveScore = Math.min(100, Math.round(durationScore + urgencyScore + deepFocusScore + densityScore));
  return totalCognitiveScore;
}

/**
 * Assesses day fatigue risk based on cognitive load and capacity utilization.
 */
export function assessFatigueRisk(capacityUtilization, cognitiveLoadScore) {
  if (capacityUtilization >= 0.80 || cognitiveLoadScore >= 70) {
    return 'high';
  }
  if (capacityUtilization >= 0.50 || cognitiveLoadScore >= 40) {
    return 'moderate';
  }
  return 'low';
}

/**
 * Generates human-explainable, actionable recommendations for a planned day.
 */
export function generateWorkloadRecommendations({
  classification,
  capacityUtilization,
  cognitiveLoadScore,
  fatigueRisk,
  unallocatedMinutes,
  unscheduledTasks = [],
  backToBackCount = 0
}) {
  const recommendations = [];

  if (classification === WORKLOAD_CLASSIFICATIONS.OVERLOADED) {
    recommendations.push({
      type: 'warning',
      action: 'reschedule',
      message: 'Your day is overloaded. Move low-urgency tasks to subsequent days to maintain realistic commitments.'
    });
  } else if (classification === WORKLOAD_CLASSIFICATIONS.HEAVY) {
    recommendations.push({
      type: 'caution',
      action: 'buffer',
      message: 'Schedule is tightly packed. Avoid adding further commitments today.'
    });
  }

  if (fatigueRisk === 'high') {
    recommendations.push({
      type: 'alert',
      action: 'rest',
      message: 'High fatigue risk detected. Ensure you protect lunch and take short 10-minute breaks between deep focus blocks.'
    });
  }

  if (backToBackCount >= 2) {
    recommendations.push({
      type: 'suggestion',
      action: 'spacing',
      message: `Detected ${backToBackCount} back-to-back transitions without rest buffers. Consider spacing tasks by at least 10 minutes.`
    });
  }

  if (unscheduledTasks.length > 0) {
    recommendations.push({
      type: 'info',
      action: 'review_unscheduled',
      message: `${unscheduledTasks.length} task(s) could not fit in today's availability. Review unscheduled tasks to adjust deadlines or durations.`
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      action: 'maintain',
      message: `Your schedule is well-balanced with ${Math.round(unallocatedMinutes)} min of free buffer time.`
    });
  }

  return recommendations;
}

/**
 * Performs a comprehensive workload analysis for a day's schedule proposal.
 */
export function analyzeWorkload({
  targetDate,
  totalAvailableMinutes = 0,
  fixedCommitmentMinutes = 0,
  reservedBreakMinutes = 0,
  blocks = [],
  tasks = [],
  unscheduledTasks = []
}) {
  const dateStr = (targetDate || new Date().toISOString().split('T')[0]).trim();

  const taskBlocks = (blocks || []).filter(b => b.blockType === 'task');
  const scheduledWorkMinutes = taskBlocks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
  const unscheduledTaskMinutes = (unscheduledTasks || []).reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

  const flexibleCapacity = Math.max(0, totalAvailableMinutes - fixedCommitmentMinutes - reservedBreakMinutes);
  const unallocatedMinutes = Math.max(0, flexibleCapacity - scheduledWorkMinutes);

  const capacityUtilization = calculateWorkloadUtilization(
    scheduledWorkMinutes,
    totalAvailableMinutes,
    fixedCommitmentMinutes,
    reservedBreakMinutes
  );

  const classification = classifyWorkload(capacityUtilization);
  const cognitiveLoadScore = calculateCognitiveLoad(blocks, tasks);
  const fatigueRisk = assessFatigueRisk(capacityUtilization, cognitiveLoadScore);

  // Priority distribution
  const priorityDistribution = { urgent: 0, high: 0, medium: 0, low: 0 };
  const taskMap = new Map((tasks || []).map(t => [String(t.id), t]));
  for (const b of taskBlocks) {
    const t = taskMap.get(String(b.sourceEntityId));
    if (t) {
      const p = (t.priority || 'medium').toLowerCase();
      if (priorityDistribution[p] !== undefined) priorityDistribution[p]++;
    }
  }

  // Count back-to-back transitions
  const sorted = [...(blocks || [])]
    .filter(b => !b.deleted && b.startTime && b.endTime)
    .sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));

  let backToBackCount = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = timeStringToMinutes(sorted[i + 1].startTime) - timeStringToMinutes(sorted[i].endTime);
    if (gap >= 0 && gap < 10) backToBackCount++;
  }

  const recommendations = generateWorkloadRecommendations({
    classification,
    capacityUtilization,
    cognitiveLoadScore,
    fatigueRisk,
    unallocatedMinutes,
    unscheduledTasks,
    backToBackCount
  });

  let explanation = '';
  if (classification === WORKLOAD_CLASSIFICATIONS.OVERLOADED) {
    explanation = `Overloaded schedule: ${scheduledWorkMinutes}m planned exceeds flexible capacity of ${flexibleCapacity}m.`;
  } else if (classification === WORKLOAD_CLASSIFICATIONS.HEAVY) {
    explanation = `High intensity schedule: ${scheduledWorkMinutes}m planned (${Math.round(capacityUtilization * 100)}% capacity).`;
  } else if (classification === WORKLOAD_CLASSIFICATIONS.BALANCED) {
    explanation = `Balanced schedule: ${scheduledWorkMinutes}m planned with ${Math.round(unallocatedMinutes)}m remaining buffer.`;
  } else {
    explanation = `Light schedule: ${scheduledWorkMinutes}m planned (${Math.round(capacityUtilization * 100)}% capacity).`;
  }

  return {
    date: dateStr,
    totalAvailableMinutes,
    fixedCommitmentMinutes,
    scheduledWorkMinutes,
    breakMinutes: reservedBreakMinutes,
    unallocatedMinutes,
    unscheduledTaskMinutes,
    flexibleCapacity,
    capacityUtilization,
    classification,
    cognitiveLoadScore,
    fatigueRisk,
    explanation,
    priorityDistribution,
    recommendations
  };
}

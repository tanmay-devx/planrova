/**
 * shared/domain/finance/savings.engine.js
 * Savings Goal Intelligence & Feasibility Planning Engine for Planrova 2.0.
 *
 * Invariants:
 * 1. Remaining Amount = max(0, Target Amount - Current Amount).
 * 2. Feasibility estimates derive deterministically from remaining intervals and target dates.
 * 3. Never automatically transfer or move money; records user-approved contributions.
 */

import { daysBetween, parseDateParts, toMajorUnits } from './finance.utils.js';

/**
 * Evaluates savings goal metrics, progress, and contribution pacing.
 */
export function evaluateSavingsGoal(goal, referenceDateStr = null) {
  const refDate = referenceDateStr || new Date().toISOString().slice(0, 10);
  const targetMinor = goal.targetAmountMinor || 0;
  const currentMinor = goal.currentAmountMinor || 0;

  const remainingMinor = Math.max(0, targetMinor - currentMinor);
  const progressPercentage = targetMinor > 0
    ? Math.min(100, Math.round((currentMinor / targetMinor) * 10000) / 100)
    : 100;
  const isCompleted = currentMinor >= targetMinor && targetMinor > 0;

  let remainingDays = 0;
  let remainingMonths = 0;
  let remainingWeeks = 0;
  let isOverdue = false;
  let requiredPerMonthMinor = 0;
  let requiredPerWeekMinor = 0;
  const insights = [];

  if (goal.targetDate) {
    remainingDays = daysBetween(refDate, goal.targetDate);
    if (remainingDays < 0) {
      isOverdue = !isCompleted;
    } else {
      remainingWeeks = Math.max(1, Math.ceil(remainingDays / 7));
      remainingMonths = Math.max(1, Math.ceil(remainingDays / 30.4375)); // average month length
    }

    if (!isCompleted && !isOverdue && remainingMinor > 0) {
      requiredPerWeekMinor = Math.ceil(remainingMinor / remainingWeeks);
      requiredPerMonthMinor = Math.ceil(remainingMinor / remainingMonths);
      insights.push(`To reach target by ${goal.targetDate}, save approximately ${toMajorUnits(requiredPerMonthMinor)}/month (or ${toMajorUnits(requiredPerWeekMinor)}/week).`);
    } else if (isOverdue) {
      insights.push(`Target date of ${goal.targetDate} has passed with ${toMajorUnits(remainingMinor)} remaining.`);
    }
  }

  if (isCompleted) {
    insights.push(`Goal completed! ${toMajorUnits(currentMinor)} saved (${progressPercentage}%).`);
  } else {
    insights.push(`${progressPercentage}% completed with ${toMajorUnits(remainingMinor)} remaining.`);
  }

  return {
    goalId: goal.id,
    title: goal.title,
    targetAmountMinor: targetMinor,
    currentAmountMinor: currentMinor,
    remainingAmountMinor: remainingMinor,
    progressPercentage,
    isCompleted,
    isOverdue,
    targetDate: goal.targetDate,
    remainingDays,
    remainingWeeks,
    remainingMonths,
    requiredPerWeekMinor,
    requiredPerMonthMinor,
    contributionCount: Array.isArray(goal.contributions) ? goal.contributions.length : 0,
    insights
  };
}

/**
 * Records a contribution to a savings goal.
 */
export function recordSavingsContribution(goal, {
  amountMinor,
  date = new Date().toISOString().slice(0, 10),
  note = '',
  transactionId = null
} = {}) {
  if (!goal || !goal.id) {
    throw new Error('Valid savings goal entity required');
  }
  if (typeof amountMinor !== 'number' || !Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('amountMinor must be a positive integer');
  }

  const newCurrentMinor = (goal.currentAmountMinor || 0) + amountMinor;
  const isCompleted = newCurrentMinor >= (goal.targetAmountMinor || 0);
  const contributions = Array.isArray(goal.contributions) ? [...goal.contributions] : [];

  contributions.push({
    id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    amountMinor,
    date,
    note: (note || '').trim(),
    transactionId: transactionId || null,
    createdAt: new Date().toISOString()
  });

  return {
    ...goal,
    currentAmountMinor: newCurrentMinor,
    currentAmount: toMajorUnits(newCurrentMinor),
    isCompleted,
    contributions,
    updatedAt: new Date().toISOString()
  };
}


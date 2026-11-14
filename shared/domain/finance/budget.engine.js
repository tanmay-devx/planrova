/**
 * shared/domain/finance/budget.engine.js
 * Deterministic Budget Intelligence & Spending Forecast Engine for Planrova 2.0.
 *
 * Invariants:
 * 1. Authoritative calculations strictly in integer minor units.
 * 2. Deterministic, explainable forecasts distinguishing actual vs projected spending.
 * 3. Never invent financial advice or claim guaranteed predictions.
 */

import { BUDGET_STATUSES } from './finance.types.js';
import { isDateInRange, parseDateParts, getDaysInMonth, daysBetween } from './finance.utils.js';

/**
 * Computes the date bounds (startDate, endDate) for a budget period given a reference date.
 */
export function resolveBudgetPeriodBounds(period = 'monthly', referenceDateStr = null, customStart = null, customEnd = null) {
  if (period === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  const { year, month, day } = parseDateParts(referenceDateStr || new Date().toISOString().slice(0, 10));

  if (period === 'weekly') {
    // Current week starting on Monday
    const refDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = refDate.getUTCDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(Date.UTC(year, month - 1, day + diffToMonday));
    const sunday = new Date(Date.UTC(year, month - 1, day + diffToMonday + 6));
    
    const startStr = monday.toISOString().slice(0, 10);
    const endStr = sunday.toISOString().slice(0, 10);
    return { startDate: startStr, endDate: endStr };
  }

  // Default: monthly
  const totalDays = getDaysInMonth(year, month);
  const mStr = String(month).padStart(2, '0');
  return {
    startDate: `${year}-${mStr}-01`,
    endDate: `${year}-${mStr}-${String(totalDays).padStart(2, '0')}`
  };
}

/**
 * Evaluates budget performance against a list of transactions for a specific period.
 */
export function evaluateBudget(budget, transactions = [], referenceDateStr = null) {
  const refDate = referenceDateStr || new Date().toISOString().slice(0, 10);
  const { startDate, endDate } = resolveBudgetPeriodBounds(
    budget.period,
    refDate,
    budget.startDate,
    budget.endDate
  );

  const limitMinor = budget.limitMinor || 0;
  const alertThreshold = budget.alertThreshold !== undefined ? budget.alertThreshold : 80;

  // Filter relevant expense transactions within the period
  let totalSpentMinor = 0;
  const categorySpendingMap = new Map();

  for (const txn of transactions) {
    if (txn.deletedAt || txn.type !== 'expense') continue;
    if (budget.currency && txn.currency && txn.currency.toUpperCase() !== budget.currency.toUpperCase()) continue;
    if (!isDateInRange(txn.transactionDate, startDate, endDate)) continue;

    // If budget is category-specific, filter for matching category
    if (budget.categoryId && txn.categoryId !== budget.categoryId) continue;

    const amount = txn.isRefund ? -(txn.amountMinor || 0) : (txn.amountMinor || 0);
    totalSpentMinor += amount;

    // Track by category
    const catId = txn.categoryId || 'cat_other';
    categorySpendingMap.set(catId, (categorySpendingMap.get(catId) || 0) + amount);
  }

  // Prevent negative total spent
  totalSpentMinor = Math.max(0, totalSpentMinor);

  const remainingMinor = Math.max(0, limitMinor - totalSpentMinor);
  const overspentMinor = Math.max(0, totalSpentMinor - limitMinor);
  const utilizationPercentage = limitMinor > 0
    ? Math.round((totalSpentMinor / limitMinor) * 10000) / 100
    : 0;

  // Status classification
  let status = BUDGET_STATUSES.HEALTHY;
  if (totalSpentMinor > limitMinor) {
    status = BUDGET_STATUSES.EXCEEDED;
  } else if (utilizationPercentage >= alertThreshold) {
    status = BUDGET_STATUSES.APPROACHING_LIMIT;
  }

  // Daily average and projections
  const totalPeriodDays = Math.max(1, daysBetween(startDate, endDate) + 1);
  const elapsedDays = Math.max(1, Math.min(totalPeriodDays, daysBetween(startDate, refDate) + 1));
  const dailyAverageSpentMinor = Math.round(totalSpentMinor / elapsedDays);
  
  // Projected spending for whole period based on current rate
  const projectedSpentMinor = Math.round((totalSpentMinor / elapsedDays) * totalPeriodDays);
  const projectedOverspentMinor = Math.max(0, projectedSpentMinor - limitMinor);

  // Generate explainable insights
  const insights = [];
  if (status === BUDGET_STATUSES.EXCEEDED) {
    insights.push(`Budget exceeded by ${overspentMinor / 100} (${utilizationPercentage}% used).`);
  } else if (status === BUDGET_STATUSES.APPROACHING_LIMIT) {
    insights.push(`Approaching limit: ${utilizationPercentage}% used with ${remainingMinor / 100} remaining.`);
  } else {
    insights.push(`Spending on track: ${utilizationPercentage}% utilized with ${remainingMinor / 100} remaining.`);
  }

  if (elapsedDays >= 3 && projectedSpentMinor > limitMinor && status !== BUDGET_STATUSES.EXCEEDED) {
    insights.push(`At current rate of ${dailyAverageSpentMinor / 100}/day, projected total is ${projectedSpentMinor / 100}, which exceeds budget.`);
  }

  return {
    budgetId: budget.id,
    name: budget.name,
    categoryId: budget.categoryId,
    period: budget.period,
    startDate,
    endDate,
    limitMinor,
    totalSpentMinor,
    remainingMinor,
    overspentMinor,
    utilizationPercentage,
    status,
    alertThreshold,
    elapsedDays,
    totalPeriodDays,
    dailyAverageSpentMinor,
    projectedSpentMinor,
    projectedOverspentMinor,
    categoryBreakdown: Object.fromEntries(categorySpendingMap),
    insights
  };
}

/**
 * Evaluates multiple budgets and aggregates consolidated budget health.
 */
export function evaluateAllBudgets(budgets = [], transactions = [], referenceDateStr = null) {
  const evaluations = budgets.map(b => evaluateBudget(b, transactions, referenceDateStr));
  
  let totalLimitMinor = 0;
  let totalSpentMinor = 0;
  let healthyCount = 0;
  let approachingCount = 0;
  let exceededCount = 0;

  for (const ev of evaluations) {
    // Only aggregate overall budgets or category budgets to avoid double-counting if mixed
    if (!ev.categoryId) {
      totalLimitMinor += ev.limitMinor;
      totalSpentMinor += ev.totalSpentMinor;
    }
    if (ev.status === BUDGET_STATUSES.HEALTHY) healthyCount++;
    else if (ev.status === BUDGET_STATUSES.APPROACHING_LIMIT) approachingCount++;
    else if (ev.status === BUDGET_STATUSES.EXCEEDED) exceededCount++;
  }

  return {
    evaluations,
    totalLimitMinor,
    totalSpentMinor,
    totalRemainingMinor: Math.max(0, totalLimitMinor - totalSpentMinor),
    summary: {
      totalBudgets: budgets.length,
      healthyCount,
      approachingCount,
      exceededCount
    }
  };
}

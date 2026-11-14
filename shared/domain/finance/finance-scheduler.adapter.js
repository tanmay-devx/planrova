/**
 * shared/domain/finance/finance-scheduler.adapter.js
 * Adaptive Scheduling Adapter for Planrova 2.0 Finance Domain.
 *
 * Transforms upcoming bills, subscription reviews, and savings contributions
 * into canonical scheduling inputs for Phase 3's Adaptive Planning Engine.
 *
 * Invariants:
 * 1. Financial obligations generate candidate tasks with preserved deadlines.
 * 2. Never auto-initiates transactions or auto-pays obligations.
 * 3. Prevents duplicate task generation when linked tasks already exist.
 */

import { generateScheduleProposal } from '../scheduling/scheduling.engine.js';
import { getUpcomingRecurringOccurrences } from './recurring.engine.js';

/**
 * Transforms finance obligations into canonical scheduling inputs.
 */
export function transformFinanceEntitiesToSchedulingInputs({
  targetDateStr = new Date().toISOString().slice(0, 10),
  recurringPayments = [],
  subscriptions = [],
  savingsGoals = [],
  existingTasks = [],
  includeBillReminders = true,
  includeSubscriptionReviews = true,
  includeSavingsReminders = true
} = {}) {
  const flexibleTasks = [...(existingTasks || [])];
  const existingFinanceLinkIds = new Set(
    flexibleTasks.map(t => t.linkedFinanceId || t.sourceEntityId).filter(Boolean)
  );

  // 1. Upcoming Bill Payments due on or before target date (active & unpaid)
  if (includeBillReminders) {
    const upcomingBills = getUpcomingRecurringOccurrences(recurringPayments, {
      startDate: targetDateStr,
      endDate: targetDateStr
    });

    for (const bill of upcomingBills) {
      const linkId = `bill_${bill.recurringPaymentId}_${bill.dueDate}`;
      if (!existingFinanceLinkIds.has(linkId)) {
        flexibleTasks.push({
          id: `task_${linkId}`,
          title: `Pay Bill: ${bill.title} (${bill.currency} ${bill.amount})`,
          estimatedMinutes: 15,
          priority: 'high',
          dueDate: bill.dueDate,
          type: 'finance_bill',
          linkedFinanceId: linkId,
          sourceDomain: 'finance',
          isFixed: false
        });
        existingFinanceLinkIds.add(linkId);
      }
    }
  }

  // 2. Subscriptions due for renewal review (e.g. renewal within next 3 days)
  if (includeSubscriptionReviews) {
    for (const sub of subscriptions) {
      if (sub.renewalStatus !== 'active') continue;
      if (sub.nextBillingDate === targetDateStr) {
        const linkId = `sub_review_${sub.id}_${sub.nextBillingDate}`;
        if (!existingFinanceLinkIds.has(linkId)) {
          flexibleTasks.push({
            id: `task_${linkId}`,
            title: `Review Subscription: ${sub.serviceName} (${sub.currency} ${sub.amount})`,
            estimatedMinutes: 15,
            priority: 'medium',
            dueDate: sub.nextBillingDate,
            type: 'subscription_review',
            linkedFinanceId: linkId,
            sourceDomain: 'finance',
            isFixed: false
          });
          existingFinanceLinkIds.add(linkId);
        }
      }
    }
  }

  // 3. Savings Goal periodic contribution reminders
  if (includeSavingsReminders) {
    for (const goal of savingsGoals) {
      if (goal.isCompleted) continue;
      // If goal has an active target date in the future
      if (goal.targetDate && goal.targetDate >= targetDateStr) {
        const linkId = `savings_${goal.id}_${targetDateStr}`;
        // Add contribution reminder if adhoc or user scheduled
        if (!existingFinanceLinkIds.has(linkId) && goal.remainingAmountMinor > 0) {
          // Check if monthly contribution day (e.g. 1st of month)
          const isMonthStart = targetDateStr.endsWith('-01');
          if (isMonthStart) {
            flexibleTasks.push({
              id: `task_${linkId}`,
              title: `Monthly Savings: ${goal.title}`,
              estimatedMinutes: 15,
              priority: 'medium',
              dueDate: targetDateStr,
              type: 'savings_contribution',
              linkedFinanceId: linkId,
              sourceDomain: 'finance',
              isFixed: false
            });
            existingFinanceLinkIds.add(linkId);
          }
        }
      }
    }
  }

  return {
    tasks: flexibleTasks
  };
}

/**
 * Generates an adaptive schedule proposal incorporating financial tasks.
 */
export function generateFinanceAwareScheduleProposal({
  targetDateStr = new Date().toISOString().slice(0, 10),
  fixedEvents = [],
  existingTasks = [],
  recurringPayments = [],
  subscriptions = [],
  savingsGoals = [],
  availabilityConfig = null,
  userAvailability = null,
  options = {}
} = {}) {
  const { tasks } = transformFinanceEntitiesToSchedulingInputs({
    targetDateStr,
    recurringPayments,
    subscriptions,
    savingsGoals,
    existingTasks
  });

  return generateScheduleProposal({
    targetDate: targetDateStr,
    fixedEvents,
    tasks,
    userAvailability: userAvailability || availabilityConfig || {},
    ...options
  });
}

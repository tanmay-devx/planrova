/**
 * shared/domain/finance/recurring.engine.js
 * Recurring Payments & Subscriptions Engine for Planrova 2.0.
 *
 * Invariants:
 * 1. A recurring payment represents an expected obligation, NEVER an auto-completed expense.
 * 2. Occurrence generation is idempotent and handles month-end & leap-year boundaries cleanly.
 * 3. Payment confirmation requires explicit user action to create transactions and advance recurrence.
 */

import { calculateNextDueDate, isDateInRange } from './finance.utils.js';
import { createTransaction } from './transaction.engine.js';

/**
 * Calculates upcoming occurrences for active recurring payments within a lookahead date range.
 * Does NOT generate transactions; returns projected schedule obligations.
 */
export function getUpcomingRecurringOccurrences(recurringPayments = [], {
  startDate = new Date().toISOString().slice(0, 10),
  endDate = null,
  lookaheadDays = 30
} = {}) {
  const resolvedEnd = endDate || calculateNextDueDate(startDate, 'custom', lookaheadDays);
  const occurrences = [];

  for (const item of recurringPayments) {
    if (!item.isActive) continue;
    if (item.endDate && item.endDate < startDate) continue;

    let currentDue = item.nextDueDate || item.startDate;

    // Advance if currentDue is in the past relative to startDate, but don't exceed end limits
    while (currentDue <= resolvedEnd) {
      if (item.endDate && currentDue > item.endDate) break;

      if (currentDue >= startDate) {
        occurrences.push({
          recurringPaymentId: item.id,
          title: item.title,
          amountMinor: item.amountMinor,
          amount: item.amount,
          currency: item.currency,
          categoryId: item.categoryId,
          accountId: item.accountId,
          dueDate: currentDue,
          reminderEnabled: item.reminderEnabled,
          linkedTaskId: item.linkedTaskId,
          frequency: item.frequency
        });
      }

      // Calculate next due date
      const nextDue = calculateNextDueDate(item.startDate, item.frequency, item.interval, currentDue);
      if (nextDue <= currentDue) break; // Safeguard against infinite loops
      currentDue = nextDue;
    }
  }

  // Sort chronologically
  occurrences.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return occurrences;
}

/**
 * Marks a recurring payment occurrence as paid.
 * Invariant: Creates a corresponding verified transaction, records payment history, and advances nextDueDate.
 */
export function recordRecurringPaymentPaid(recurringPayment, {
  paidDate = new Date().toISOString().slice(0, 10),
  amountMinor = null,
  accountId = null,
  paymentMethod = 'bank',
  userId = 'local'
} = {}) {
  if (!recurringPayment || !recurringPayment.id) {
    throw new Error('Valid recurring payment entity required');
  }

  const finalAmountMinor = amountMinor !== null ? amountMinor : recurringPayment.amountMinor;
  const finalAccountId = accountId || recurringPayment.accountId;
  const periodDueDate = recurringPayment.nextDueDate || recurringPayment.startDate;

  // Check if this occurrence was already recorded (idempotency check)
  const history = Array.isArray(recurringPayment.paymentHistory) ? [...recurringPayment.paymentHistory] : [];
  const alreadyPaid = history.some(h => h.periodDueDate === periodDueDate);
  if (alreadyPaid) {
    throw new Error(`Occurrence for due date ${periodDueDate} has already been marked as paid.`);
  }

  // Create real expense transaction
  const idempotencyKey = `rec_pay_${recurringPayment.id}_${periodDueDate}`;
  const transaction = createTransaction({
    userId,
    accountId: finalAccountId,
    type: 'expense',
    amountMinor: finalAmountMinor,
    currency: recurringPayment.currency,
    categoryId: recurringPayment.categoryId,
    title: recurringPayment.title,
    description: `Recurring payment for ${periodDueDate}`,
    transactionDate: paidDate,
    paymentMethod,
    recurringPaymentId: recurringPayment.id,
    idempotencyKey
  }, userId);

  // Advance nextDueDate
  const nextDueDate = calculateNextDueDate(
    recurringPayment.startDate,
    recurringPayment.frequency,
    recurringPayment.interval,
    periodDueDate
  );

  // Check if recurrence reached its endDate
  let isActive = recurringPayment.isActive;
  if (recurringPayment.endDate && nextDueDate > recurringPayment.endDate) {
    isActive = false;
  }

  const updatedRecurring = {
    ...recurringPayment,
    nextDueDate,
    lastPaymentDate: paidDate,
    isActive,
    paymentHistory: [
      ...history,
      {
        paidDate,
        amountMinor: finalAmountMinor,
        transactionId: transaction.id,
        periodDueDate
      }
    ],
    updatedAt: new Date().toISOString()
  };

  return {
    updatedRecurring,
    transaction
  };
}

/**
 * Pauses a recurring payment.
 */
export function pauseRecurringPayment(recurringPayment) {
  return {
    ...recurringPayment,
    isActive: false,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Resumes a paused recurring payment.
 */
export function resumeRecurringPayment(recurringPayment) {
  return {
    ...recurringPayment,
    isActive: true,
    updatedAt: new Date().toISOString()
  };
}


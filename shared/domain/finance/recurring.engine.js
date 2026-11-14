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
 * Supports recoverable idempotency and partial-failure reconciliation.
 */
export function recordRecurringPaymentPaid(recurringPayment, {
  paidDate = new Date().toISOString().slice(0, 10),
  periodDueDate: explicitPeriodDueDate = null,
  amountMinor = null,
  accountId = null,
  paymentMethod = 'bank',
  userId = 'local',
  existingTransactions = [],
  allowIdempotentReplay = false
} = {}) {
  if (!recurringPayment || !recurringPayment.id) {
    throw new Error('Valid recurring payment entity required');
  }

  const finalAmountMinor = amountMinor !== null ? amountMinor : recurringPayment.amountMinor;
  const finalAccountId = accountId || recurringPayment.accountId;
  const periodDueDate = explicitPeriodDueDate || recurringPayment.nextDueDate || recurringPayment.startDate;
  const idempotencyKey = `rec_pay_${recurringPayment.id}_${periodDueDate}`;

  // Check if this occurrence was already recorded in recurring payment history
  const history = Array.isArray(recurringPayment.paymentHistory) ? [...recurringPayment.paymentHistory] : [];
  const existingHistoryEntry = history.find(h => h.periodDueDate === periodDueDate);
  const alreadyPaid = Boolean(existingHistoryEntry);

  // Check if a transaction for this exact occurrence already exists in transaction ledger
  const existingTxn = existingTransactions.find(t => 
    !t.deletedAt && (t.idempotencyKey === idempotencyKey || (t.recurringPaymentId === recurringPayment.id && t.description?.includes(periodDueDate)))
  );

  if (alreadyPaid) {
    if (allowIdempotentReplay) {
      return {
        updatedRecurring: recurringPayment,
        transaction: existingTxn || null,
        isIdempotentReplay: true
      };
    }
    throw new Error(`Occurrence for due date ${periodDueDate} has already been marked as paid.`);
  }

  // Interrupted failure recovery: Transaction was created in a previous attempt, but due date was not advanced
  let transaction = existingTxn;
  let wasRecovered = false;

  if (!transaction) {
    // Create new transaction
    transaction = createTransaction({
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
  } else {
    wasRecovered = true;
  }

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
    transaction,
    recovered: wasRecovered,
    isIdempotentReplay: false
  };
}

/**
 * Reconciles recurring payment state against the actual transaction ledger.
 * Resolves discrepancies caused by crash/interruption:
 * 1. Transaction was recorded, but nextDueDate was not advanced.
 * 2. Payment occurrence was reversed/soft-deleted, allowing nextDueDate to roll back.
 */
export function reconcileRecurringPaymentState(recurringPayment, existingTransactions = []) {
  if (!recurringPayment || !recurringPayment.id) return recurringPayment;

  const activeTxns = existingTransactions.filter(t => !t.deletedAt && t.recurringPaymentId === recurringPayment.id);
  const deletedTxns = existingTransactions.filter(t => t.deletedAt && t.recurringPaymentId === recurringPayment.id);

  let updatedRecurring = { ...recurringPayment };
  let history = Array.isArray(recurringPayment.paymentHistory) ? [...recurringPayment.paymentHistory] : [];
  let modified = false;

  // 1. Check for transactions that exist but are missing in paymentHistory
  for (const txn of activeTxns) {
    const isRecorded = history.some(h => h.transactionId === txn.id || (txn.idempotencyKey && txn.idempotencyKey.endsWith(h.periodDueDate)));
    if (!isRecorded) {
      // Extract periodDueDate from idempotency key or description
      const match = txn.idempotencyKey?.match(/rec_pay_.*_(\d{4}-\d{2}-\d{2})/);
      const periodDueDate = match ? match[1] : txn.transactionDate;

      history.push({
        paidDate: txn.transactionDate,
        amountMinor: txn.amountMinor,
        transactionId: txn.id,
        periodDueDate
      });

      // If nextDueDate is still at or before this period, advance it
      if (!updatedRecurring.nextDueDate || updatedRecurring.nextDueDate <= periodDueDate) {
        updatedRecurring.nextDueDate = calculateNextDueDate(
          updatedRecurring.startDate,
          updatedRecurring.frequency,
          updatedRecurring.interval,
          periodDueDate
        );
      }
      modified = true;
    }
  }

  // 2. Check for soft-deleted transactions in history: remove them and roll back nextDueDate if applicable
  const validHistory = [];
  for (const entry of history) {
    const isDeleted = deletedTxns.some(t => t.id === entry.transactionId);
    if (isDeleted) {
      modified = true;
      // If the latest occurrence was reversed, roll back nextDueDate to this entry's periodDueDate
      if (updatedRecurring.nextDueDate && updatedRecurring.nextDueDate > entry.periodDueDate) {
        updatedRecurring.nextDueDate = entry.periodDueDate;
      }
    } else {
      validHistory.push(entry);
    }
  }

  if (modified) {
    updatedRecurring.paymentHistory = validHistory;
    updatedRecurring.updatedAt = new Date().toISOString();
  }

  return updatedRecurring;
}

/**
 * Explicitly reverses a paid recurring occurrence (e.g. user refund/cancellation).
 * Soft-deletes the linked transaction and rolls back nextDueDate to the reversed period.
 */
export function reverseRecurringPaymentOccurrence(recurringPayment, periodDueDate, existingTransactions = []) {
  if (!recurringPayment || !recurringPayment.id) {
    throw new Error('Valid recurring payment entity required');
  }

  const history = Array.isArray(recurringPayment.paymentHistory) ? [...recurringPayment.paymentHistory] : [];
  const entryIndex = history.findIndex(h => h.periodDueDate === periodDueDate);
  if (entryIndex === -1) {
    throw new Error(`Occurrence for period ${periodDueDate} not found in payment history.`);
  }

  const entry = history[entryIndex];
  history.splice(entryIndex, 1);

  // Soft-delete corresponding transaction if found
  let reversedTxn = null;
  const txn = existingTransactions.find(t => t.id === entry.transactionId);
  if (txn) {
    reversedTxn = {
      ...txn,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Roll back nextDueDate to this period if it was advanced beyond it
  let nextDueDate = recurringPayment.nextDueDate;
  if (!nextDueDate || nextDueDate > periodDueDate) {
    nextDueDate = periodDueDate;
  }

  const updatedRecurring = {
    ...recurringPayment,
    nextDueDate,
    paymentHistory: history,
    updatedAt: new Date().toISOString()
  };

  return {
    updatedRecurring,
    reversedTransaction: reversedTxn
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


/**
 * shared/domain/finance/finance.schemas.js
 * Canonical Schemas & Normalizers for Planrova 2.0 Finance Domain.
 */

import {
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  BUDGET_PERIODS,
  RECURRING_FREQUENCIES,
  SAVINGS_PRIORITIES,
  CONTRIBUTION_FREQUENCIES
} from './finance.types.js';
import { toMinorUnits, toMajorUnits } from './finance.utils.js';

/**
 * Normalizes a FinancialAccount entity.
 */
export function normalizeFinancialAccount(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  const id = raw.id || `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const accountType = ACCOUNT_TYPES.includes(raw.accountType) ? raw.accountType : 'bank';
  const currency = (raw.currency || 'INR').toUpperCase();

  let openingBalanceMinor = 0;
  if (typeof raw.openingBalanceMinor === 'number' && Number.isInteger(raw.openingBalanceMinor)) {
    openingBalanceMinor = raw.openingBalanceMinor;
  } else if (raw.openingBalance !== undefined) {
    openingBalanceMinor = toMinorUnits(raw.openingBalance);
  }

  let currentBalanceMinor = openingBalanceMinor;
  if (typeof raw.currentBalanceMinor === 'number' && Number.isInteger(raw.currentBalanceMinor)) {
    currentBalanceMinor = raw.currentBalanceMinor;
  } else if (raw.currentBalance !== undefined) {
    currentBalanceMinor = toMinorUnits(raw.currentBalance);
  }

  return {
    id,
    userId: raw.userId || userId,
    name: (raw.name || 'Main Account').trim(),
    accountType,
    currency,
    openingBalanceMinor,
    currentBalanceMinor,
    // Derived major unit helpers for convenience
    openingBalance: toMajorUnits(openingBalanceMinor),
    currentBalance: toMajorUnits(currentBalanceMinor),
    isArchived: Boolean(raw.isArchived),
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}

/**
 * Normalizes a Transaction entity (Income, Expense, Transfer).
 */
export function normalizeTransaction(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  const id = raw.id || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const type = TRANSACTION_TYPES.includes(raw.type) ? raw.type : 'expense';
  const currency = (raw.currency || 'INR').toUpperCase();

  let amountMinor = 0;
  if (typeof raw.amountMinor === 'number' && Number.isInteger(raw.amountMinor)) {
    amountMinor = Math.abs(raw.amountMinor);
  } else if (raw.amount !== undefined) {
    amountMinor = Math.abs(toMinorUnits(raw.amount));
  } else if (raw.amount_minor !== undefined) {
    amountMinor = Math.abs(parseInt(raw.amount_minor, 10) || 0);
  }

  const transactionDate = raw.transactionDate || raw.date || now.slice(0, 10);
  const title = (raw.title || raw.description || raw.desc || 'Transaction').trim();
  const description = (raw.description || raw.notes || '').trim();

  return {
    id,
    userId: raw.userId || userId,
    accountId: raw.accountId || null,
    toAccountId: type === 'transfer' ? (raw.toAccountId || null) : null,
    type,
    amountMinor,
    // Backwards-compatible decimal amount
    amount: toMajorUnits(amountMinor),
    currency,
    categoryId: raw.categoryId || raw.category || 'cat_other',
    title,
    description,
    transactionDate,
    paymentMethod: raw.paymentMethod || 'cash',
    tags: Array.isArray(raw.tags) ? [...raw.tags] : [],
    recurringPaymentId: raw.recurringPaymentId || null,
    notes: (raw.notes || '').trim(),
    idempotencyKey: raw.idempotencyKey || null,
    isRefund: Boolean(raw.isRefund),
    createdAt: raw.createdAt || now,
    updatedAt: now,
    deletedAt: raw.deletedAt || null
  };
}

/**
 * Normalizes a Budget entity.
 */
export function normalizeBudget(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  const id = raw.id || `bgt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const period = BUDGET_PERIODS.includes(raw.period) ? raw.period : 'monthly';
  const currency = (raw.currency || 'INR').toUpperCase();

  let limitMinor = 0;
  if (typeof raw.limitMinor === 'number' && Number.isInteger(raw.limitMinor)) {
    limitMinor = Math.abs(raw.limitMinor);
  } else if (raw.monthlyLimit !== undefined) {
    limitMinor = Math.abs(toMinorUnits(raw.monthlyLimit));
  } else if (raw.limit !== undefined) {
    limitMinor = Math.abs(toMinorUnits(raw.limit));
  }

  const alertThreshold = typeof raw.alertThreshold === 'number' && raw.alertThreshold >= 0 && raw.alertThreshold <= 100
    ? raw.alertThreshold
    : 80;

  return {
    id,
    userId: raw.userId || userId,
    name: (raw.name || 'Monthly Budget').trim(),
    categoryId: raw.categoryId || null, // null = overall budget
    period,
    limitMinor,
    limit: toMajorUnits(limitMinor),
    currency,
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    rolloverEnabled: Boolean(raw.rolloverEnabled),
    alertThreshold,
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}

/**
 * Normalizes a RecurringPayment entity.
 */
export function normalizeRecurringPayment(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  const id = raw.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const frequency = RECURRING_FREQUENCIES.includes(raw.frequency) ? raw.frequency : 'monthly';
  const interval = Math.max(1, parseInt(raw.interval, 10) || 1);
  const currency = (raw.currency || 'INR').toUpperCase();

  let amountMinor = 0;
  if (typeof raw.amountMinor === 'number' && Number.isInteger(raw.amountMinor)) {
    amountMinor = Math.abs(raw.amountMinor);
  } else if (raw.amount !== undefined) {
    amountMinor = Math.abs(toMinorUnits(raw.amount));
  }

  const startDate = raw.startDate || now.slice(0, 10);
  const nextDueDate = raw.nextDueDate || startDate;

  return {
    id,
    userId: raw.userId || userId,
    title: (raw.title || 'Recurring Bill').trim(),
    amountMinor,
    amount: toMajorUnits(amountMinor),
    currency,
    categoryId: raw.categoryId || 'cat_bills',
    accountId: raw.accountId || null,
    frequency,
    interval,
    startDate,
    endDate: raw.endDate || null,
    nextDueDate,
    reminderEnabled: raw.reminderEnabled !== undefined ? Boolean(raw.reminderEnabled) : true,
    linkedTaskId: raw.linkedTaskId || null,
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    lastPaymentDate: raw.lastPaymentDate || null,
    paymentHistory: Array.isArray(raw.paymentHistory) ? [...raw.paymentHistory] : [],
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}

/**
 * Normalizes a Subscription entity.
 */
export function normalizeSubscription(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  const id = raw.id || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const currency = (raw.currency || 'INR').toUpperCase();

  let amountMinor = 0;
  if (typeof raw.amountMinor === 'number' && Number.isInteger(raw.amountMinor)) {
    amountMinor = Math.abs(raw.amountMinor);
  } else if (raw.amount !== undefined) {
    amountMinor = Math.abs(toMinorUnits(raw.amount));
  }

  return {
    id,
    userId: raw.userId || userId,
    serviceName: (raw.serviceName || raw.title || 'Subscription').trim(),
    amountMinor,
    amount: toMajorUnits(amountMinor),
    currency,
    billingFrequency: RECURRING_FREQUENCIES.includes(raw.billingFrequency) ? raw.billingFrequency : 'monthly',
    nextBillingDate: raw.nextBillingDate || raw.nextDueDate || now.slice(0, 10),
    categoryId: raw.categoryId || 'cat_bills',
    renewalStatus: ['active', 'paused', 'cancelled'].includes(raw.renewalStatus) ? raw.renewalStatus : 'active',
    reminderPreferences: raw.reminderPreferences || { daysBefore: 3, enabled: true },
    linkedRecurringPaymentId: raw.linkedRecurringPaymentId || null,
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}

/**
 * Normalizes a SavingsGoal entity.
 */
export function normalizeSavingsGoal(raw = {}, userId = 'local') {
  const now = new Date().toISOString();
  const id = raw.id || `svg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const currency = (raw.currency || 'INR').toUpperCase();

  let targetAmountMinor = 0;
  if (typeof raw.targetAmountMinor === 'number' && Number.isInteger(raw.targetAmountMinor)) {
    targetAmountMinor = Math.abs(raw.targetAmountMinor);
  } else if (raw.targetAmount !== undefined || raw.savingsGoalTarget !== undefined) {
    targetAmountMinor = Math.abs(toMinorUnits(raw.targetAmount ?? raw.savingsGoalTarget));
  }

  let currentAmountMinor = 0;
  if (typeof raw.currentAmountMinor === 'number' && Number.isInteger(raw.currentAmountMinor)) {
    currentAmountMinor = Math.abs(raw.currentAmountMinor);
  } else if (raw.currentAmount !== undefined || raw.savingsGoalCurrent !== undefined) {
    currentAmountMinor = Math.abs(toMinorUnits(raw.currentAmount ?? raw.savingsGoalCurrent));
  }

  const priority = SAVINGS_PRIORITIES.includes(raw.priority) ? raw.priority : 'medium';
  const contributionFrequency = CONTRIBUTION_FREQUENCIES.includes(raw.contributionFrequency) ? raw.contributionFrequency : 'monthly';

  return {
    id,
    userId: raw.userId || userId,
    title: (raw.title || raw.savingsGoalName || 'Savings Goal').trim(),
    targetAmountMinor,
    currentAmountMinor,
    targetAmount: toMajorUnits(targetAmountMinor),
    currentAmount: toMajorUnits(currentAmountMinor),
    currency,
    targetDate: raw.targetDate || null,
    priority,
    linkedAccountId: raw.linkedAccountId || null,
    contributionFrequency,
    isCompleted: Boolean(raw.isCompleted) || (targetAmountMinor > 0 && currentAmountMinor >= targetAmountMinor),
    contributions: Array.isArray(raw.contributions) ? [...raw.contributions] : [],
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}


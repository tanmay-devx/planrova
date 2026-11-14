/**
 * shared/domain/finance/finance.validation.js
 * Validation logic for Planrova 2.0 Finance Entities.
 */

import {
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  BUDGET_PERIODS,
  RECURRING_FREQUENCIES,
  SAVINGS_PRIORITIES,
  CONTRIBUTION_FREQUENCIES
} from './finance.types.js';

export function validateFinancialAccount(account) {
  const errors = [];
  if (!account || typeof account !== 'object') {
    return { valid: false, errors: ['FinancialAccount must be an object'] };
  }
  if (!account.id || typeof account.id !== 'string') {
    errors.push('id is required and must be a string');
  }
  if (!account.userId || typeof account.userId !== 'string') {
    errors.push('userId is required and must be a string');
  }
  if (!account.name || typeof account.name !== 'string' || !account.name.trim()) {
    errors.push('name is required and cannot be empty');
  }
  if (!ACCOUNT_TYPES.includes(account.accountType)) {
    errors.push(`accountType must be one of: ${ACCOUNT_TYPES.join(', ')}`);
  }
  if (!account.currency || typeof account.currency !== 'string') {
    errors.push('currency is required');
  }
  if (typeof account.openingBalanceMinor !== 'number' || !Number.isInteger(account.openingBalanceMinor)) {
    errors.push('openingBalanceMinor must be an integer');
  }
  return { valid: errors.length === 0, errors };
}

export function validateTransaction(txn) {
  const errors = [];
  if (!txn || typeof txn !== 'object') {
    return { valid: false, errors: ['Transaction must be an object'] };
  }
  if (!txn.id || typeof txn.id !== 'string') {
    errors.push('id is required');
  }
  if (!txn.userId || typeof txn.userId !== 'string') {
    errors.push('userId is required');
  }
  if (!TRANSACTION_TYPES.includes(txn.type)) {
    errors.push(`type must be one of: ${TRANSACTION_TYPES.join(', ')}`);
  }
  if (typeof txn.amountMinor !== 'number' || !Number.isInteger(txn.amountMinor) || txn.amountMinor <= 0) {
    errors.push('amountMinor must be a positive integer');
  }
  if (!txn.currency || typeof txn.currency !== 'string') {
    errors.push('currency is required');
  }
  if (!txn.transactionDate || !/^\d{4}-\d{2}-\d{2}/.test(txn.transactionDate)) {
    errors.push('transactionDate must be in YYYY-MM-DD format');
  }
  if (txn.type === 'transfer' && txn.accountId && txn.toAccountId && txn.accountId === txn.toAccountId) {
    errors.push('Transfer source and destination accounts must be different');
  }
  return { valid: errors.length === 0, errors };
}

export function validateBudget(budget) {
  const errors = [];
  if (!budget || typeof budget !== 'object') {
    return { valid: false, errors: ['Budget must be an object'] };
  }
  if (!budget.id || typeof budget.id !== 'string') {
    errors.push('id is required');
  }
  if (!budget.userId || typeof budget.userId !== 'string') {
    errors.push('userId is required');
  }
  if (!BUDGET_PERIODS.includes(budget.period)) {
    errors.push(`period must be one of: ${BUDGET_PERIODS.join(', ')}`);
  }
  if (typeof budget.limitMinor !== 'number' || !Number.isInteger(budget.limitMinor) || budget.limitMinor <= 0) {
    errors.push('limitMinor must be a positive integer');
  }
  if (budget.startDate && !/^\d{4}-\d{2}-\d{2}/.test(budget.startDate)) {
    errors.push('startDate must be in YYYY-MM-DD format');
  }
  if (budget.endDate && !/^\d{4}-\d{2}-\d{2}/.test(budget.endDate)) {
    errors.push('endDate must be in YYYY-MM-DD format');
  }
  if (budget.startDate && budget.endDate && budget.startDate > budget.endDate) {
    errors.push('startDate cannot be after endDate');
  }
  return { valid: errors.length === 0, errors };
}

export function validateRecurringPayment(rec) {
  const errors = [];
  if (!rec || typeof rec !== 'object') {
    return { valid: false, errors: ['RecurringPayment must be an object'] };
  }
  if (!rec.id || typeof rec.id !== 'string') {
    errors.push('id is required');
  }
  if (!rec.userId || typeof rec.userId !== 'string') {
    errors.push('userId is required');
  }
  if (!rec.title || !rec.title.trim()) {
    errors.push('title is required');
  }
  if (typeof rec.amountMinor !== 'number' || !Number.isInteger(rec.amountMinor) || rec.amountMinor <= 0) {
    errors.push('amountMinor must be a positive integer');
  }
  if (!RECURRING_FREQUENCIES.includes(rec.frequency)) {
    errors.push(`frequency must be one of: ${RECURRING_FREQUENCIES.join(', ')}`);
  }
  if (rec.startDate && !/^\d{4}-\d{2}-\d{2}/.test(rec.startDate)) {
    errors.push('startDate must be in YYYY-MM-DD format');
  }
  if (rec.nextDueDate && !/^\d{4}-\d{2}-\d{2}/.test(rec.nextDueDate)) {
    errors.push('nextDueDate must be in YYYY-MM-DD format');
  }
  return { valid: errors.length === 0, errors };
}

export function validateSubscription(sub) {
  const errors = [];
  if (!sub || typeof sub !== 'object') {
    return { valid: false, errors: ['Subscription must be an object'] };
  }
  if (!sub.id || typeof sub.id !== 'string') {
    errors.push('id is required');
  }
  if (!sub.serviceName || !sub.serviceName.trim()) {
    errors.push('serviceName is required');
  }
  if (typeof sub.amountMinor !== 'number' || !Number.isInteger(sub.amountMinor) || sub.amountMinor < 0) {
    errors.push('amountMinor must be a non-negative integer');
  }
  return { valid: errors.length === 0, errors };
}

export function validateSavingsGoal(goal) {
  const errors = [];
  if (!goal || typeof goal !== 'object') {
    return { valid: false, errors: ['SavingsGoal must be an object'] };
  }
  if (!goal.id || typeof goal.id !== 'string') {
    errors.push('id is required');
  }
  if (!goal.title || !goal.title.trim()) {
    errors.push('title is required');
  }
  if (typeof goal.targetAmountMinor !== 'number' || !Number.isInteger(goal.targetAmountMinor) || goal.targetAmountMinor <= 0) {
    errors.push('targetAmountMinor must be a positive integer');
  }
  if (typeof goal.currentAmountMinor !== 'number' || !Number.isInteger(goal.currentAmountMinor) || goal.currentAmountMinor < 0) {
    errors.push('currentAmountMinor must be a non-negative integer');
  }
  if (goal.priority && !SAVINGS_PRIORITIES.includes(goal.priority)) {
    errors.push(`priority must be one of: ${SAVINGS_PRIORITIES.join(', ')}`);
  }
  if (goal.contributionFrequency && !CONTRIBUTION_FREQUENCIES.includes(goal.contributionFrequency)) {
    errors.push(`contributionFrequency must be one of: ${CONTRIBUTION_FREQUENCIES.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}


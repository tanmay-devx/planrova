/**
 * shared/domain/finance/finance.types.js
 * Canonical Finance Types, Constants, and Enums for Planrova 2.0
 */

export const ACCOUNT_TYPES = Object.freeze([
  'cash',
  'bank',
  'savings',
  'digital_wallet',
  'other'
]);

export const TRANSACTION_TYPES = Object.freeze([
  'income',
  'expense',
  'transfer'
]);

export const BUDGET_PERIODS = Object.freeze([
  'monthly',
  'weekly',
  'custom'
]);

export const BUDGET_STATUSES = Object.freeze({
  HEALTHY: 'healthy',
  APPROACHING_LIMIT: 'approaching_limit',
  EXCEEDED: 'exceeded'
});

export const RECURRING_FREQUENCIES = Object.freeze([
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'custom'
]);

export const DEFAULT_FINANCIAL_CATEGORIES = Object.freeze([
  { id: 'cat_food', name: 'Food', icon: '🍽️', color: '#10B981' },
  { id: 'cat_transport', name: 'Transport', icon: '🚗', color: '#3B82F6' },
  { id: 'cat_education', name: 'Education', icon: '📚', color: '#8B5CF6' },
  { id: 'cat_shopping', name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { id: 'cat_entertainment', name: 'Entertainment', icon: '🎬', color: '#F59E0B' },
  { id: 'cat_health', name: 'Health', icon: '🏥', color: '#EF4444' },
  { id: 'cat_bills', name: 'Bills', icon: '📄', color: '#6366F1' },
  { id: 'cat_housing', name: 'Housing', icon: '🏠', color: '#14B8A6' },
  { id: 'cat_savings', name: 'Savings', icon: '💰', color: '#84CC16' },
  { id: 'cat_other', name: 'Other', icon: '🏷️', color: '#6B7280' }
]);

export const SAVINGS_PRIORITIES = Object.freeze([
  'low',
  'medium',
  'high',
  'critical'
]);

export const CONTRIBUTION_FREQUENCIES = Object.freeze([
  'weekly',
  'monthly',
  'quarterly',
  'adhoc'
]);

export const FINANCE_STORAGE_KEYS = Object.freeze({
  ACCOUNTS: 'finance_accounts',
  TRANSACTIONS: 'finance_transactions',
  BUDGETS: 'finance_budgets',
  RECURRING_PAYMENTS: 'finance_recurring_payments',
  SUBSCRIPTIONS: 'finance_subscriptions',
  SAVINGS_GOALS: 'finance_savings_goals',
  CATEGORIES: 'finance_categories'
});


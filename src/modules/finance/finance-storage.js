/**
 * src/modules/finance/finance-storage.js
 * Scoped Local-First Storage & Migration Adapter for Planrova 2.0 Finance Domain.
 *
 * Invariants:
 * 1. Storage operations use scoped keys through Planrova's unified storage layer.
 * 2. Migrations are idempotent and never overwrite valid historical data.
 */

import { getStorageItem, setStorageItem } from '../../utils/storage.js';
import { FINANCE_STORAGE_KEYS } from '../../../shared/domain/finance/finance.types.js';
import {
  normalizeFinancialAccount,
  normalizeTransaction,
  normalizeBudget,
  normalizeRecurringPayment,
  normalizeSubscription,
  normalizeSavingsGoal
} from '../../../shared/domain/finance/finance.schemas.js';
import { reconcileAccountBalances } from '../../../shared/domain/finance/transaction.engine.js';
import { toMinorUnits } from '../../../shared/domain/finance/finance.utils.js';

// ── ACCOUNTS ──────────────────────────────────────────────────────
export function getStoredAccounts() {
  const raw = getStorageItem(FINANCE_STORAGE_KEYS.ACCOUNTS, []);
  if (!Array.isArray(raw) || raw.length === 0) {
    // Default account if none exist
    const defaultAccount = normalizeFinancialAccount({
      id: 'acc_main',
      name: 'Main Wallet',
      accountType: 'cash',
      currency: 'INR',
      openingBalanceMinor: 0
    });
    setStoredAccounts([defaultAccount]);
    return [defaultAccount];
  }
  return raw.map(a => normalizeFinancialAccount(a));
}

export function setStoredAccounts(accounts = []) {
  setStorageItem(FINANCE_STORAGE_KEYS.ACCOUNTS, accounts);
}

export function saveStoredAccount(account) {
  const accounts = getStoredAccounts();
  const normalized = normalizeFinancialAccount(account);
  const idx = accounts.findIndex(a => a.id === normalized.id);
  if (idx >= 0) {
    accounts[idx] = normalized;
  } else {
    accounts.push(normalized);
  }
  setStoredAccounts(accounts);
  return normalized;
}

// ── TRANSACTIONS ──────────────────────────────────────────────────
export function getStoredTransactions() {
  const raw = getStorageItem(FINANCE_STORAGE_KEYS.TRANSACTIONS, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(t => normalizeTransaction(t));
}

export function setStoredTransactions(transactions = []) {
  setStorageItem(FINANCE_STORAGE_KEYS.TRANSACTIONS, transactions);
  // Also keep legacy 'expenses' key synced for backward compatibility
  const legacyExpenses = transactions
    .filter(t => !t.deletedAt && t.type === 'expense')
    .map(t => ({
      id: t.id,
      amount: t.amount,
      amountMinor: t.amountMinor,
      amount_minor: t.amountMinor,
      category: t.category || t.categoryId,
      desc: t.title,
      description: t.title,
      date: t.transactionDate,
      currency: t.currency
    }));
  setStorageItem('expenses', legacyExpenses);
}

export function saveStoredTransaction(txn) {
  const txns = getStoredTransactions();
  const normalized = normalizeTransaction(txn);
  const idx = txns.findIndex(t => t.id === normalized.id);
  if (idx >= 0) {
    txns[idx] = normalized;
  } else {
    txns.unshift(normalized);
  }
  setStoredTransactions(txns);

  // Update account balances
  updateReconciledBalances();
  return normalized;
}

export function deleteStoredTransaction(txnId) {
  const txns = getStoredTransactions();
  const updated = txns.map(t => {
    if (t.id === txnId) {
      return { ...t, deletedAt: new Date().toISOString() };
    }
    return t;
  });
  setStoredTransactions(updated);
  updateReconciledBalances();
}

function updateReconciledBalances() {
  const accounts = getStoredAccounts();
  const txns = getStoredTransactions();
  const balanceMap = reconcileAccountBalances(accounts, txns);

  const updatedAccounts = accounts.map(acc => ({
    ...acc,
    currentBalanceMinor: balanceMap.get(String(acc.id)) ?? acc.openingBalanceMinor
  }));
  setStoredAccounts(updatedAccounts);
}

// ── BUDGETS ───────────────────────────────────────────────────────
export function getStoredBudgets() {
  const raw = getStorageItem(FINANCE_STORAGE_KEYS.BUDGETS, []);
  if (!Array.isArray(raw) || raw.length === 0) {
    // Check legacy budget_settings
    const legacy = getStorageItem('budget_settings', null);
    const limit = legacy && legacy.monthlyLimit ? legacy.monthlyLimit : 10000;
    const defaultBudget = normalizeBudget({
      id: 'bgt_monthly_overall',
      name: 'Overall Monthly Budget',
      limitMinor: toMinorUnits(limit),
      period: 'monthly'
    });
    setStoredBudgets([defaultBudget]);
    return [defaultBudget];
  }
  return raw.map(b => normalizeBudget(b));
}

export function setStoredBudgets(budgets = []) {
  setStorageItem(FINANCE_STORAGE_KEYS.BUDGETS, budgets);
}

export function saveStoredBudget(budget) {
  const budgets = getStoredBudgets();
  const normalized = normalizeBudget(budget);
  const idx = budgets.findIndex(b => b.id === normalized.id);
  if (idx >= 0) {
    budgets[idx] = normalized;
  } else {
    budgets.push(normalized);
  }
  setStoredBudgets(budgets);
  return normalized;
}

// ── RECURRING PAYMENTS ────────────────────────────────────────────
export function getStoredRecurringPayments() {
  const raw = getStorageItem(FINANCE_STORAGE_KEYS.RECURRING_PAYMENTS, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(r => normalizeRecurringPayment(r));
}

export function setStoredRecurringPayments(payments = []) {
  setStorageItem(FINANCE_STORAGE_KEYS.RECURRING_PAYMENTS, payments);
}

export function saveStoredRecurringPayment(payment) {
  const list = getStoredRecurringPayments();
  const normalized = normalizeRecurringPayment(payment);
  const idx = list.findIndex(r => r.id === normalized.id);
  if (idx >= 0) {
    list[idx] = normalized;
  } else {
    list.push(normalized);
  }
  setStoredRecurringPayments(list);
  return normalized;
}

// ── SAVINGS GOALS ─────────────────────────────────────────────────
export function getStoredSavingsGoals() {
  const raw = getStorageItem(FINANCE_STORAGE_KEYS.SAVINGS_GOALS, []);
  if (!Array.isArray(raw) || raw.length === 0) {
    // Check legacy budget_settings for savings goal
    const legacy = getStorageItem('budget_settings', null);
    if (legacy && (legacy.savingsGoalName || legacy.savingsGoalTarget)) {
      const defaultGoal = normalizeSavingsGoal({
        id: 'svg_initial',
        title: legacy.savingsGoalName || 'Savings Goal',
        targetAmountMinor: toMinorUnits(legacy.savingsGoalTarget || 5000),
        currentAmountMinor: toMinorUnits(legacy.savingsGoalCurrent || 0)
      });
      setStoredSavingsGoals([defaultGoal]);
      return [defaultGoal];
    }
    return [];
  }
  return raw.map(s => normalizeSavingsGoal(s));
}

export function setStoredSavingsGoals(goals = []) {
  setStorageItem(FINANCE_STORAGE_KEYS.SAVINGS_GOALS, goals);
}

export function saveStoredSavingsGoal(goal) {
  const goals = getStoredSavingsGoals();
  const normalized = normalizeSavingsGoal(goal);
  const idx = goals.findIndex(g => g.id === normalized.id);
  if (idx >= 0) {
    goals[idx] = normalized;
  } else {
    goals.push(normalized);
  }
  setStoredSavingsGoals(goals);
  return normalized;
}

// ── MIGRATION: LEGACY BUDGET & EXPENSES ────────────────────────────
export function migrateLegacyBudgetAndExpenses() {
  const legacyExpenses = getStorageItem('expenses', []);
  const currentTxns = getStorageItem(FINANCE_STORAGE_KEYS.TRANSACTIONS, []);

  if (Array.isArray(legacyExpenses) && legacyExpenses.length > 0 && currentTxns.length === 0) {
    const migratedTxns = legacyExpenses.map(exp => normalizeTransaction({
      id: exp.id,
      amountMinor: exp.amountMinor || exp.amount_minor || toMinorUnits(exp.amount),
      currency: exp.currency || 'INR',
      categoryId: exp.category || 'cat_other',
      title: exp.desc || exp.description || 'Expense',
      description: exp.notes || '',
      transactionDate: exp.date || new Date().toISOString().slice(0, 10),
      type: 'expense'
    }));
    setStoredTransactions(migratedTxns);
  }

  // Ensure default accounts and budgets exist
  getStoredAccounts();
  getStoredBudgets();
  getStoredSavingsGoals();
}


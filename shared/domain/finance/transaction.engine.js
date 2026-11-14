/**
 * shared/domain/finance/transaction.engine.js
 * Transaction Management & Balance Reconciliation Engine for Planrova 2.0.
 *
 * Invariants:
 * 1. Transfers must NOT be counted as income or expenses in consolidated analytics.
 * 2. Account balances reconcile authoritatively against opening balance + non-deleted transactions.
 * 3. Refunds are handled cleanly without modifying original transaction history.
 * 4. Idempotency protection prevents accidental duplicate submissions.
 */

import { normalizeTransaction } from './finance.schemas.js';
import { validateTransaction } from './finance.validation.js';
import { isDateInRange } from './finance.utils.js';

/**
 * Creates and validates a new transaction.
 */
export function createTransaction(rawTxn, userId = 'local') {
  const txn = normalizeTransaction(rawTxn, userId);
  const validation = validateTransaction(txn);
  if (!validation.valid) {
    throw new Error(`Invalid transaction: ${validation.errors.join(', ')}`);
  }
  return txn;
}

/**
 * Checks if a transaction is a potential duplicate based on idempotencyKey or matching signature.
 */
export function isDuplicateTransaction(existingTxns = [], candidateTxn = {}) {
  if (candidateTxn.idempotencyKey) {
    return existingTxns.some(t => !t.deletedAt && t.idempotencyKey === candidateTxn.idempotencyKey && t.id !== candidateTxn.id);
  }
  // Signature matching: same account, date, amount, and title within existing transactions
  return existingTxns.some(t => {
    if (t.deletedAt || t.id === candidateTxn.id) return false;
    return t.accountId === candidateTxn.accountId &&
      t.transactionDate === candidateTxn.transactionDate &&
      t.amountMinor === candidateTxn.amountMinor &&
      t.type === candidateTxn.type &&
      t.title.toLowerCase() === (candidateTxn.title || '').trim().toLowerCase();
  });
}

/**
 * Reconciles current balances for all accounts based on opening balances and transactions.
 * Returns a Map of accountId -> currentBalanceMinor.
 */
export function reconcileAccountBalances(accounts = [], transactions = []) {
  const balanceMap = new Map();

  for (const acc of accounts) {
    balanceMap.set(String(acc.id), acc.openingBalanceMinor || 0);
  }

  // Process all active (non-deleted) transactions
  for (const txn of transactions) {
    if (txn.deletedAt) continue;

    const fromAccId = txn.accountId ? String(txn.accountId) : null;
    const toAccId = txn.toAccountId ? String(txn.toAccountId) : null;
    const amount = txn.amountMinor || 0;

    if (txn.type === 'income') {
      if (fromAccId && balanceMap.has(fromAccId)) {
        balanceMap.set(fromAccId, balanceMap.get(fromAccId) + amount);
      }
    } else if (txn.type === 'expense') {
      if (fromAccId && balanceMap.has(fromAccId)) {
        // If refund, adds back to balance; otherwise deducts
        const delta = txn.isRefund ? amount : -amount;
        balanceMap.set(fromAccId, balanceMap.get(fromAccId) + delta);
      }
    } else if (txn.type === 'transfer') {
      // Transfer deducts from source and credits destination
      if (fromAccId && balanceMap.has(fromAccId)) {
        balanceMap.set(fromAccId, balanceMap.get(fromAccId) - amount);
      }
      if (toAccId && balanceMap.has(toAccId)) {
        balanceMap.set(toAccId, balanceMap.get(toAccId) + amount);
      }
    }
  }

  return balanceMap;
}

/**
 * Calculates consolidated totals (Income, Expenses, Net Cashflow) across transactions.
 * Invariant: Transfers are strictly excluded from income and expenses!
 */
export function calculateConsolidatedTotals(transactions = [], { startDate = null, endDate = null, currency = null } = {}) {
  let totalIncomeMinor = 0;
  let totalExpenseMinor = 0;
  let transactionCount = 0;

  for (const txn of transactions) {
    if (txn.deletedAt) continue;
    if (currency && txn.currency && txn.currency.toUpperCase() !== currency.toUpperCase()) continue;
    if (!isDateInRange(txn.transactionDate, startDate, endDate)) continue;

    if (txn.type === 'income') {
      totalIncomeMinor += (txn.amountMinor || 0);
      transactionCount++;
    } else if (txn.type === 'expense') {
      if (txn.isRefund) {
        totalExpenseMinor -= (txn.amountMinor || 0);
      } else {
        totalExpenseMinor += (txn.amountMinor || 0);
      }
      transactionCount++;
    }
    // transfers do not alter consolidated income or expense
  }

  return {
    totalIncomeMinor,
    totalExpenseMinor,
    netCashflowMinor: totalIncomeMinor - totalExpenseMinor,
    transactionCount
  };
}

/**
 * Filters, searches, and sorts transactions.
 */
export function queryTransactions(transactions = [], {
  accountId = null,
  categoryId = null,
  type = null,
  startDate = null,
  endDate = null,
  searchQuery = '',
  tags = [],
  sortBy = 'date', // 'date' | 'amount'
  sortDirection = 'desc' // 'asc' | 'desc'
} = {}) {
  let filtered = transactions.filter(t => !t.deletedAt);

  if (accountId) {
    filtered = filtered.filter(t => t.accountId === accountId || t.toAccountId === accountId);
  }
  if (categoryId) {
    filtered = filtered.filter(t => t.categoryId === categoryId);
  }
  if (type) {
    filtered = filtered.filter(t => t.type === type);
  }
  if (startDate || endDate) {
    filtered = filtered.filter(t => isDateInRange(t.transactionDate, startDate, endDate));
  }
  if (tags && tags.length > 0) {
    filtered = filtered.filter(t => Array.isArray(t.tags) && tags.some(tag => t.tags.includes(tag)));
  }
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(t =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q))
    );
  }

  // Sorting
  filtered.sort((a, b) => {
    let comp = 0;
    if (sortBy === 'amount') {
      comp = (a.amountMinor || 0) - (b.amountMinor || 0);
    } else {
      // default: date
      comp = (a.transactionDate || '').localeCompare(b.transactionDate || '');
      if (comp === 0) {
        comp = (a.createdAt || '').localeCompare(b.createdAt || '');
      }
    }
    return sortDirection === 'desc' ? -comp : comp;
  });

  return filtered;
}

/**
 * Soft deletes a transaction.
 */
export function softDeleteTransaction(transaction) {
  return {
    ...transaction,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}


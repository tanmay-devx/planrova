import { describe, it, expect } from 'vitest';
import {
  createTransaction,
  isDuplicateTransaction,
  reconcileAccountBalances,
  calculateConsolidatedTotals,
  queryTransactions,
  softDeleteTransaction
} from '../shared/domain/finance/index.js';

describe('Finance Domain - Stage 2: Transaction Management & Balance Reconciliation', () => {
  const accounts = [
    { id: 'acc_bank', name: 'Bank Account', openingBalanceMinor: 1000000, currency: 'INR' }, // ₹10,000
    { id: 'acc_cash', name: 'Cash Wallet', openingBalanceMinor: 200000, currency: 'INR' }    // ₹2,000
  ];

  describe('Account Balance Reconciliation', () => {
    it('reconciles account balances across income, expense, and transfers accurately', () => {
      const transactions = [
        createTransaction({
          id: 't1',
          accountId: 'acc_bank',
          type: 'income',
          amountMinor: 500000, // +₹5,000
          transactionDate: '2026-11-01'
        }),
        createTransaction({
          id: 't2',
          accountId: 'acc_bank',
          type: 'expense',
          amountMinor: 200000, // -₹2,000
          transactionDate: '2026-11-02'
        }),
        createTransaction({
          id: 't3',
          accountId: 'acc_bank',
          toAccountId: 'acc_cash',
          type: 'transfer',
          amountMinor: 300000, // Transfer ₹3,000 from Bank to Cash
          transactionDate: '2026-11-03'
        }),
        createTransaction({
          id: 't4',
          accountId: 'acc_cash',
          type: 'expense',
          amountMinor: 50000, // -₹500 from cash
          transactionDate: '2026-11-04'
        })
      ];

      const balanceMap = reconcileAccountBalances(accounts, transactions);

      // Bank: 10,000 + 5,000 - 2,000 - 3,000 = 10,000 (1000000 minor)
      expect(balanceMap.get('acc_bank')).toBe(1000000);
      // Cash: 2,000 + 3,000 - 500 = 4,500 (450000 minor)
      expect(balanceMap.get('acc_cash')).toBe(450000);
    });

    it('handles refunds by crediting the account balance and reducing net expenses', () => {
      const transactions = [
        createTransaction({
          id: 't1',
          accountId: 'acc_bank',
          type: 'expense',
          amountMinor: 100000, // -₹1,000
          transactionDate: '2026-11-05'
        }),
        createTransaction({
          id: 't2',
          accountId: 'acc_bank',
          type: 'expense',
          isRefund: true,
          amountMinor: 40000, // +₹400 refund
          transactionDate: '2026-11-06'
        })
      ];

      const balanceMap = reconcileAccountBalances(accounts, transactions);
      // Bank: 10,000 - 1,000 + 400 = 9,400 (940000 minor)
      expect(balanceMap.get('acc_bank')).toBe(940000);

      const totals = calculateConsolidatedTotals(transactions);
      // Net expenses: 1,000 - 400 = 600 (60000 minor)
      expect(totals.totalExpenseMinor).toBe(60000);
    });
  });

  describe('Consolidated Totals & Transfer Invariant', () => {
    it('strictly excludes transfers from total income and total expenses', () => {
      const transactions = [
        createTransaction({
          type: 'income',
          amountMinor: 500000, // ₹5,000
          transactionDate: '2026-11-01'
        }),
        createTransaction({
          type: 'expense',
          amountMinor: 150000, // ₹1,500
          transactionDate: '2026-11-02'
        }),
        createTransaction({
          type: 'transfer',
          accountId: 'acc_bank',
          toAccountId: 'acc_cash',
          amountMinor: 1000000, // ₹10,000 transfer
          transactionDate: '2026-11-03'
        })
      ];

      const totals = calculateConsolidatedTotals(transactions);
      expect(totals.totalIncomeMinor).toBe(500000);
      expect(totals.totalExpenseMinor).toBe(150000);
      expect(totals.netCashflowMinor).toBe(350000);
      expect(totals.transactionCount).toBe(2); // Transfer excluded from income/expense count
    });
  });

  describe('Duplicate Detection & Filtering', () => {
    it('detects duplicate transactions using idempotency key and signature matching', () => {
      const existing = [
        createTransaction({
          id: 't1',
          accountId: 'acc_bank',
          type: 'expense',
          amountMinor: 25000,
          title: 'Coffee',
          transactionDate: '2026-11-14',
          idempotencyKey: 'idemp_123'
        })
      ];

      // Exact idempotency key match
      expect(isDuplicateTransaction(existing, { id: 't2', idempotencyKey: 'idemp_123' })).toBe(true);

      // Signature match (same account, date, amount, title, type)
      expect(isDuplicateTransaction(existing, {
        id: 't3',
        accountId: 'acc_bank',
        type: 'expense',
        amountMinor: 25000,
        title: 'Coffee',
        transactionDate: '2026-11-14'
      })).toBe(true);

      // Non-duplicate (different title)
      expect(isDuplicateTransaction(existing, {
        id: 't4',
        accountId: 'acc_bank',
        type: 'expense',
        amountMinor: 25000,
        title: 'Snack',
        transactionDate: '2026-11-14'
      })).toBe(false);
    });

    it('filters and searches transactions reliably', () => {
      const transactions = [
        createTransaction({ id: 't1', categoryId: 'cat_food', title: 'Groceries', amountMinor: 50000, transactionDate: '2026-11-01' }),
        createTransaction({ id: 't2', categoryId: 'cat_transport', title: 'Metro card recharge', amountMinor: 20000, transactionDate: '2026-11-05' }),
        createTransaction({ id: 't3', categoryId: 'cat_food', title: 'Swiggy Dinner', amountMinor: 35000, transactionDate: '2026-11-10' })
      ];

      const foodTxns = queryTransactions(transactions, { categoryId: 'cat_food' });
      expect(foodTxns.length).toBe(2);

      const searchResults = queryTransactions(transactions, { searchQuery: 'metro' });
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].id).toBe('t2');

      const dateFiltered = queryTransactions(transactions, { startDate: '2026-11-02', endDate: '2026-11-06' });
      expect(dateFiltered.length).toBe(1);
      expect(dateFiltered[0].id).toBe('t2');
    });

    it('soft deletes transactions without altering schema structure', () => {
      const txn = createTransaction({ title: 'Mistaken Entry', amountMinor: 5000, transactionDate: '2026-11-14' });
      const deleted = softDeleteTransaction(txn);

      expect(deleted.deletedAt).toBeTruthy();
      const active = queryTransactions([deleted]);
      expect(active.length).toBe(0);
    });
  });
});


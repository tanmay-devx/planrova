import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  BUDGET_PERIODS,
  BUDGET_STATUSES,
  RECURRING_FREQUENCIES,
  toMinorUnits,
  toMajorUnits,
  formatCurrency,
  calculateNextDueDate,
  getDaysInMonth,
  normalizeFinancialAccount,
  normalizeTransaction,
  normalizeBudget,
  normalizeRecurringPayment,
  normalizeSavingsGoal,
  validateFinancialAccount,
  validateTransaction,
  validateBudget,
  validateRecurringPayment,
  validateSavingsGoal
} from '../shared/domain/finance/index.js';

describe('Finance Domain - Stage 1: Schemas, Types, Utils & Validation', () => {
  describe('Minor Units and Currency Utils', () => {
    it('converts major floating units to integer minor units accurately', () => {
      expect(toMinorUnits(150.50)).toBe(15050);
      expect(toMinorUnits('250.75')).toBe(25075);
      expect(toMinorUnits(0)).toBe(0);
      expect(toMinorUnits(15050)).toBe(1505000);
    });

    it('converts minor units to decimal major units accurately', () => {
      expect(toMajorUnits(15050)).toBe(150.5);
      expect(toMajorUnits(25000)).toBe(250);
      expect(toMajorUnits(0)).toBe(0);
    });

    it('formats currency strings properly', () => {
      const formatted = formatCurrency(15050, 'INR', 'en-IN');
      expect(formatted).toContain('150.50');
    });

    it('computes days in month accurately including leap years', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29); // 2024 is leap year
      expect(getDaysInMonth(2025, 2)).toBe(28); // 2025 is non-leap
      expect(getDaysInMonth(2026, 4)).toBe(30);
      expect(getDaysInMonth(2026, 1)).toBe(31);
    });

    it('handles month-end clamping when calculating next due date', () => {
      // Payment started on Jan 31 -> in non-leap Feb clamps to Feb 28
      const nextDueFeb = calculateNextDueDate('2025-01-31', 'monthly', 1, '2025-01-31');
      expect(nextDueFeb).toBe('2025-02-28');

      // Payment started on Jan 31 -> in leap Feb clamps to Feb 29
      const nextDueLeap = calculateNextDueDate('2024-01-31', 'monthly', 1, '2024-01-31');
      expect(nextDueLeap).toBe('2024-02-29');

      // Payment started on March 31 -> in April clamps to April 30
      const nextDueApr = calculateNextDueDate('2026-03-31', 'monthly', 1, '2026-03-31');
      expect(nextDueApr).toBe('2026-04-30');
    });
  });

  describe('Account Normalization & Validation', () => {
    it('normalizes raw financial account with defaults', () => {
      const acc = normalizeFinancialAccount({
        name: 'HDFC Savings',
        accountType: 'bank',
        openingBalance: 5000,
        currency: 'INR'
      }, 'user_123');

      expect(acc.userId).toBe('user_123');
      expect(acc.name).toBe('HDFC Savings');
      expect(acc.openingBalanceMinor).toBe(500000);
      expect(acc.currentBalanceMinor).toBe(500000);
      expect(acc.accountType).toBe('bank');

      const val = validateFinancialAccount(acc);
      expect(val.valid).toBe(true);
    });

    it('rejects invalid financial account', () => {
      const val = validateFinancialAccount({ id: 'acc_1', userId: 'u1', name: '', accountType: 'invalid' });
      expect(val.valid).toBe(false);
      expect(val.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Normalization & Validation', () => {
    it('normalizes an expense transaction with minor units', () => {
      const txn = normalizeTransaction({
        title: 'Dinner with team',
        amount: 850,
        type: 'expense',
        currency: 'INR',
        transactionDate: '2026-11-14'
      }, 'user_123');

      expect(txn.amountMinor).toBe(85000);
      expect(txn.amount).toBe(850);
      expect(txn.type).toBe('expense');

      const val = validateTransaction(txn);
      expect(val.valid).toBe(true);
    });

    it('rejects transfer with identical source and destination accounts', () => {
      const txn = normalizeTransaction({
        type: 'transfer',
        accountId: 'acc_1',
        toAccountId: 'acc_1',
        amountMinor: 10000,
        currency: 'INR',
        transactionDate: '2026-11-14'
      }, 'user_123');

      const val = validateTransaction(txn);
      expect(val.valid).toBe(false);
      expect(val.errors).toContain('Transfer source and destination accounts must be different');
    });
  });

  describe('Budget Normalization & Validation', () => {
    it('normalizes budget with alert threshold', () => {
      const bgt = normalizeBudget({
        name: 'Food & Groceries',
        limit: 8000,
        period: 'monthly'
      }, 'user_123');

      expect(bgt.limitMinor).toBe(800000);
      expect(bgt.period).toBe('monthly');
      expect(bgt.alertThreshold).toBe(80);

      const val = validateBudget(bgt);
      expect(val.valid).toBe(true);
    });
  });

  describe('Recurring Payment & Savings Goal Normalization', () => {
    it('normalizes recurring payment', () => {
      const rec = normalizeRecurringPayment({
        title: 'WiFi Bill',
        amount: 999,
        frequency: 'monthly',
        startDate: '2026-11-01'
      }, 'user_123');

      expect(rec.amountMinor).toBe(99900);
      expect(rec.frequency).toBe('monthly');
      expect(rec.isActive).toBe(true);

      const val = validateRecurringPayment(rec);
      expect(val.valid).toBe(true);
    });

    it('normalizes savings goal with target and current amounts', () => {
      const goal = normalizeSavingsGoal({
        title: 'New Laptop',
        targetAmount: 60000,
        currentAmount: 15000
      }, 'user_123');

      expect(goal.targetAmountMinor).toBe(6000000);
      expect(goal.currentAmountMinor).toBe(1500000);
      expect(goal.isCompleted).toBe(false);

      const val = validateSavingsGoal(goal);
      expect(val.valid).toBe(true);
    });
  });
});

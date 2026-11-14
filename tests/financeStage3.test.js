import { describe, it, expect } from 'vitest';
import {
  evaluateBudget,
  evaluateAllBudgets,
  resolveBudgetPeriodBounds,
  BUDGET_STATUSES,
  normalizeBudget,
  createTransaction
} from '../shared/domain/finance/index.js';

describe('Finance Domain - Stage 3: Budget Intelligence & Spending Forecasts', () => {
  const refDate = '2026-11-15'; // Day 15 of 30-day November

  describe('Budget Period Resolution', () => {
    it('resolves monthly date bounds accurately', () => {
      const bounds = resolveBudgetPeriodBounds('monthly', '2026-11-15');
      expect(bounds.startDate).toBe('2026-11-01');
      expect(bounds.endDate).toBe('2026-11-30');
    });

    it('resolves weekly bounds accurately from Monday to Sunday', () => {
      // 2026-11-15 is Sunday
      const bounds = resolveBudgetPeriodBounds('weekly', '2026-11-15');
      expect(bounds.startDate).toBe('2026-11-09');
      expect(bounds.endDate).toBe('2026-11-15');
    });
  });

  describe('Budget Evaluation & Statuses', () => {
    const monthlyBudget = normalizeBudget({
      id: 'bgt_food',
      name: 'Food Budget',
      categoryId: 'cat_food',
      limit: 10000, // ₹10,000 (1000000 minor)
      period: 'monthly',
      alertThreshold: 80
    });

    it('classifies budget as healthy when spending is below alert threshold', () => {
      const txns = [
        createTransaction({ categoryId: 'cat_food', amountMinor: 400000, type: 'expense', transactionDate: '2026-11-05' }) // ₹4,000 (40%)
      ];

      const res = evaluateBudget(monthlyBudget, txns, refDate);
      expect(res.totalSpentMinor).toBe(400000);
      expect(res.remainingMinor).toBe(600000);
      expect(res.utilizationPercentage).toBe(40);
      expect(res.status).toBe(BUDGET_STATUSES.HEALTHY);
    });

    it('classifies budget as approaching limit when spending reaches or exceeds alert threshold', () => {
      const txns = [
        createTransaction({ categoryId: 'cat_food', amountMinor: 850000, type: 'expense', transactionDate: '2026-11-10' }) // ₹8,500 (85%)
      ];

      const res = evaluateBudget(monthlyBudget, txns, refDate);
      expect(res.totalSpentMinor).toBe(850000);
      expect(res.remainingMinor).toBe(150000);
      expect(res.utilizationPercentage).toBe(85);
      expect(res.status).toBe(BUDGET_STATUSES.APPROACHING_LIMIT);
    });

    it('classifies budget as exceeded when total spending exceeds limit', () => {
      const txns = [
        createTransaction({ categoryId: 'cat_food', amountMinor: 1100000, type: 'expense', transactionDate: '2026-11-12' }) // ₹11,000 (110%)
      ];

      const res = evaluateBudget(monthlyBudget, txns, refDate);
      expect(res.totalSpentMinor).toBe(1100000);
      expect(res.remainingMinor).toBe(0);
      expect(res.overspentMinor).toBe(100000); // Overspent by ₹1,000
      expect(res.utilizationPercentage).toBe(110);
      expect(res.status).toBe(BUDGET_STATUSES.EXCEEDED);
    });
  });

  describe('Spending Forecasting & Daily Average', () => {
    it('computes daily average and projects month-end spending deterministically', () => {
      const budget = normalizeBudget({
        id: 'bgt_overall',
        name: 'Overall Budget',
        limit: 12000, // ₹12,000 limit
        period: 'monthly'
      });

      // On day 15, user has spent ₹8,000 (800000 minor)
      const txns = [
        createTransaction({ amountMinor: 800000, type: 'expense', transactionDate: '2026-11-10' })
      ];

      const res = evaluateBudget(budget, txns, refDate);
      expect(res.elapsedDays).toBe(15);
      expect(res.totalPeriodDays).toBe(30);

      // Daily average: 8,000 / 15 = ~₹533.33 (53333 minor)
      expect(res.dailyAverageSpentMinor).toBe(53333);
      // Projected total: 53333 * 30 = ~₹16,000 (1600000 minor), exceeding ₹12,000 limit
      expect(res.projectedSpentMinor).toBe(1600000);
      expect(res.projectedOverspentMinor).toBe(400000);
      expect(res.insights.some(i => i.includes('projected total'))).toBe(true);
    });
  });
});


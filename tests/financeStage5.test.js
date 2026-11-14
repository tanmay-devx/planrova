import { describe, it, expect } from 'vitest';
import {
  normalizeSavingsGoal,
  evaluateSavingsGoal,
  recordSavingsContribution
} from '../shared/domain/finance/index.js';

describe('Finance Domain - Stage 5: Savings Goals & Feasibility Planning', () => {
  const refDate = '2026-11-14';

  describe('Goal Evaluation & Feasibility', () => {
    it('evaluates progress percentage and remaining amount accurately', () => {
      const goal = normalizeSavingsGoal({
        id: 'svg_trip',
        title: 'Goa Vacation',
        targetAmount: 30000, // ₹30,000
        currentAmount: 18000, // ₹18,000
        targetDate: '2027-02-14' // 3 months away (~92 days)
      });

      const res = evaluateSavingsGoal(goal, refDate);
      expect(res.targetAmountMinor).toBe(3000000);
      expect(res.currentAmountMinor).toBe(1800000);
      expect(res.remainingAmountMinor).toBe(1200000); // ₹12,000 remaining
      expect(res.progressPercentage).toBe(60);
      expect(res.isCompleted).toBe(false);
      expect(res.isOverdue).toBe(false);

      // Monthly requirement: ~₹4,000/month
      expect(res.requiredPerMonthMinor).toBeGreaterThan(0);
      expect(res.insights.some(i => i.includes('save approximately'))).toBe(true);
    });

    it('identifies overdue uncompleted goals', () => {
      const goal = normalizeSavingsGoal({
        id: 'svg_old',
        title: 'Past Goal',
        targetAmount: 20000,
        currentAmount: 10000,
        targetDate: '2026-10-01' // in the past
      });

      const res = evaluateSavingsGoal(goal, refDate);
      expect(res.isOverdue).toBe(true);
      expect(res.isCompleted).toBe(false);
      expect(res.insights.some(i => i.includes('passed'))).toBe(true);
    });
  });

  describe('Contribution Recording & Completion', () => {
    it('records contributions and marks goal completed when target is met', () => {
      let goal = normalizeSavingsGoal({
        id: 'svg_watch',
        title: 'Smart Watch',
        targetAmount: 5000,
        currentAmount: 3000
      });

      // Contribution 1: +₹1,000
      goal = recordSavingsContribution(goal, {
        amountMinor: 100000,
        note: 'Saved from Diwali gift'
      });

      expect(goal.currentAmountMinor).toBe(400000);
      expect(goal.isCompleted).toBe(false);
      expect(goal.contributions.length).toBe(1);

      // Contribution 2: +₹1,500 (surpassing ₹5,000 target)
      goal = recordSavingsContribution(goal, {
        amountMinor: 150000,
        note: 'Internship bonus'
      });

      expect(goal.currentAmountMinor).toBe(550000);
      expect(goal.isCompleted).toBe(true);
      expect(goal.contributions.length).toBe(2);
    });
  });
});


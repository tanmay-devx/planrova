import { describe, it, expect } from 'vitest';
import {
  computeCashFlowVelocity,
  projectMonthlySpend,
  computeBudgetVariance
} from '../shared/domain/finance/finance.intelligence.js';

describe('Stage 6 — Finance Intelligence Engine & Cash Flow Tests', () => {
  describe('1. Cash Flow Velocity & Runway Engine', () => {
    it('computes daily burn rate and cashflow positive runway', () => {
      const now = new Date('2026-11-15T12:00:00Z');
      const transactions = [
        { id: '1', type: 'income', amountMinor: 300000, date: '2026-11-01' },   // $3,000
        { id: '2', type: 'expense', amountMinor: 90000, date: '2026-11-05' },   // $900
        { id: '3', type: 'expense', amountMinor: 60000, date: '2026-11-10' }    // $600
      ];

      const velocity = computeCashFlowVelocity({
        transactions,
        days: 30,
        totalLiquidBalanceMinor: 500000, // $5,000
        referenceDate: now
      });

      expect(velocity.totalOutflowMinor).toBe(150000); // $1,500
      expect(velocity.totalInflowMinor).toBe(300000);  // $3,000
      expect(velocity.dailyAverageSpendMinor).toBe(5000); // $50/day
      expect(velocity.dailyAverageIncomeMinor).toBe(10000); // $100/day
      expect(velocity.netBurnRateMinor).toBe(-5000); // Net surplus
      expect(velocity.isCashflowPositive).toBe(true);
      expect(velocity.runwayDays).toBe(Infinity);
    });

    it('calculates runway days accurately when operating at a net deficit', () => {
      const now = new Date('2026-11-15T12:00:00Z');
      const transactions = [
        { id: '1', type: 'expense', amountMinor: 300000, date: '2026-11-10' } // $3,000 spent in 30 days = $100/day burn
      ];

      const velocity = computeCashFlowVelocity({
        transactions,
        days: 30,
        totalLiquidBalanceMinor: 1000000, // $10,000 liquid balance
        referenceDate: now
      });

      expect(velocity.dailyAverageSpendMinor).toBe(10000); // $100/day
      expect(velocity.netBurnRateMinor).toBe(10000);
      expect(velocity.isCashflowPositive).toBe(false);
      // Runway = $10,000 / $100/day = 100 days
      expect(velocity.runwayDays).toBe(100);
    });

    it('handles empty transactions safely without division by zero', () => {
      const velocity = computeCashFlowVelocity({
        transactions: [],
        days: 0,
        totalLiquidBalanceMinor: 0
      });

      expect(velocity.dailyAverageSpendMinor).toBe(0);
      expect(velocity.isCashflowPositive).toBe(true);
      expect(velocity.runwayDays).toBe(Infinity);
    });
  });

  describe('2. Predictive Month-End Run-Rate Projection', () => {
    it('projects month-end spending based on current daily pace', () => {
      // Day 15 of 30, spent $600 (60,000 minor)
      const projection = projectMonthlySpend({
        currentSpendMinor: 60000,
        currentDay: 15,
        totalDaysInMonth: 30
      });

      expect(projection.dailyRunRateMinor).toBe(4000); // $40/day
      expect(projection.projectedMonthEndMinor).toBe(120000); // $1,200 projected
      expect(projection.remainingDays).toBe(15);
    });

    it('handles first day of the month conservatively', () => {
      const projection = projectMonthlySpend({
        currentSpendMinor: 5000, // $50 spent on day 1
        currentDay: 1,
        totalDaysInMonth: 31
      });

      expect(projection.dailyRunRateMinor).toBe(5000);
      expect(projection.projectedMonthEndMinor).toBe(155000); // $1,550
    });
  });

  describe('3. Budget Variance & Velocity Diagnostics', () => {
    it('flags overspent budgets with critical alert', () => {
      const budgets = [
        { id: 'b1', name: 'Dining', category: 'food', limitMinor: 50000 } // $500 limit
      ];
      const transactions = [
        { id: 'tx1', category: 'food', amountMinor: 55000, date: '2026-11-10' } // $550 spent
      ];

      const variances = computeBudgetVariance({
        budgets,
        transactions,
        nowStr: '2026-11-15'
      });

      expect(variances.length).toBe(1);
      expect(variances[0].isOverspent).toBe(true);
      expect(variances[0].varianceMinor).toBe(-5000); // -$50
      expect(variances[0].alertLevel).toBe('critical');
    });

    it('flags high-velocity warning if >65% spent in first half of month', () => {
      const budgets = [
        { id: 'b2', name: 'Shopping', category: 'shopping', limitMinor: 100000 } // $1,000 limit
      ];
      const transactions = [
        { id: 'tx2', category: 'shopping', amountMinor: 70000, date: '2026-11-08' } // 70% on Day 8
      ];

      const variances = computeBudgetVariance({
        budgets,
        transactions,
        nowStr: '2026-11-10' // Day 10 <= 15
      });

      expect(variances.length).toBe(1);
      expect(variances[0].isOverspent).toBe(false);
      expect(variances[0].utilizationPct).toBe(70);
      expect(variances[0].isAtVelocityRisk).toBe(true);
      expect(variances[0].alertLevel).toBe('warning');
    });
  });
});


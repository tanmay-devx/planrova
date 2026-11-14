import { describe, it, expect } from 'vitest';
import {
  calculateDailyHydration,
  calculateWeeklyHydration,
  generateHydrationReminderSlots,
  normalizeHydrationLog
} from '../shared/domain/wellbeing/index.js';

describe('Wellbeing Domain - Stage 8: Hydration Tracking & Reminder Slots', () => {
  const refDate = new Date(2026, 10, 14); // 2026-11-14

  describe('Daily Hydration Calculation', () => {
    it('aggregates daily hydration logs against target goal', () => {
      const logs = [
        normalizeHydrationLog({ amount: 250, date: '2026-11-14', beverageType: 'water' }),
        normalizeHydrationLog({ amount: 500, date: '2026-11-14', beverageType: 'water' }),
        normalizeHydrationLog({ amount: 200, date: '2026-11-14', beverageType: 'tea' }),
        normalizeHydrationLog({ amount: 500, date: '2026-11-13', beverageType: 'water' }) // yesterday
      ];

      const res = calculateDailyHydration(logs, '2026-11-14', 2000);
      expect(res.totalMl).toBe(950);
      expect(res.targetGoalMl).toBe(2000);
      expect(res.remainingMl).toBe(1050);
      expect(res.percentage).toBe(48); // 950 / 2000 = 47.5% -> 48%
      expect(res.isGoalReached).toBe(false);
      expect(res.beverageBreakdown.water).toBe(750);
      expect(res.beverageBreakdown.tea).toBe(200);
    });

    it('identifies when goal is reached or exceeded', () => {
      const logs = [
        normalizeHydrationLog({ amount: 1500, date: '2026-11-14' }),
        normalizeHydrationLog({ amount: 1000, date: '2026-11-14' })
      ];

      const res = calculateDailyHydration(logs, '2026-11-14', 2000);
      expect(res.totalMl).toBe(2500);
      expect(res.percentage).toBe(100);
      expect(res.remainingMl).toBe(0);
      expect(res.isGoalReached).toBe(true);
    });
  });

  describe('Weekly Hydration Analytics', () => {
    it('aggregates weekly hydration over 7 calendar days', () => {
      const logs = [
        normalizeHydrationLog({ amount: 2000, date: '2026-11-14' }), // goal met
        normalizeHydrationLog({ amount: 2000, date: '2026-11-13' }), // goal met
        normalizeHydrationLog({ amount: 1000, date: '2026-11-12' })
      ];

      const res = calculateWeeklyHydration(logs, refDate, 2000);
      expect(res.days.length).toBe(7);
      expect(res.goalsReachedCount).toBe(2);
      expect(res.consistencyPercentage).toBe(Math.round((2 / 7) * 100)); // 29%
    });
  });

  describe('Reminder Slots Generation', () => {
    it('generates non-spam reminder candidate slots during active hours', () => {
      const slots = generateHydrationReminderSlots({
        wakeTime: '08:00',
        sleepTime: '22:00',
        intervalMinutes: 120 // Every 2 hours
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toBe('10:00'); // First reminder 2h after 08:00
      expect(slots).toContain('12:00');
      expect(slots).toContain('14:00');
      expect(slots).toContain('16:00');
      expect(slots).toContain('18:00');
      expect(slots).toContain('20:00');
      // Should not exceed or collide with sleepTime
      expect(slots.includes('22:00')).toBe(false);
    });
  });
});


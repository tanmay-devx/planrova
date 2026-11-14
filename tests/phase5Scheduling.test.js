import { describe, it, expect } from 'vitest';
import {
  transformFinanceEntitiesToSchedulingInputs,
  generateFinanceAwareScheduleProposal
} from '../shared/domain/finance/index.js';
import {
  transformWellbeingEntitiesToSchedulingInputs,
  generateWellbeingAwareScheduleProposal
} from '../shared/domain/wellbeing/index.js';

describe('Phase 5 Adaptive Planning Engine Integration', () => {
  const targetDateStr = '2026-11-16'; // Monday

  describe('Finance Scheduler Adapter', () => {
    it('transforms upcoming bills and subscription reviews into flexible scheduling tasks', () => {
      const recurringPayments = [
        {
          id: 'rec_rent',
          title: 'Hostel Rent',
          amountMinor: 800000,
          amount: 8000,
          currency: 'INR',
          frequency: 'monthly',
          startDate: targetDateStr,
          nextDueDate: targetDateStr,
          isActive: true
        }
      ];

      const subscriptions = [
        {
          id: 'sub_netflix',
          serviceName: 'Netflix',
          amountMinor: 64900,
          amount: 649,
          currency: 'INR',
          nextBillingDate: targetDateStr,
          renewalStatus: 'active'
        }
      ];

      const { tasks } = transformFinanceEntitiesToSchedulingInputs({
        targetDateStr,
        recurringPayments,
        subscriptions,
        existingTasks: [{ id: 'task_existing', title: 'Study Math', estimatedMinutes: 60 }]
      });

      expect(tasks.length).toBe(3); // 1 existing + 1 bill + 1 subscription review

      const billTask = tasks.find(t => t.type === 'finance_bill');
      expect(billTask).toBeDefined();
      expect(billTask.title).toContain('Hostel Rent');
      expect(billTask.priority).toBe('high');
      expect(billTask.dueDate).toBe(targetDateStr);

      const subTask = tasks.find(t => t.type === 'subscription_review');
      expect(subTask).toBeDefined();
      expect(subTask.title).toContain('Review Subscription: Netflix');
    });

    it('generates a collision-free schedule proposal with financial tasks', () => {
      const fixedEvents = [
        { id: 'ev_lecture', title: 'Operating Systems Lecture', date: targetDateStr, startTime: '10:00', endTime: '12:00', isFixed: true }
      ];

      const recurringPayments = [
        { id: 'rec_wifi', title: 'WiFi Bill', amountMinor: 99900, amount: 999, currency: 'INR', frequency: 'monthly', startDate: targetDateStr, nextDueDate: targetDateStr, isActive: true }
      ];

      const proposal = generateFinanceAwareScheduleProposal({
        targetDateStr,
        fixedEvents,
        recurringPayments,
        availabilityConfig: { workingHoursStart: '08:00', workingHoursEnd: '18:00', lunchStart: '13:00', lunchEnd: '14:00' }
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.sourceSnapshotHash).toBeDefined();
      expect(proposal.proposedBlocks.length).toBeGreaterThan(0);

      // Verify no collision between the scheduled bill task and the fixed lecture (10:00 - 12:00)
      for (const block of proposal.proposedBlocks) {
        if (!block.isFixed) {
          const overlapsLecture = (block.startTime < '12:00' && block.endTime > '10:00');
          expect(overlapsLecture).toBe(false);
        }
      }
    });
  });

  describe('Wellbeing Scheduler Adapter', () => {
    it('transforms scheduled habits and routines into candidate tasks', () => {
      const habits = [
        {
          id: 'hab_read',
          name: 'Read 20 pages',
          frequency: { type: 'daily' },
          estimatedMinutes: 25,
          priority: 'medium'
        }
      ];

      const routines = [
        {
          id: 'rtn_morning',
          title: 'Morning Ritual',
          daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri (target date is Monday)
          estimatedDurationMinutes: 20,
          isActive: true
        }
      ];

      const { tasks } = transformWellbeingEntitiesToSchedulingInputs({
        targetDateStr,
        habits,
        routines,
        existingTasks: []
      });

      expect(tasks.length).toBe(2);

      const habitTask = tasks.find(t => t.type === 'habit_session');
      expect(habitTask).toBeDefined();
      expect(habitTask.title).toContain('Read 20 pages');
      expect(habitTask.estimatedMinutes).toBe(25);

      const routineTask = tasks.find(t => t.type === 'routine_block');
      expect(routineTask).toBeDefined();
      expect(routineTask.title).toContain('Morning Ritual');
      expect(routineTask.estimatedMinutes).toBe(20);
    });

    it('generates a collision-free proposal with habits and routines', () => {
      const fixedEvents = [
        { id: 'ev_lab', title: 'Chemistry Lab', date: targetDateStr, startTime: '14:00', endTime: '17:00', isFixed: true }
      ];

      const habits = [
        { id: 'hab_jog', name: 'Evening Jog', frequency: { type: 'daily' }, estimatedMinutes: 30 }
      ];

      const proposal = generateWellbeingAwareScheduleProposal({
        targetDateStr,
        fixedEvents,
        habits,
        availabilityConfig: { workingHoursStart: '08:00', workingHoursEnd: '19:00', lunchStart: '12:30', lunchEnd: '13:30' }
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.sourceSnapshotHash).toBeDefined();
      expect(proposal.proposedBlocks.length).toBeGreaterThan(0);

      // Verify no collision with Chemistry Lab (14:00 - 17:00)
      for (const block of proposal.proposedBlocks) {
        if (!block.isFixed) {
          const overlapsLab = (block.startTime < '17:00' && block.endTime > '14:00');
          expect(overlapsLab).toBe(false);
        }
      }
    });
  });
});

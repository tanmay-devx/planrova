import { describe, it, expect } from 'vitest';
import {
  normalizeRecurringPayment,
  getUpcomingRecurringOccurrences,
  recordRecurringPaymentPaid,
  pauseRecurringPayment,
  resumeRecurringPayment
} from '../shared/domain/finance/index.js';

describe('Finance Domain - Stage 4: Recurring Payments & Subscriptions', () => {
  const recurringBill = normalizeRecurringPayment({
    id: 'rec_rent',
    title: 'Apartment Rent',
    amount: 15000,
    frequency: 'monthly',
    startDate: '2026-11-01',
    nextDueDate: '2026-11-01',
    accountId: 'acc_bank'
  }, 'user_123');

  describe('Upcoming Occurrences Generation', () => {
    it('generates upcoming occurrences without automatically creating transactions', () => {
      const occurrences = getUpcomingRecurringOccurrences([recurringBill], {
        startDate: '2026-11-01',
        lookaheadDays: 60
      });

      // Should project Nov 1 and Dec 1 occurrences
      expect(occurrences.length).toBeGreaterThanOrEqual(2);
      expect(occurrences[0].dueDate).toBe('2026-11-01');
      expect(occurrences[0].amountMinor).toBe(1500000);
      expect(occurrences[1].dueDate).toBe('2026-12-01');
    });

    it('ignores paused or inactive recurring payments', () => {
      const paused = pauseRecurringPayment(recurringBill);
      const occurrences = getUpcomingRecurringOccurrences([paused], {
        startDate: '2026-11-01',
        lookaheadDays: 30
      });
      expect(occurrences.length).toBe(0);
    });
  });

  describe('Mark as Paid Workflow & Idempotency', () => {
    it('records verified transaction, advances nextDueDate, and appends payment history', () => {
      const { updatedRecurring, transaction } = recordRecurringPaymentPaid(recurringBill, {
        paidDate: '2026-11-01',
        userId: 'user_123'
      });

      // Transaction verification
      expect(transaction.type).toBe('expense');
      expect(transaction.amountMinor).toBe(1500000);
      expect(transaction.recurringPaymentId).toBe('rec_rent');
      expect(transaction.idempotencyKey).toBe('rec_pay_rec_rent_2026-11-01');

      // Next due date should advance to Dec 1
      expect(updatedRecurring.nextDueDate).toBe('2026-12-01');
      expect(updatedRecurring.lastPaymentDate).toBe('2026-11-01');
      expect(updatedRecurring.paymentHistory.length).toBe(1);
      expect(updatedRecurring.paymentHistory[0].periodDueDate).toBe('2026-11-01');
    });

    it('prevents duplicate payment of the same period occurrence (idempotency)', () => {
      const { updatedRecurring } = recordRecurringPaymentPaid(recurringBill, {
        paidDate: '2026-11-01',
        userId: 'user_123'
      });

      // Attempting to pay the exact same period again should throw
      expect(() => {
        recordRecurringPaymentPaid({ ...updatedRecurring, nextDueDate: '2026-11-01' }, {
          paidDate: '2026-11-01',
          userId: 'user_123'
        });
      }).toThrow(/already been marked as paid/);
    });
  });

  describe('Pause and Resume Lifecycle', () => {
    it('toggles active status cleanly', () => {
      const paused = pauseRecurringPayment(recurringBill);
      expect(paused.isActive).toBe(false);

      const resumed = resumeRecurringPayment(paused);
      expect(resumed.isActive).toBe(true);
    });
  });
});


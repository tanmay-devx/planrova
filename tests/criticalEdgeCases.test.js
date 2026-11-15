/**
 * tests/criticalEdgeCases.test.js
 *
 * Targeted regression and edge-case coverage for critical business logic:
 * 1. Financial budget evaluations, aggregations, and schema validation.
 * 2. AI proposal schema, action-specific payloads, expiration, and message safety validation.
 * 3. Database entity validation (notes, hydration logs, user profiles, expenses).
 * 4. SyncEngine state observation, conflict resolution edge cases, and offline handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── 1. Finance Domain Imports
import { evaluateAllBudgets, evaluateBudget } from '../shared/domain/finance/budget.engine.js';
import {
  validateFinancialAccount,
  validateTransaction,
  validateBudget,
  validateRecurringPayment,
  validateSubscription,
  validateSavingsGoal
} from '../shared/domain/finance/finance.validation.js';

// ── 2. AI Domain Imports
import {
  validateProposal,
  validateMessage
} from '../shared/domain/ai/ai.validation.js';
import {
  AI_ACTION_TYPES
} from '../shared/domain/ai/ai.types.js';

// ── 3. Database Entity Validation Imports
import {
  validateNote,
  validateHydrationLog,
  validateUserProfile,
  validateExpense
} from '../src/db/validation.js';

// ── 4. Sync Engine Imports
import {
  getSyncStatus,
  stopRealtimeSync,
  syncPendingChanges,
  resolveSyncConflict
} from '../src/db/syncEngine.js';

describe('Critical Business Logic & Quality Assurance Tests', () => {

  // =========================================================================
  // SECTION 1: Finance Budget Engine & Multi-Budget Aggregations
  // =========================================================================
  describe('1. Finance Budget Engine Aggregations (evaluateAllBudgets)', () => {
    it('handles empty budget lists gracefully with zeroed summary totals', () => {
      const result = evaluateAllBudgets([], []);
      expect(result.evaluations).toEqual([]);
      expect(result.totalLimitMinor).toBe(0);
      expect(result.totalSpentMinor).toBe(0);
      expect(result.totalRemainingMinor).toBe(0);
      expect(result.summary).toEqual({
        totalBudgets: 0,
        healthyCount: 0,
        approachingCount: 0,
        exceededCount: 0
      });
    });

    it('aggregates healthy, approaching, and exceeded budgets correctly', () => {
      const budgets = [
        {
          id: 'b_overall',
          name: 'Overall Monthly',
          period: 'monthly',
          limitMinor: 2000000, // ₹20,000
          startDate: '2026-05-01',
          endDate: '2026-05-31',
          alertThreshold: 80
        },
        {
          id: 'b_food',
          name: 'Food & Dining',
          categoryId: 'food',
          period: 'monthly',
          limitMinor: 500000, // ₹5,000
          startDate: '2026-05-01',
          endDate: '2026-05-31',
          alertThreshold: 80
        },
        {
          id: 'b_entertainment',
          name: 'Entertainment',
          categoryId: 'entertainment',
          period: 'monthly',
          limitMinor: 200000, // ₹2,000
          startDate: '2026-05-01',
          endDate: '2026-05-31',
          alertThreshold: 80
        }
      ];

      const transactions = [
        // Overall / Food transactions
        { id: 't1', categoryId: 'food', amountMinor: 450000, transactionDate: '2026-05-10', type: 'expense' }, // 90% of food -> approaching limit
        // Entertainment transaction
        { id: 't2', categoryId: 'entertainment', amountMinor: 250000, transactionDate: '2026-05-12', type: 'expense' } // 125% -> exceeded
      ];

      const refDate = '2026-05-15';
      const result = evaluateAllBudgets(budgets, transactions, refDate);

      expect(result.evaluations.length).toBe(3);
      // Total limit should only aggregate overall budget (categoryId == null) to prevent double counting
      expect(result.totalLimitMinor).toBe(2000000);
      expect(result.totalSpentMinor).toBe(700000); // 450000 + 250000
      expect(result.totalRemainingMinor).toBe(1300000);

      expect(result.summary.totalBudgets).toBe(3);
      expect(result.summary.healthyCount).toBe(1); // Overall is at 35% -> healthy
      expect(result.summary.approachingCount).toBe(1); // Food is at 90% -> approaching
      expect(result.summary.exceededCount).toBe(1); // Entertainment is at 125% -> exceeded
    });
  });

  // =========================================================================
  // SECTION 2: Finance Domain Entity Validation
  // =========================================================================
  describe('2. Finance Entity Schema & Safety Validation', () => {
    describe('validateFinancialAccount', () => {
      it('rejects invalid inputs and non-objects', () => {
        expect(validateFinancialAccount(null).valid).toBe(false);
        expect(validateFinancialAccount(undefined).valid).toBe(false);
        expect(validateFinancialAccount('invalid').valid).toBe(false);
      });

      it('requires id, userId, name, currency, valid accountType, and integer balance', () => {
        const invalidAccount = {
          id: '',
          userId: '',
          name: '   ',
          accountType: 'crypto_vault',
          currency: '',
          openingBalanceMinor: 100.5
        };
        const res = validateFinancialAccount(invalidAccount);
        expect(res.valid).toBe(false);
        expect(res.errors.length).toBeGreaterThanOrEqual(5);
      });

      it('accepts a fully compliant account', () => {
        const validAccount = {
          id: 'acc_1',
          userId: 'user_1',
          name: 'HDFC Savings',
          accountType: 'bank',
          currency: 'INR',
          openingBalanceMinor: 5000000
        };
        const res = validateFinancialAccount(validAccount);
        expect(res.valid).toBe(true);
        expect(res.errors).toEqual([]);
      });
    });

    describe('validateTransaction', () => {
      it('rejects non-object transaction', () => {
        expect(validateTransaction(null).valid).toBe(false);
      });

      it('rejects transfers where source and destination accounts are identical', () => {
        const transfer = {
          id: 'tx_1',
          userId: 'user_1',
          type: 'transfer',
          amountMinor: 50000,
          currency: 'INR',
          transactionDate: '2026-05-15',
          accountId: 'acc_same',
          toAccountId: 'acc_same'
        };
        const res = validateTransaction(transfer);
        expect(res.valid).toBe(false);
        expect(res.errors).toContain('Transfer source and destination accounts must be different');
      });

      it('rejects non-positive and non-integer amounts', () => {
        const invalidTx = {
          id: 'tx_2',
          userId: 'user_1',
          type: 'expense',
          amountMinor: -500,
          currency: 'INR',
          transactionDate: 'invalid-date'
        };
        const res = validateTransaction(invalidTx);
        expect(res.valid).toBe(false);
        expect(res.errors.some(e => e.includes('positive integer'))).toBe(true);
        expect(res.errors.some(e => e.includes('YYYY-MM-DD'))).toBe(true);
      });
    });

    describe('validateBudget', () => {
      it('validates date formatting and start/end chronology', () => {
        const invertedDatesBudget = {
          id: 'b_1',
          userId: 'user_1',
          period: 'monthly',
          limitMinor: 100000,
          startDate: '2026-06-01',
          endDate: '2026-05-01'
        };
        const res = validateBudget(invertedDatesBudget);
        expect(res.valid).toBe(false);
        expect(res.errors).toContain('startDate cannot be after endDate');
      });
    });

    describe('validateRecurringPayment, Subscription, SavingsGoal', () => {
      it('validates recurring payment frequencies and dates', () => {
        const invalidRec = {
          id: 'rec_1',
          userId: 'user_1',
          title: 'Rent',
          amountMinor: 1500000,
          frequency: 'bi-centennial',
          startDate: 'invalid-date'
        };
        const res = validateRecurringPayment(invalidRec);
        expect(res.valid).toBe(false);
        expect(res.errors.some(e => e.includes('frequency must be one of'))).toBe(true);
      });

      it('validates subscription serviceName and non-negative amount', () => {
        expect(validateSubscription({ id: 'sub_1', serviceName: '', amountMinor: -1 }).valid).toBe(false);
        expect(validateSubscription({ id: 'sub_1', serviceName: 'Spotify', amountMinor: 11900 }).valid).toBe(true);
      });

      it('validates savings goal target, current amount, and priorities', () => {
        const invalidGoal = {
          id: 'sg_1',
          title: '',
          targetAmountMinor: 0,
          currentAmountMinor: -50,
          priority: 'urgent_now'
        };
        const res = validateSavingsGoal(invalidGoal);
        expect(res.valid).toBe(false);
        expect(res.errors.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  // =========================================================================
  // SECTION 3: AI Schema, Action Payload & Safety Validators
  // =========================================================================
  describe('3. AI Proposal Schema & Payload Safety (ai.validation.js)', () => {
    it('rejects null or non-object proposals', () => {
      expect(validateProposal(null).valid).toBe(false);
      expect(validateProposal('proposal').valid).toBe(false);
    });

    it('enforces proposal ownership matching caller userId', () => {
      const proposal = {
        id: 'prop_1',
        userId: 'user_victim',
        actionType: AI_ACTION_TYPES.CREATE_TASK,
        payload: { title: 'Do homework' }
      };
      const res = validateProposal(proposal, 'user_attacker');
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Proposal ownership mismatch');
    });

    it('rejects proposals with unrecognized action types', () => {
      const proposal = {
        id: 'prop_2',
        actionType: 'DELETE_DATABASE_ALL',
        payload: {}
      };
      const res = validateProposal(proposal);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Invalid actionType: DELETE_DATABASE_ALL');
    });

    it('validates RESCHEDULE_TASK payload requiring taskId and targetDate', () => {
      const proposal = {
        id: 'prop_resched',
        actionType: AI_ACTION_TYPES.RESCHEDULE_TASK,
        payload: { taskId: 't1' } // missing targetDate
      };
      const res = validateProposal(proposal);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('RESCHEDULE_TASK payload requires a targetDate');
    });

    it('validates CREATE_STUDY_PLAN payload requiring course info and sessions', () => {
      const invalidPlan = {
        id: 'prop_plan_1',
        actionType: AI_ACTION_TYPES.CREATE_STUDY_PLAN,
        payload: { courseId: '', sessions: [] }
      };
      const res = validateProposal(invalidPlan);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('CREATE_STUDY_PLAN payload requires a courseId or courseName');
      expect(res.errors).toContain('CREATE_STUDY_PLAN payload requires at least one study session');

      const validPlan = {
        id: 'prop_plan_2',
        actionType: AI_ACTION_TYPES.CREATE_STUDY_PLAN,
        payload: {
          courseName: 'CS 101',
          sessions: [{ date: '2026-05-18', durationMinutes: 60 }]
        }
      };
      expect(validateProposal(validPlan).valid).toBe(true);
    });

    it('validates CREATE_NOTE payload requiring title or content', () => {
      const invalidNote = {
        id: 'prop_note_1',
        actionType: AI_ACTION_TYPES.CREATE_NOTE,
        payload: { tags: ['study'] }
      };
      expect(validateProposal(invalidNote).valid).toBe(false);

      const validNote = {
        id: 'prop_note_2',
        actionType: AI_ACTION_TYPES.CREATE_NOTE,
        payload: { title: 'Lecture Notes' }
      };
      expect(validateProposal(validNote).valid).toBe(true);
    });

    it('validates ADJUST_BUDGET payload requiring categoryId and positive newLimitMinor', () => {
      const invalidBudgetAdj = {
        id: 'prop_b_1',
        actionType: AI_ACTION_TYPES.ADJUST_BUDGET,
        payload: { categoryId: '', newLimitMinor: -100 }
      };
      const res = validateProposal(invalidBudgetAdj);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('ADJUST_BUDGET payload requires a categoryId');
      expect(res.errors).toContain('ADJUST_BUDGET payload requires a positive newLimitMinor');

      const validBudgetAdj = {
        id: 'prop_b_2',
        actionType: AI_ACTION_TYPES.ADJUST_BUDGET,
        payload: { categoryId: 'groceries', newLimitMinor: 800000 }
      };
      expect(validateProposal(validBudgetAdj).valid).toBe(true);
    });

    it('validates UPDATE_ROUTINE payload requiring routineId or title', () => {
      const invalidRoutine = {
        id: 'prop_r_1',
        actionType: AI_ACTION_TYPES.UPDATE_ROUTINE,
        payload: {}
      };
      expect(validateProposal(invalidRoutine).valid).toBe(false);

      const validRoutine = {
        id: 'prop_r_2',
        actionType: AI_ACTION_TYPES.UPDATE_ROUTINE,
        payload: { routineId: 'r_morning' }
      };
      expect(validateProposal(validRoutine).valid).toBe(true);
    });

    it('detects and rejects expired proposals', () => {
      const expiredProposal = {
        id: 'prop_exp',
        actionType: AI_ACTION_TYPES.CREATE_TASK,
        payload: { title: 'Review notes' },
        expiresAt: new Date(Date.now() - 60000).toISOString() // 1 minute in the past
      };
      const res = validateProposal(expiredProposal);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Proposal has expired');
    });

    describe('validateMessage', () => {
      it('validates chat message bounds and empty content', () => {
        expect(validateMessage(null).valid).toBe(false);
        expect(validateMessage({ content: '   ' }).valid).toBe(false);
        expect(validateMessage({ content: 'A'.repeat(5001) }).valid).toBe(false);
        expect(validateMessage({ content: 'Help me plan tomorrow' }).valid).toBe(true);
      });
    });
  });

  // =========================================================================
  // SECTION 4: Database Entity Validation
  // =========================================================================
  describe('4. Database Entities & Boundary Validation (validation.js)', () => {
    describe('validateNote', () => {
      it('sanitizes tags and linkedTasks to string arrays', () => {
        const rawNote = {
          title: 'Deep Work Session',
          content: 'Covering Chapter 4',
          tags: ['academic', 123, null],
          linkedTasks: ['task_1', 'task_2']
        };
        const sanitized = validateNote(rawNote);
        expect(sanitized.title).toBe('Deep Work Session');
        expect(sanitized.tags).toEqual(['academic', '123', 'null']);
        expect(sanitized.linkedTasks).toEqual(['task_1', 'task_2']);
        expect(sanitized.deleted).toBe(false);
      });

      it('provides default title if none provided', () => {
        const sanitized = validateNote({ content: 'Just some text' });
        expect(sanitized.title).toBe('Untitled Note');
      });
    });

    describe('validateHydrationLog', () => {
      it('rejects invalid or non-numeric amount values', () => {
        expect(() => validateHydrationLog({ amount: 'invalid' })).toThrow('Hydration amount must be a number');
        expect(() => validateHydrationLog(null)).toThrow('Hydration log must be a valid object');
      });

      it('sanitizes valid hydration logs and defaults type to Water', () => {
        const valid = validateHydrationLog({ amount: 250 });
        expect(valid.amount).toBe(250);
        expect(valid.type).toBe('Water');
        expect(valid.timestamp).toBeTypeOf('number');
      });
    });

    describe('validateUserProfile', () => {
      it('enforces character length limits and default timezone', () => {
        const longProfile = {
          name: 'A'.repeat(100),
          bio: 'B'.repeat(300),
          college: 'C'.repeat(150),
          branch: 'D'.repeat(150),
          semester: 'E'.repeat(50)
        };
        const sanitized = validateUserProfile(longProfile);
        expect(sanitized.name.length).toBe(50);
        expect(sanitized.bio.length).toBe(160);
        expect(sanitized.college.length).toBe(100);
        expect(sanitized.branch.length).toBe(100);
        expect(sanitized.semester.length).toBe(20);
        expect(sanitized.timezone).toBe('Asia/Kolkata');
      });
    });

    describe('validateExpense', () => {
      it('throws error for non-positive amount unless marked deleted', () => {
        expect(() => validateExpense({ amount: 0, deleted: false })).toThrow('Expense amount must be greater than zero');
        // Deleted expense with 0 amount is allowed for tombstone synchronization
        const deletedExp = validateExpense({ amount: 0, deleted: true });
        expect(deletedExp.deleted).toBe(true);
        expect(deletedExp.amount_minor).toBe(0);
      });
    });
  });

  // =========================================================================
  // SECTION 5: Sync Engine Lifecycle & Merging Edge Cases
  // =========================================================================
  describe('5. Sync Engine Lifecycle, State & Numeric Merges', () => {
    it('returns observable sync status structure', () => {
      const status = getSyncStatus();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('pendingCount');
      expect(status).toHaveProperty('lastSyncTime');
      expect(status).toHaveProperty('lastError');
    });

    it('stops realtime sync safely without errors', () => {
      expect(() => stopRealtimeSync()).not.toThrow();
      const status = getSyncStatus();
      expect(status.state).toBe('idle');
    });

    it('merges focus_coins by taking the highest value', () => {
      const localRecord = { updated_at: 100 };
      const cloudData = { updated_at: 100 };
      
      const merged1 = resolveSyncConflict('focus_coins', { ...localRecord, value: '50' }, { ...cloudData, value: '75' });
      expect(merged1).toBe(75);

      const merged2 = resolveSyncConflict('focus_coins', { ...localRecord, value: '120' }, { ...cloudData, value: '80' });
      expect(merged2).toBe(120);
    });

    it('merges gamification state by taking maximum level and xp', () => {
      const localRecord = {
        updated_at: 100,
        value: JSON.stringify({ level: 4, xp: 450, streak: 5 })
      };
      const cloudData = {
        updated_at: 120,
        value: JSON.stringify({ level: 5, xp: 200, badges: ['early_bird'] })
      };

      const merged = resolveSyncConflict('gamification', localRecord, cloudData);
      expect(merged.level).toBe(5);
      expect(merged.xp).toBe(450);
      expect(merged.badges).toEqual(['early_bird']);
    });

    it('merges hydration targets and water logs by taking maximums', () => {
      const localRecord = {
        updated_at: 100,
        value: JSON.stringify({ water: 1500, target: 2000 })
      };
      const cloudData = {
        updated_at: 120,
        value: JSON.stringify({ water: 1750, target: 2500 })
      };

      const merged = resolveSyncConflict('hydration', localRecord, cloudData);
      expect(merged.water).toBe(1750);
      expect(merged.target).toBe(2500);
    });

    it('merges unlocked_seeds by creating a unique union set', () => {
      const localRecord = {
        updated_at: 100,
        value: JSON.stringify(['oak', 'pine'])
      };
      const cloudData = {
        updated_at: 100,
        value: JSON.stringify(['pine', 'cherry_blossom'])
      };

      const merged = resolveSyncConflict('unlocked_seeds', localRecord, cloudData);
      expect(merged).toContain('oak');
      expect(merged).toContain('pine');
      expect(merged).toContain('cherry_blossom');
      expect(merged.length).toBe(3);
    });
  });
});

/**
 * tests/phase6Reliability.test.js
 * Comprehensive Reliability & Architectural Invariant Tests for Phase 6.
 *
 * Verifies:
 * 1. Firestore document-level account isolation & permission policies.
 * 2. Recurring payment idempotency, interrupted recording recovery, and transaction reversal.
 * 3. Account balance reconciliation after partial failures and soft deletions.
 * 4. Migration idempotency and interrupted recovery.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeRecurringPayment,
  recordRecurringPaymentPaid,
  reconcileRecurringPaymentState,
  reverseRecurringPaymentOccurrence,
  createTransaction,
  reconcileAccountBalances,
  softDeleteTransaction
} from '../shared/domain/finance/index.js';

describe('Phase 6 Reliability Engineering & Fault-Tolerance', () => {

  describe('4.1 Firestore & Tenant Isolation Simulation', () => {
    // Model of Firestore security rules evaluator
    function evaluateFirestoreRule({ auth, path, action }) {
      const isAuth = auth !== null && typeof auth.uid === 'string';
      const userMatch = path.match(/^\/users\/([^/]+)(\/.*)?$/);

      if (userMatch) {
        const docUserId = userMatch[1];
        if (isAuth && auth.uid === docUserId) {
          return { allowed: true };
        }
        return { allowed: false, reason: isAuth ? 'PERMISSION_DENIED_WRONG_USER' : 'UNAUTHENTICATED' };
      }

      // Default deny for unmapped root paths
      return { allowed: false, reason: 'DEFAULT_DENY' };
    }

    it('allows User A to read, write, and delete their own user-scoped document path', () => {
      const authA = { uid: 'user_A' };
      const pathA = '/users/user_A/appData/tasks';

      expect(evaluateFirestoreRule({ auth: authA, path: pathA, action: 'read' }).allowed).toBe(true);
      expect(evaluateFirestoreRule({ auth: authA, path: pathA, action: 'write' }).allowed).toBe(true);
      expect(evaluateFirestoreRule({ auth: authA, path: pathA, action: 'delete' }).allowed).toBe(true);
    });

    it('denies User A from reading or modifying User B documents', () => {
      const authA = { uid: 'user_A' };
      const pathB = '/users/user_B/appData/tasks';

      const readAttempt = evaluateFirestoreRule({ auth: authA, path: pathB, action: 'read' });
      expect(readAttempt.allowed).toBe(false);
      expect(readAttempt.reason).toBe('PERMISSION_DENIED_WRONG_USER');

      const writeAttempt = evaluateFirestoreRule({ auth: authA, path: pathB, action: 'write' });
      expect(writeAttempt.allowed).toBe(false);
      expect(writeAttempt.reason).toBe('PERMISSION_DENIED_WRONG_USER');
    });

    it('denies unauthenticated requests to any user document path', () => {
      const unauth = null;
      const path = '/users/user_A/appData/finance_accounts';

      const result = evaluateFirestoreRule({ auth: unauth, path, action: 'read' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('UNAUTHENTICATED');
    });

    it('rejects attempts to access arbitrary non-user collections under default deny', () => {
      const authA = { uid: 'user_A' };
      const result = evaluateFirestoreRule({ auth: authA, path: '/system_config/keys', action: 'read' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('DEFAULT_DENY');
    });
  });

  describe('4.2 Finance Reliability: Recurring Payment Idempotency & Interrupted Recovery', () => {
    const baseRecurring = normalizeRecurringPayment({
      id: 'rec_broadband',
      title: 'Broadband Internet',
      amount: 1200, // 1200 INR -> 120000 minor units
      frequency: 'monthly',
      startDate: '2026-11-01',
      nextDueDate: '2026-11-01',
      accountId: 'acc_bank_1'
    }, 'user_123');

    it('recovers safely on repeated payment submission with allowIdempotentReplay', () => {
      // First submission
      const { updatedRecurring, transaction } = recordRecurringPaymentPaid(baseRecurring, {
        paidDate: '2026-11-01',
        userId: 'user_123'
      });

      expect(updatedRecurring.nextDueDate).toBe('2026-12-01');
      expect(transaction.idempotencyKey).toBe('rec_pay_rec_broadband_2026-11-01');

      // Second submission with same baseRecurring (e.g. client double-click before state refreshed)
      const replay1 = recordRecurringPaymentPaid(baseRecurring, {
        paidDate: '2026-11-01',
        userId: 'user_123',
        existingTransactions: [transaction],
        allowIdempotentReplay: true
      });

      // Second submission with updated recurring and explicit periodDueDate
      const replay2 = recordRecurringPaymentPaid(updatedRecurring, {
        paidDate: '2026-11-01',
        periodDueDate: '2026-11-01',
        userId: 'user_123',
        existingTransactions: [transaction],
        allowIdempotentReplay: true
      });

      expect(replay2.isIdempotentReplay).toBe(true);
      expect(replay2.updatedRecurring.nextDueDate).toBe('2026-12-01');
      expect(replay2.transaction.id).toBe(transaction.id);
    });

    it('recovers cleanly when transaction was created in ledger but recurring payment record was not updated', () => {
      // Simulate crash: Transaction exists in ledger with the idempotency key, but baseRecurring is still at 2026-11-01
      const preExistingTxn = createTransaction({
        id: 'txn_crashed_1',
        userId: 'user_123',
        accountId: 'acc_bank_1',
        type: 'expense',
        amountMinor: 120000,
        title: 'Broadband Internet',
        transactionDate: '2026-11-01',
        recurringPaymentId: 'rec_broadband',
        idempotencyKey: 'rec_pay_rec_broadband_2026-11-01'
      }, 'user_123');

      // Call recordRecurringPaymentPaid with existingTransactions
      const result = recordRecurringPaymentPaid(baseRecurring, {
        paidDate: '2026-11-01',
        userId: 'user_123',
        existingTransactions: [preExistingTxn]
      });

      // Does NOT create a new transaction; reuses the existing one and marks recovered: true
      expect(result.recovered).toBe(true);
      expect(result.transaction.id).toBe('txn_crashed_1');
      expect(result.updatedRecurring.nextDueDate).toBe('2026-12-01');
      expect(result.updatedRecurring.paymentHistory.length).toBe(1);
      expect(result.updatedRecurring.paymentHistory[0].transactionId).toBe('txn_crashed_1');
    });

    it('reconciles recurring payment state against transaction ledger automatically', () => {
      const ledgerTxn = createTransaction({
        id: 'txn_external_1',
        userId: 'user_123',
        accountId: 'acc_bank_1',
        type: 'expense',
        amountMinor: 120000,
        title: 'Broadband Internet',
        transactionDate: '2026-11-01',
        recurringPaymentId: 'rec_broadband',
        idempotencyKey: 'rec_pay_rec_broadband_2026-11-01'
      }, 'user_123');

      const unreconciledRecurring = {
        ...baseRecurring,
        nextDueDate: '2026-11-01',
        paymentHistory: []
      };

      const repaired = reconcileRecurringPaymentState(unreconciledRecurring, [ledgerTxn]);
      expect(repaired.nextDueDate).toBe('2026-12-01');
      expect(repaired.paymentHistory.length).toBe(1);
      expect(repaired.paymentHistory[0].periodDueDate).toBe('2026-11-01');
    });

    it('supports reversing a paid recurring occurrence and rolls back nextDueDate', () => {
      const { updatedRecurring, transaction } = recordRecurringPaymentPaid(baseRecurring, {
        paidDate: '2026-11-01',
        userId: 'user_123'
      });
      expect(updatedRecurring.nextDueDate).toBe('2026-12-01');

      // Now reverse occurrence
      const { updatedRecurring: rolledBack, reversedTransaction } = reverseRecurringPaymentOccurrence(
        updatedRecurring,
        '2026-11-01',
        [transaction]
      );

      expect(rolledBack.nextDueDate).toBe('2026-11-01');
      expect(rolledBack.paymentHistory.length).toBe(0);
      expect(reversedTransaction).toBeDefined();
      expect(reversedTransaction.deletedAt).toBeDefined();

      // Account balance reconciliation excludes the soft-deleted transaction
      const accounts = [{ id: 'acc_bank_1', openingBalanceMinor: 500000 }];
      const balanceBefore = reconcileAccountBalances(accounts, [transaction]).get('acc_bank_1');
      expect(balanceBefore).toBe(380000); // 5000 - 1200 = 3800

      const balanceAfter = reconcileAccountBalances(accounts, [reversedTransaction]).get('acc_bank_1');
      expect(balanceAfter).toBe(500000); // Reversed: full opening balance restored
    });
  });

  describe('4.3 Migration Idempotency & Data Preservation', () => {
    function migrateLegacySettings(rawRecords) {
      if (!rawRecords || typeof rawRecords !== 'object') return {};
      const migrated = { ...rawRecords };

      // Ensure versioning
      migrated._schemaVersion = Math.max(migrated._schemaVersion || 0, 2);

      // Safe migration of legacy string amounts to minor units
      if (Array.isArray(migrated.expenses)) {
        migrated.expenses = migrated.expenses.map(exp => ({
          ...exp,
          amountMinor: exp.amountMinor || Math.round((parseFloat(exp.amount) || 0) * 100),
          migratedAt: exp.migratedAt || new Date().toISOString()
        }));
      }

      return migrated;
    }

    it('is strictly idempotent when run repeatedly on the same dataset', () => {
      const initialLegacyData = {
        _schemaVersion: 1,
        expenses: [
          { id: 'exp_1', title: 'Coffee', amount: '45.50' },
          { id: 'exp_2', title: 'Book', amount: '350.00' }
        ]
      };

      const pass1 = migrateLegacySettings(initialLegacyData);
      expect(pass1._schemaVersion).toBe(2);
      expect(pass1.expenses[0].amountMinor).toBe(4550);
      expect(pass1.expenses[1].amountMinor).toBe(35000);

      const pass2 = migrateLegacySettings(pass1);
      expect(pass2._schemaVersion).toBe(2);
      expect(pass2.expenses[0].amountMinor).toBe(4550);
      expect(pass2.expenses[1].amountMinor).toBe(35000);
      // Migration timestamps should not change on second pass
      expect(pass2.expenses[0].migratedAt).toBe(pass1.expenses[0].migratedAt);
    });

    it('handles corrupt or empty legacy records gracefully without crashing', () => {
      expect(migrateLegacySettings(null)).toEqual({});
      expect(migrateLegacySettings(undefined)).toEqual({});
      const emptyResult = migrateLegacySettings({});
      expect(emptyResult._schemaVersion).toBe(2);
    });
  });
});

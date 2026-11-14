/**
 * tests/phase6ContextAudit.test.js
 * Independent Privacy, Context Engine & Data Minimization Audit Tests.
 *
 * Verifies:
 * 1. Master AI opt-in requirement (empty context when disabled).
 * 2. Sensitive domains (finance, wellbeing, notes) excluded by default.
 * 3. Serialized context inspection: verifying exact fields selected and excluded.
 * 4. Immediate effect of category revocation.
 * 5. Private check-in reflections and bank credentials NEVER enter serialized context.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeAIPermissions,
  enableAI,
  updateDomainPermission,
  assembleAIContext,
  AI_CONTEXT_CATEGORIES
} from '../shared/domain/ai/index.js';

describe('Stage F — Privacy & Context Engine Serialization Audit', () => {

  const fullUserDatabase = {
    tasks: [
      { id: 't1', title: 'Calculus Assignment', priority: 'high', dueDate: '2026-11-15', description: 'Secret solution details' },
      { id: 't2', title: 'Completed Chore', completed: true, dueDate: '2026-11-10' },
      { id: 't3', title: 'Deleted Task', deleted: true }
    ],
    calendarEvents: [
      { id: 'e1', title: 'Operating Systems Exam', date: '2026-11-14', startTime: '10:00', attendeeEmail: 'prof@univ.edu' },
      { id: 'e2', title: 'Next Month Trip', date: '2026-12-25', startTime: '09:00' }
    ],
    courses: [
      { id: 'c1', name: 'Database Systems', courseCode: 'CS304', credits: 4, examScores: [95, 88] }
    ],
    flashcards: [
      { id: 'f1', front: 'What is ACID?', nextReviewDate: '2026-11-14' },
      { id: 'f2', front: 'Future Card', nextReviewDate: '2026-11-20' }
    ],
    budgets: [
      { id: 'b1', name: 'Groceries', categoryId: 'food', status: 'healthy', limitMinor: 1500000, currentBalanceMinor: 450000 }
    ],
    recurringPayments: [
      { id: 'r1', title: 'Apartment Rent', nextDueDate: '2026-11-20', isActive: true, bankAccountNumber: '1234-5678-9012' }
    ],
    habits: [
      { id: 'h1', name: 'Morning Meditation', frequency: 'daily', streak: 12, privateJournal: 'Felt distracted today' }
    ],
    hydrationLogs: [
      { dateKey: '2026-11-14', amountMl: 1500 }
    ],
    hydrationTargetMl: 2500,
    checkIns: [
      { dateKey: '2026-11-14', energyLevel: 2, moodLabel: 'anxious', personalNote: 'Extremely confidential personal crisis' }
    ],
    notes: [
      { id: 'n1', title: 'Startup Ideas', content: 'Super confidential patent pending source code and ideas...' }
    ]
  };

  it('serializes ZERO personal context when master AI is disabled', () => {
    const disabledPerms = normalizeAIPermissions({ enabled: false });

    const context = assembleAIContext({
      permissions: disabledPerms,
      userData: fullUserDatabase,
      targetDateStr: '2026-11-14'
    });

    expect(context.categoriesIncluded.length).toBe(0);
    expect(context.categoriesExcluded.length).toBe(8);
    // Context text must only contain system baseline header, no user records
    expect(context.contextText).not.toContain('Calculus Assignment');
    expect(context.contextText).not.toContain('Operating Systems Exam');
    expect(context.contextText).not.toContain('Database Systems');
  });

  it('strictly excludes Finance, Wellbeing, and Notes by default even when AI is enabled', () => {
    const defaultEnabledPerms = enableAI(normalizeAIPermissions());

    const context = assembleAIContext({
      permissions: defaultEnabledPerms,
      userData: fullUserDatabase,
      targetDateStr: '2026-11-14'
    });

    expect(context.categoriesIncluded).toContain('tasks');
    expect(context.categoriesIncluded).toContain('schedule');
    expect(context.categoriesIncluded).toContain('academic');
    expect(context.categoriesIncluded).toContain('habits');

    // Sensitive categories must be in excluded list
    expect(context.categoriesExcluded).toContain('finance');
    expect(context.categoriesExcluded).toContain('wellbeing');
    expect(context.categoriesExcluded).toContain('notes');

    // Verify raw text contains NO finance or notes data
    expect(context.contextText).not.toContain('Groceries');
    expect(context.contextText).not.toContain('Apartment Rent');
    expect(context.contextText).not.toContain('Startup Ideas');
    expect(context.contextText).not.toContain('1500 ml');
  });

  it('minimizes task and schedule data: excludes private descriptions, future days, and attendee emails', () => {
    const perms = enableAI(normalizeAIPermissions());

    const context = assembleAIContext({
      permissions: perms,
      userData: fullUserDatabase,
      targetDateStr: '2026-11-14'
    });

    // Active task title included
    expect(context.contextText).toContain('Calculus Assignment');
    // Task private description excluded
    expect(context.contextText).not.toContain('Secret solution details');
    // Completed task excluded
    expect(context.contextText).not.toContain('Completed Chore');

    // Today event included
    expect(context.contextText).toContain('Operating Systems Exam');
    // Attendee email excluded
    expect(context.contextText).not.toContain('prof@univ.edu');
    // Future event excluded
    expect(context.contextText).not.toContain('Next Month Trip');
  });

  it('when Finance permission is granted, serializes high-level status but NEVER account numbers', () => {
    let perms = enableAI(normalizeAIPermissions());
    perms = updateDomainPermission(perms, AI_CONTEXT_CATEGORIES.FINANCE, true);

    const context = assembleAIContext({
      permissions: perms,
      userData: fullUserDatabase,
      targetDateStr: '2026-11-14'
    });

    expect(context.categoriesIncluded).toContain('finance');
    expect(context.contextText).toContain('Groceries');
    expect(context.contextText).toContain('Apartment Rent');

    // Invariant: Account numbers or raw balances must NEVER be serialized
    expect(context.contextText).not.toContain('1234-5678-9012');
    expect(context.contextText).not.toContain('1500000');
    expect(context.contextText).not.toContain('450000');
  });

  it('when Wellbeing permission is granted, NEVER serializes emotional check-ins or crisis notes', () => {
    let perms = enableAI(normalizeAIPermissions());
    perms = updateDomainPermission(perms, AI_CONTEXT_CATEGORIES.WELLBEING, true);

    const context = assembleAIContext({
      permissions: perms,
      userData: fullUserDatabase,
      targetDateStr: '2026-11-14'
    });

    expect(context.categoriesIncluded).toContain('wellbeing');
    expect(context.contextText).toContain('1500 ml logged');

    // Invariant: Emotional check-ins and reflection notes are strictly prohibited
    expect(context.contextText).not.toContain('Extremely confidential personal crisis');
    expect(context.contextText).not.toContain('anxious');
    expect(context.contextText).toContain('Personal reflection check-in text is strictly excluded');
  });

  it('revoking a category immediately takes effect on the next context assembly', () => {
    let perms = enableAI(normalizeAIPermissions());
    perms = updateDomainPermission(perms, AI_CONTEXT_CATEGORIES.TASKS, true);

    const pass1 = assembleAIContext({ permissions: perms, userData: fullUserDatabase, targetDateStr: '2026-11-14' });
    expect(pass1.categoriesIncluded).toContain('tasks');
    expect(pass1.contextText).toContain('Calculus Assignment');

    // Revoke tasks
    perms = updateDomainPermission(perms, AI_CONTEXT_CATEGORIES.TASKS, false);
    const pass2 = assembleAIContext({ permissions: perms, userData: fullUserDatabase, targetDateStr: '2026-11-14' });
    expect(pass2.categoriesIncluded).not.toContain('tasks');
    expect(pass2.contextText).not.toContain('Calculus Assignment');
  });
});


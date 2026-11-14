import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  formatCurrency,
  validateTask,
  validateHabit,
  validateExpense,
  validateNote,
  validateHydrationLog,
  validateUserProfile
} from '../src/db/validation.js';

describe('Validation & Minor Units Engine', () => {
  describe('Monetary Minor Units Utilities', () => {
    it('converts floating point rupees to integer paise accurately', () => {
      expect(toMinorUnits(10.50)).toBe(1050);
      expect(toMinorUnits('45.75')).toBe(4575);
      expect(toMinorUnits(0)).toBe(0);
      // Classic floating point trap: 0.1 + 0.2 = 0.30000000000000004
      const sum = 0.1 + 0.2;
      expect(toMinorUnits(sum)).toBe(30);
    });

    it('converts minor units back to decimal currency', () => {
      expect(fromMinorUnits(1050)).toBe(10.5);
      expect(fromMinorUnits(4575)).toBe(45.75);
      expect(fromMinorUnits(0)).toBe(0);
    });

    it('formats currency strings properly', () => {
      expect(formatCurrency(15000, true, '₹')).toContain('₹150');
      expect(formatCurrency(4550, true, '₹')).toContain('₹45.5');
    });
  });

  describe('Task Validation', () => {
    it('sanitizes and validates a complete task', () => {
      const raw = {
        title: ' Study for Midterms ',
        desc: 'Chapter 1 to 4',
        date: '2026-11-20',
        category: 'study',
        priority: 'high',
        completed: false
      };
      const validated = validateTask(raw);
      expect(validated.title).toBe('Study for Midterms');
      expect(validated.category).toBe('study');
      expect(validated.priority).toBe('high');
      expect(validated.completed).toBe(false);
      expect(typeof validated.id).toBe('string');
      expect(typeof validated.updated_at).toBe('number');
    });

    it('rejects task without title', () => {
      expect(() => validateTask({ title: '   ' })).toThrow('Task title cannot be empty');
      expect(() => validateTask(null)).toThrow('Task must be a valid object');
    });

    it('falls back to safe defaults for invalid category or priority', () => {
      const raw = { title: 'Clean room', category: 'alien_category', priority: 'ultra_critical' };
      const validated = validateTask(raw);
      expect(validated.category).toBe('other');
      expect(validated.priority).toBe('medium');
    });
  });

  describe('Habit Validation', () => {
    it('sanitizes and calculates streaks properly', () => {
      const habit = validateHabit({ name: 'Meditation', streak: 7 });
      expect(habit.name).toBe('Meditation');
      expect(habit.streak).toBe(7);
      expect(Array.isArray(habit.logs)).toBe(true);
    });

    it('handles mobile fire property fallback', () => {
      const habit = validateHabit({ name: 'Pushups', fire: 12 });
      expect(habit.streak).toBe(12);
    });

    it('rejects empty habit name', () => {
      expect(() => validateHabit({ name: '' })).toThrow('Habit name cannot be empty');
    });
  });

  describe('Expense Validation', () => {
    it('calculates minor units on creation', () => {
      const exp = validateExpense({ amount: 250.75, category: 'Food', notes: 'Dinner' });
      expect(exp.amount_minor).toBe(25075);
      expect(exp.amount).toBe(250.75);
      expect(exp.category).toBe('Food');
    });

    it('rejects zero or negative amounts', () => {
      expect(() => validateExpense({ amount: 0 })).toThrow('Expense amount must be greater than zero');
      expect(() => validateExpense({ amount: -50 })).toThrow('Expense amount must be greater than zero');
    });
  });

  describe('User Profile Validation', () => {
    it('truncates overly long input fields defensively', () => {
      const longName = 'A'.repeat(100);
      const longBio = 'B'.repeat(300);
      const profile = validateUserProfile({ name: longName, bio: longBio });
      expect(profile.name.length).toBe(50);
      expect(profile.bio.length).toBe(160);
      expect(profile.timezone).toBe('Asia/Kolkata');
    });
  });
});


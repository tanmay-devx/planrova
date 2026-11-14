import { describe, it, expect } from 'vitest';
import { 
  validateTask, normalizeTask,
  validateNote, normalizeNote,
  validateHabit, normalizeHabit,
  validateExpense, normalizeExpense, toMinorUnits, toMajorUnits,
  validateReminder, normalizeReminder,
  validateCalendarEvent, normalizeCalendarEvent
} from '../shared/domain/index.js';

describe('Canonical Domain Schemas & Validation', () => {
  describe('Task Schema', () => {
    it('validates a correct task object', () => {
      const valid = {
        id: 'task_1',
        title: 'Complete DBMS Assignment',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-11-15',
        startTime: '10:00',
        endTime: '12:00',
        linkedNoteIds: ['note_1']
      };
      const res = validateTask(valid);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
    });

    it('rejects invalid task parameters', () => {
      const invalid = {
        id: 123, // not string
        title: '', // empty title
        status: 'invalid_status',
        dueDate: '15-11-2026' // wrong format
      };
      const res = validateTask(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });

    it('normalizes legacy task objects and preserves backward compatibility', () => {
      const legacy = {
        id: 't_123',
        title: 'Legacy Task',
        desc: 'Legacy description',
        date: '2026-11-14',
        completed: true,
        customProp: 'keep_me'
      };
      const normalized = normalizeTask(legacy);

      expect(normalized.id).toBe('t_123');
      expect(normalized.status).toBe('completed');
      expect(normalized.completed).toBe(true);
      expect(normalized.description).toBe('Legacy description');
      expect(normalized.desc).toBe('Legacy description');
      expect(normalized.dueDate).toBe('2026-11-14');
      expect(normalized.date).toBe('2026-11-14');
      expect(normalized.customProp).toBe('keep_me');
      expect(Array.isArray(normalized.linkedNoteIds)).toBe(true);
      expect(normalized.schemaVersion).toBe(1);
    });
  });

  describe('Note Schema', () => {
    it('validates a note object and handles text content', () => {
      const note = {
        id: 'note_1',
        title: 'TCP vs UDP',
        content: '<p>TCP is connection-oriented</p>',
        format: 'html',
        linkedTaskIds: ['task_1']
      };
      const res = validateNote(note);
      expect(res.valid).toBe(true);
    });

    it('normalizes a note and extracts plain text preview', () => {
      const raw = {
        date: '2026-11-14',
        content: '<h1>Operating Systems</h1><p>Process vs Thread</p>',
        linkedTasks: ['t1', 't2']
      };
      const normalized = normalizeNote(raw);
      expect(normalized.id).toBe('2026-11-14');
      expect(normalized.text).toBe('Operating SystemsProcess vs Thread');
      expect(normalized.linkedTaskIds).toContain('t1');
      expect(normalized.linkedTasks).toContain('t2');
      expect(normalized.schemaVersion).toBe(1);
    });
  });

  describe('Expense Schema', () => {
    it('validates minor units and currencies', () => {
      const valid = {
        id: 'exp_1',
        amountMinor: 15000,
        currency: 'INR',
        date: '2026-11-14'
      };
      expect(validateExpense(valid).valid).toBe(true);

      const invalid = {
        id: 'exp_2',
        amountMinor: 150.50, // not integer minor unit
        currency: 'INR'
      };
      expect(validateExpense(invalid).valid).toBe(false);
    });

    it('converts between major and minor units accurately', () => {
      expect(toMinorUnits(150.50)).toBe(15050);
      expect(toMinorUnits('49.99')).toBe(4999);
      expect(toMajorUnits(15050)).toBe(150.5);
    });

    it('normalizes legacy expenses with float amount', () => {
      const legacy = {
        amount: 80.5,
        desc: 'Chai & Snacks',
        category: 'Food'
      };
      const normalized = normalizeExpense(legacy);
      expect(normalized.amountMinor).toBe(8050);
      expect(normalized.amount).toBe(80.5);
      expect(normalized.description).toBe('Chai & Snacks');
    });
  });

  describe('Reminder & Calendar Event Schemas', () => {
    it('validates and normalizes reminders with target timestamps', () => {
      const raw = {
        title: 'Submit Assignment',
        dueDate: '2026-11-15',
        dueTime: '18:00'
      };
      const normalized = normalizeReminder(raw);
      expect(validateReminder(normalized).valid).toBe(true);
      expect(typeof normalized.targetTimestamp).toBe('number');
    });

    it('validates and normalizes calendar events', () => {
      const raw = {
        title: 'DBMS Lecture',
        date: '2026-11-15',
        startTime: '10:00',
        endTime: '11:30'
      };
      const normalized = normalizeCalendarEvent(raw);
      expect(validateCalendarEvent(normalized).valid).toBe(true);
      expect(normalized.allDay).toBe(false);
    });
  });
});


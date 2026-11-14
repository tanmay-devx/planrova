import { describe, it, expect } from 'vitest';
import { 
  classifyCapture, 
  parseCapture, 
  normalizeCaptureResult,
  CONFIDENCE_THRESHOLD 
} from '../shared/domain/index.js';

describe('Universal Quick Capture Engine', () => {
  const refDate = new Date(2026, 10, 14, 9, 0, 0); // Saturday 2026-11-14 09:00:00

  describe('Classification Engine', () => {
    it('classifies tasks with action verbs and deadlines', () => {
      const res = classifyCapture('Complete operating systems assignment tomorrow');
      expect(res.suggestedType).toBe('task');
      expect(res.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it('classifies reminders with explicit imperatives', () => {
      const res = classifyCapture('Remind me to call my parents at 8 PM');
      expect(res.suggestedType).toBe('reminder');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('classifies expenses with currency and spending words', () => {
      const res = classifyCapture('Spent 150 rupees on food');
      expect(res.suggestedType).toBe('expense');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);

      const res2 = classifyCapture('Lunch ₹250');
      expect(res2.suggestedType).toBe('expense');
    });

    it('classifies habits with daily cadence indicators', () => {
      const res = classifyCapture('Start reading every morning');
      expect(res.suggestedType).toBe('habit');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('classifies calendar events with event nouns and time ranges', () => {
      const res = classifyCapture('DBMS lecture tomorrow from 10am to 11:30am');
      expect(res.suggestedType).toBe('calendar_event');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('classifies knowledge notes with note prefix or definition cues', () => {
      const res = classifyCapture('Note: TCP is connection oriented whereas UDP is connectionless');
      expect(res.suggestedType).toBe('note');
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('safely routes ambiguous low-confidence input to brain_dump fallback', () => {
      const res = classifyCapture('I have an idea for a new side project someday');
      expect(res.suggestedType).toBe('brain_dump');
      expect(res.needsConfirmation).toBe(true);
    });
  });

  describe('Entity Field Extraction', () => {
    it('extracts task fields with relative dates and priorities', () => {
      const parsed = parseCapture('Finish math homework tomorrow urgent', 'task', refDate);
      expect(parsed.title).toContain('Finish math homework');
      expect(parsed.dueDate).toBe('2026-11-15');
      expect(parsed.priority).toBe('urgent');
    });

    it('extracts Hindi date keywords (kal, parso, baje)', () => {
      const parsed = parseCapture('kal subah 10 baje physics assignment', 'task', refDate);
      expect(parsed.dueDate).toBe('2026-11-15');
      expect(parsed.startTime).toBe('10:00');
    });

    it('extracts expense amounts and categories', () => {
      const parsed = parseCapture('Spent ₹450 on dinner with friends', 'expense', refDate);
      expect(parsed.amountMinor).toBe(45000);
      expect(parsed.amount).toBe(450);
      expect(parsed.category).toBe('Food');
      expect(parsed.currency).toBe('INR');
    });

    it('extracts reminder title, date and time', () => {
      const parsed = parseCapture('Remind me to submit assignment at 8 PM tomorrow', 'reminder', refDate);
      expect(parsed.title).toBe('submit assignment');
      expect(parsed.dueDate).toBe('2026-11-15');
      expect(parsed.dueTime).toBe('20:00');
    });
  });

  describe('Capture Normalization', () => {
    it('normalizes task capture result to valid targetKey and canonical entity', () => {
      const { targetKey, entity } = normalizeCaptureResult('task', {
        title: 'Study OS',
        dueDate: '2026-11-15',
        priority: 'high'
      });
      expect(targetKey).toBe('tasks');
      expect(entity.title).toBe('Study OS');
      expect(entity.status).toBe('todo');
      expect(entity.schemaVersion).toBe(1);
    });

    it('normalizes expense capture to valid minor units', () => {
      const { targetKey, entity } = normalizeCaptureResult('expense', {
        amount: 80,
        amountMinor: 8000,
        currency: 'INR',
        description: 'Snacks'
      });
      expect(targetKey).toBe('expenses');
      expect(entity.amountMinor).toBe(8000);
      expect(entity.amount).toBe(80);
      expect(entity.description).toBe('Snacks');
    });
  });
});


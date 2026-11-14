import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageTask } from '../src/utils/nlp.js';

describe('Natural Language Task Parser (NLP)', () => {
  describe('Special Action Extraction', () => {
    it('parses water intake commands', () => {
      const results = parseNaturalLanguageTask('Log 500ml of water');
      expect(results.length).toBe(1);
      expect(results[0].action).toBe('water');
      expect(results[0].amount).toBe(500);
    });

    it('parses expense logging commands', () => {
      const results = parseNaturalLanguageTask('Spend ₹150 on canteen snacks');
      expect(results.length).toBe(1);
      expect(results[0].action).toBe('expense');
      expect(results[0].amount).toBe(150);
      expect(results[0].notes.toLowerCase()).toContain('canteen');
    });

    it('parses study timer commands', () => {
      const results = parseNaturalLanguageTask('Start a 45 min pomodoro session');
      expect(results.length).toBe(1);
      expect(results[0].action).toBe('timer');
      expect(results[0].duration).toBe(45);
    });
  });

  describe('Multi-Task Splitting', () => {
    it('splits combined sentences on "and", "then", or semicolons', () => {
      const input = 'Submit assignment kal 2pm and Drink 250ml water then Call mom tonight';
      const results = parseNaturalLanguageTask(input);
      expect(results.length).toBe(3);
      expect(results[0].title.toLowerCase()).toContain('submit assignment');
      expect(results[1].action).toBe('water');
      expect(results[2].title.toLowerCase()).toContain('call mom');
    });
  });

  describe('Hindi Date & Time Keyword Support', () => {
    it('understands "kal" as tomorrow', () => {
      const results = parseNaturalLanguageTask('Physics lecture kal at 10am');
      expect(results.length).toBe(1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const y = tomorrow.getFullYear();
      const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const d = String(tomorrow.getDate()).padStart(2, '0');
      expect(results[0].date).toBe(`${y}-${m}-${d}`);
      expect(results[0].startTime).toBe('10:00');
    });

    it('understands "parso" as day after tomorrow', () => {
      const results = parseNaturalLanguageTask('Maths exam parso at 9am');
      expect(results.length).toBe(1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);
      const y = dayAfter.getFullYear();
      const m = String(dayAfter.getMonth() + 1).padStart(2, '0');
      const d = String(dayAfter.getDate()).padStart(2, '0');
      expect(results[0].date).toBe(`${y}-${m}-${d}`);
    });
  });

  describe('Category and Priority Inference', () => {
    it('infers study category from keywords', () => {
      const results = parseNaturalLanguageTask('Study chapter 3 chemistry syllabus');
      expect(results[0].category).toBe('study');
    });

    it('infers high priority from urgent keywords', () => {
      const results = parseNaturalLanguageTask('Urgent critical project submission');
      expect(results[0].priority).toBe('high');
    });
  });
});


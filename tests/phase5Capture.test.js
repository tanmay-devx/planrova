import { describe, it, expect } from 'vitest';
import {
  classifyCapture,
  parseCapture,
  normalizeCaptureResult
} from '../shared/domain/index.js';

describe('Phase 5 Universal Quick Capture Extension', () => {
  const refDate = new Date(2026, 10, 14, 10, 0, 0);

  describe('Finance Intent Classification', () => {
    it('classifies income inputs accurately with high confidence', () => {
      const res = classifyCapture('Received 5000 from internship');
      expect(res.suggestedType).toBe('income');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.needsConfirmation).toBe(false);
    });

    it('classifies budget configuration intents', () => {
      const res = classifyCapture('Set a monthly budget of 6000 for food');
      expect(res.suggestedType).toBe('budget');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.needsConfirmation).toBe(false);
    });

    it('classifies savings goals with recurring frequency', () => {
      const res = classifyCapture('Save 1000 every month for vacation');
      expect(res.suggestedType).toBe('savings_goal');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.needsConfirmation).toBe(false);
    });

    it('flags ambiguous savings input as requiring confirmation', () => {
      const res = classifyCapture('Save 1000');
      expect(res.suggestedType).toBe('savings_goal');
      expect(res.needsConfirmation).toBe(true);
    });

    it('flags ambiguous bare expense as requiring confirmation', () => {
      const res = classifyCapture('Paid 500');
      expect(res.suggestedType).toBe('expense');
      expect(res.needsConfirmation).toBe(true);
    });
  });

  describe('Wellbeing Intent Classification', () => {
    it('classifies hydration with liquid volume accurately', () => {
      const res = classifyCapture('Drink 300 ml water');
      expect(res.suggestedType).toBe('hydration');
      expect(res.confidence).toBeGreaterThanOrEqual(0.95);
      expect(res.needsConfirmation).toBe(false);
    });

    it('flags hydration without volume as requiring confirmation', () => {
      const res = classifyCapture('Drink water');
      expect(res.suggestedType).toBe('hydration');
      expect(res.needsConfirmation).toBe(true);
    });

    it('classifies personal routine inputs', () => {
      const res = classifyCapture('Add my evening routine');
      expect(res.suggestedType).toBe('routine');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.needsConfirmation).toBe(false);
    });
  });

  describe('Field Extraction & Normalization', () => {
    it('extracts income fields and normalizes to finance_transactions', () => {
      const parsed = parseCapture('Received ₹5000 from internship', 'income', refDate);
      expect(parsed.amountMinor).toBe(500000);
      expect(parsed.amount).toBe(5000);
      expect(parsed.currency).toBe('INR');

      const { targetKey, entity } = normalizeCaptureResult('income', parsed, 'Received ₹5000 from internship');
      expect(targetKey).toBe('finance_transactions');
      expect(entity.type).toBe('income');
      expect(entity.amountMinor).toBe(500000);
    });

    it('extracts budget fields and normalizes to finance_budgets', () => {
      const parsed = parseCapture('Set a monthly budget of 6000 for food', 'budget', refDate);
      expect(parsed.limitMinor).toBe(600000);
      expect(parsed.period).toBe('monthly');
      expect(parsed.category).toBe('Food');

      const { targetKey, entity } = normalizeCaptureResult('budget', parsed, 'Set a monthly budget of 6000 for food');
      expect(targetKey).toBe('finance_budgets');
      expect(entity.limitMinor).toBe(600000);
      expect(entity.period).toBe('monthly');
    });

    it('extracts hydration fields and normalizes to hydration_logs', () => {
      const parsed = parseCapture('Drink 500 ml water', 'hydration', refDate);
      expect(parsed.amountMl).toBe(500);
      expect(parsed.beverageType).toBe('water');

      const { targetKey, entity } = normalizeCaptureResult('hydration', parsed, 'Drink 500 ml water');
      expect(targetKey).toBe('hydration_logs');
      expect(entity.amountMl).toBe(500);
    });

    it('extracts routine fields and normalizes to wellbeing_routines', () => {
      const parsed = parseCapture('Add my evening routine', 'routine', refDate);
      expect(parsed.type).toBe('evening');

      const { targetKey, entity } = normalizeCaptureResult('routine', parsed, 'Add my evening routine');
      expect(targetKey).toBe('wellbeing_routines');
      expect(entity.type).toBe('evening');
    });
  });
});


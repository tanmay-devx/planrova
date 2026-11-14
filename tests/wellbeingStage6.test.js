import { describe, it, expect } from 'vitest';
import {
  normalizeHydrationLog,
  validateHydrationLog,
  normalizeWellbeingCheckIn,
  validateWellbeingCheckIn,
  normalizeRoutine,
  validateRoutine,
  evaluateRoutineProgress,
  toggleRoutineStep
} from '../shared/domain/wellbeing/index.js';

describe('Wellbeing Domain - Stage 6: Schemas, Validation & Routine Execution', () => {
  describe('HydrationLog Validation & Normalization', () => {
    it('normalizes hydration log with milliliters and dateKey', () => {
      const log = normalizeHydrationLog({
        amount: 300,
        beverageType: 'water',
        date: '2026-11-14'
      }, 'user_123');

      expect(log.amountMl).toBe(300);
      expect(log.dateKey).toBe('2026-11-14');
      expect(log.beverageType).toBe('water');

      const val = validateHydrationLog(log);
      expect(val.valid).toBe(true);
    });

    it('rejects invalid hydration log without volume', () => {
      const val = validateHydrationLog({ id: 'h1', userId: 'u1', amountMl: 0 });
      expect(val.valid).toBe(false);
    });
  });

  describe('WellbeingCheckIn Validation & Normalization', () => {
    it('normalizes lightweight personal check-in', () => {
      const checkIn = normalizeWellbeingCheckIn({
        dateKey: '2026-11-14',
        energyLevel: 4,
        moodLabel: 'good',
        personalNote: 'Had a productive morning study session'
      }, 'user_123');

      expect(checkIn.energyLevel).toBe(4);
      expect(checkIn.moodLabel).toBe('good');
      expect(checkIn.personalNote).toContain('productive morning');

      const val = validateWellbeingCheckIn(checkIn);
      expect(val.valid).toBe(true);
    });

    it('clamps or defaults invalid energy level', () => {
      const checkIn = normalizeWellbeingCheckIn({ energyLevel: 9 }, 'user_123');
      expect(checkIn.energyLevel).toBe(3); // default neutral 3
    });
  });

  describe('Routine Normalization & Progress Evaluation', () => {
    it('normalizes routine with ordered steps and computes duration', () => {
      const routine = normalizeRoutine({
        title: 'Morning Momentum',
        type: 'morning',
        steps: [
          { id: 's1', title: '500ml Water', durationMinutes: 5, isCompleted: true },
          { id: 's2', title: 'Stretching', durationMinutes: 10, isCompleted: false },
          { id: 's3', title: 'Review Tasks', durationMinutes: 10, isCompleted: false }
        ]
      }, 'user_123');

      expect(routine.title).toBe('Morning Momentum');
      expect(routine.steps.length).toBe(3);
      expect(routine.estimatedDurationMinutes).toBe(25);

      const val = validateRoutine(routine);
      expect(val.valid).toBe(true);

      const progress = evaluateRoutineProgress(routine);
      expect(progress.totalSteps).toBe(3);
      expect(progress.completedSteps).toBe(1);
      expect(progress.progressPercentage).toBe(33);
      expect(progress.remainingDurationMinutes).toBe(20);
    });

    it('toggles routine step completion cleanly', () => {
      let routine = normalizeRoutine({
        title: 'Evening Routine',
        steps: [{ id: 's1', title: 'Brush teeth', durationMinutes: 5, isCompleted: false }]
      });

      routine = toggleRoutineStep(routine, 's1');
      expect(routine.steps[0].isCompleted).toBe(true);

      routine = toggleRoutineStep(routine, 's1');
      expect(routine.steps[0].isCompleted).toBe(false);
    });
  });
});


/**
 * tests/academicStage4.test.js
 * Stage 4: Assessment & Weighted Grading Engine Verification
 */

import { describe, it, expect } from 'vitest';
import {
  validateCourseAssessmentWeights,
  computeDetailedGradingBreakdown,
  simulateRequiredAssessmentScore,
  ASSESSMENT_STATUSES,
  ASSESSMENT_TYPES
} from '../shared/domain/academic/index.js';

describe('Academic Domain - Stage 4: Assessment & Grading Engine', () => {
  describe('validateCourseAssessmentWeights', () => {
    it('detects complete 100% weights', () => {
      const assessments = [
        { id: '1', weightPercentage: 20 },
        { id: '2', weightPercentage: 30 },
        { id: '3', weightPercentage: 50 }
      ];
      const res = validateCourseAssessmentWeights(assessments);
      expect(res.isComplete).toBe(true);
      expect(res.status).toBe('complete');
      expect(res.totalWeight).toBe(100);
    });

    it('detects underweight and overweight configurations', () => {
      const under = [{ id: '1', weightPercentage: 40 }];
      const resUnder = validateCourseAssessmentWeights(under);
      expect(resUnder.isComplete).toBe(false);
      expect(resUnder.status).toBe('underweight');
      expect(resUnder.diff).toBe(60);

      const over = [
        { id: '1', weightPercentage: 60 },
        { id: '2', weightPercentage: 50 }
      ];
      const resOver = validateCourseAssessmentWeights(over);
      expect(resOver.isComplete).toBe(false);
      expect(resOver.isValid).toBe(false);
      expect(resOver.status).toBe('overweight');
    });
  });

  describe('computeDetailedGradingBreakdown & Drop Lowest Policy', () => {
    it('computes line items and drops lowest quiz score accurately', () => {
      const assessments = [
        // Quiz 1: scored 10/20 (50%) -> lowest quiz
        { id: 'q1', type: ASSESSMENT_TYPES.QUIZ, status: ASSESSMENT_STATUSES.GRADED, totalMarks: 20, obtainedMarks: 10, weightPercentage: 10 },
        // Quiz 2: scored 18/20 (90%)
        { id: 'q2', type: ASSESSMENT_TYPES.QUIZ, status: ASSESSMENT_STATUSES.GRADED, totalMarks: 20, obtainedMarks: 18, weightPercentage: 10 },
        // Midterm: scored 85/100 (85%)
        { id: 'mid', type: ASSESSMENT_TYPES.MIDTERM, status: ASSESSMENT_STATUSES.GRADED, totalMarks: 100, obtainedMarks: 85, weightPercentage: 30 },
        // Final: pending (50% weight)
        { id: 'fin', type: ASSESSMENT_TYPES.FINAL, status: ASSESSMENT_STATUSES.PENDING, totalMarks: 100, weightPercentage: 50 }
      ];

      const breakdown = computeDetailedGradingBreakdown({
        assessments,
        dropLowestPolicy: { type: ASSESSMENT_TYPES.QUIZ, dropCount: 1 }
      });

      expect(breakdown.droppedIds).toEqual(['q1']);
      // Dropped Quiz 1 is marked as isDropped: true
      const itemQ1 = breakdown.items.find(i => i.id === 'q1');
      expect(itemQ1.isDropped).toBe(true);

      // Remaining graded assessments: Quiz 2 (10% weight, scored 90% -> 9 pts) + Midterm (30% weight, scored 85% -> 25.5 pts)
      // Total completed weight = 40% (since q1 was dropped)
      // Total earned contribution = 9 + 25.5 = 34.5 pts
      expect(breakdown.completedWeight).toBe(40);
      expect(breakdown.completedContribution).toBe(34.5);
      // Current standing percentage: 34.5 / 40 * 100 = 86.25%
      expect(breakdown.currentScorePercent).toBe(86.25);
      expect(breakdown.currentLetter).toBe('B');
    });
  });

  describe('simulateRequiredAssessmentScore (What-If Simulation)', () => {
    const assessments = [
      // Completed: 40% of grade, earned 34.0 points (standing = 85%)
      { id: 'mid', status: ASSESSMENT_STATUSES.GRADED, totalMarks: 100, obtainedMarks: 85, weightPercentage: 40 },
      // Pending: Final Exam (60% of grade)
      { id: 'fin', status: ASSESSMENT_STATUSES.PENDING, totalMarks: 100, weightPercentage: 60 }
    ];

    it('calculates achievable required score on final exam', () => {
      // User wants 90% overall course grade (need 90 - 34 = 56 points from 60% final)
      // Required on final: 56 / 60 * 100 = 93.33%
      const sim = simulateRequiredAssessmentScore({
        assessments,
        targetPercentage: 90
      });

      expect(sim.isAchievable).toBe(true);
      expect(sim.requiredPercentage).toBe(93.33);
    });

    it('detects impossible target grade exceeding 100%', () => {
      // User wants 96% overall course grade (need 96 - 34 = 62 points from 60% final)
      // Required on final: 62 / 60 * 100 = 103.33% -> impossible!
      const sim = simulateRequiredAssessmentScore({
        assessments,
        targetPercentage: 96
      });

      expect(sim.isAchievable).toBe(false);
      expect(sim.requiredPercentage).toBe(103.33);
      expect(sim.reason).toContain('unachievable');
    });
  });
});


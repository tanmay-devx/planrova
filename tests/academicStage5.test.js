/**
 * tests/academicStage5.test.js
 * Stage 5: GPA Calculator & Target Simulator Verification
 */

import { describe, it, expect } from 'vitest';
import {
  computeSemesterGPA,
  computeCumulativeGPA,
  simulateMultiSemesterTarget,
  GRADING_SCALE_TYPES
} from '../shared/domain/academic/index.js';

describe('Academic Domain - Stage 5: GPA Engine & Target Simulator', () => {
  describe('computeSemesterGPA', () => {
    it('calculates credit-weighted SGPA and per-course quality points', () => {
      const courses = [
        // CS 101: 4 credits, grade point 4.0 -> 16.0 QP
        { id: 'cs101', name: 'CS 101', credits: 4, gradePoints: 4.0, letter: 'A' },
        // MATH 201: 3 credits, grade point 3.0 -> 9.0 QP
        { id: 'math201', name: 'MATH 201', credits: 3, gradePoints: 3.0, letter: 'B' },
        // PHYS 101: 3 credits, grade point 3.3 -> 9.9 QP
        { id: 'phys101', name: 'PHYS 101', credits: 3, gradePoints: 3.3, letter: 'B+' }
      ];

      // Total QP: 16.0 + 9.0 + 9.9 = 34.9 QP / 10 credits = 3.49 SGPA
      const res = computeSemesterGPA({ courses, gradingScale: GRADING_SCALE_TYPES.LETTER_4_0 });
      expect(res.totalCredits).toBe(10);
      expect(res.gradedCredits).toBe(10);
      expect(res.totalQualityPoints).toBe(34.9);
      expect(res.sgpa).toBe(3.49);
      expect(res.courseBreakdowns).toHaveLength(3);
      expect(res.courseBreakdowns[0].qualityPoints).toBe(16.0);
    });
  });

  describe('computeCumulativeGPA', () => {
    it('calculates cumulative CGPA across historical semesters', () => {
      const historicalSemesters = [
        { id: 'sem1', name: 'Semester 1', credits: 16, sgpa: 3.8 }, // 60.8 QP
        { id: 'sem2', name: 'Semester 2', credits: 14, sgpa: 3.2 }  // 44.8 QP
      ];
      // Total credits = 30, Total QP = 105.6 -> CGPA = 105.6 / 30 = 3.52
      const res = computeCumulativeGPA(historicalSemesters);
      expect(res.totalCumulativeCredits).toBe(30);
      expect(res.totalQualityPoints).toBe(105.6);
      expect(res.cgpa).toBe(3.52);
    });
  });

  describe('simulateMultiSemesterTarget', () => {
    it('simulates uniform required SGPA across multiple upcoming semesters', () => {
      // Completed 30 credits with 3.2 CGPA (96.0 QP)
      // Planning 2 upcoming semesters of 15 credits each (30 upcoming credits, total 60 credits)
      // Target CGPA: 3.5 across 60 credits requires 210 QP
      // Points needed from upcoming = 210 - 96 = 114 QP
      // Required uniform SGPA = 114 / 30 = 3.80 (feasible on 4.0 scale)
      const sim = simulateMultiSemesterTarget({
        currentCGPA: 3.2,
        completedCredits: 30,
        upcomingSemesters: [
          { name: 'Fall 2026', credits: 15 },
          { name: 'Spring 2027', credits: 15 }
        ],
        targetCGPA: 3.5,
        gradingScale: GRADING_SCALE_TYPES.LETTER_4_0
      });

      expect(sim.isFeasible).toBe(true);
      expect(sim.requiredSGPA).toBe(3.8);
      expect(sim.totalUpcomingCredits).toBe(30);
      expect(sim.semesterTargets).toHaveLength(2);
      expect(sim.semesterTargets[0].requiredSGPA).toBe(3.8);
    });

    it('identifies mathematically impossible target and returns maximum achievable CGPA', () => {
      // Completed 60 credits with 2.8 CGPA (168 QP)
      // Upcoming 15 credits (total 75 credits)
      // Target: 3.8 across 75 credits requires 285 QP
      // Points needed = 285 - 168 = 117 QP -> SGPA needed = 117 / 15 = 7.8 (impossible on 4.0 scale!)
      // Max possible if student gets 4.0 on all 15 credits: (168 + 60) / 75 = 228 / 75 = 3.04 CGPA
      const sim = simulateMultiSemesterTarget({
        currentCGPA: 2.8,
        completedCredits: 60,
        upcomingSemesters: 15,
        targetCGPA: 3.8,
        gradingScale: GRADING_SCALE_TYPES.LETTER_4_0
      });

      expect(sim.isFeasible).toBe(false);
      expect(sim.maxPossibleCGPA).toBe(3.04);
      expect(sim.reason).toContain('impossible');
    });
  });
});


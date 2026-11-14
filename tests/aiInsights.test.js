/**
 * tests/aiInsights.test.js
 * Stage 7 — Personal Insights Engine & Cross-Domain Pattern Detection Tests
 */

import { describe, it, expect } from 'vitest';
import {
  INSIGHT_TYPES,
  INSIGHT_DOMAINS,
  INSIGHT_IMPACTS,
  analyzeStudyAcademicCorrelation,
  analyzeWellbeingProductivityCorrelation,
  analyzeSpendingPatterns,
  analyzeProjectPacing,
  generatePersonalInsights
} from '../shared/domain/ai/ai.insights.js';

describe('Stage 7 — AI Personal Insights Engine & Pattern Detection', () => {

  describe('1. Study & Academic Performance Correlation', () => {
    it('detects strong correlation between focus study hours and assessment scores', () => {
      const courses = [
        { id: 'c1', name: 'CS 101: Data Structures' },
        { id: 'c2', name: 'MATH 201: Linear Algebra' }
      ];

      // 120 mins on CS 101, 30 mins on MATH 201
      const pomodoros = [
        { courseId: 'c1', durationMinutes: 60, status: 'completed' },
        { courseId: 'c1', durationMinutes: 60, status: 'completed' },
        { courseId: 'c2', durationMinutes: 30, status: 'completed' }
      ];

      // CS 101 scores = 90%, MATH 201 scores = 70%
      const assessments = [
        { id: 'a1', courseId: 'c1', score: 90, maxScore: 100, status: 'graded' },
        { id: 'a2', courseId: 'c2', score: 70, maxScore: 100, status: 'graded' }
      ];

      const insights = analyzeStudyAcademicCorrelation({
        courses,
        pomodoros,
        assessments,
        now: new Date('2026-11-15T12:00:00Z')
      });

      expect(insights.length).toBeGreaterThan(0);
      const studyCorr = insights.find(i => i.type === INSIGHT_TYPES.ACADEMIC_STUDY_CORRELATION);
      expect(studyCorr).toBeDefined();
      expect(studyCorr.domain).toBe(INSIGHT_DOMAINS.ACADEMIC);
      expect(studyCorr.impact).toBe(INSIGHT_IMPACTS.HIGH);
      expect(studyCorr.dataPoints.highStudyAvg).toBe(90);
      expect(studyCorr.dataPoints.lowStudyAvg).toBe(70);
      expect(studyCorr.dataPoints.deltaPct).toBe(20);
      expect(studyCorr.evidence).toContain('90.0% on assessments');
    });

    it('flags upcoming assessment with low preparation deficit', () => {
      const courses = [{ id: 'c1', name: 'Calculus III' }];
      const pomodoros = [{ courseId: 'c1', durationMinutes: 15, status: 'completed' }];
      const assessments = [
        {
          id: 'exam-1',
          courseId: 'c1',
          title: 'Midterm Exam',
          dueDate: '2026-11-18T10:00:00Z', // 3 days away
          status: 'pending'
        }
      ];

      const insights = analyzeStudyAcademicCorrelation({
        courses,
        pomodoros,
        assessments,
        now: new Date('2026-11-15T10:00:00Z')
      });

      const prepDeficit = insights.find(i => i.type === INSIGHT_TYPES.ACADEMIC_PREPARATION_DEFICIT);
      expect(prepDeficit).toBeDefined();
      expect(prepDeficit.dataPoints.daysRemaining).toBe(3);
      expect(prepDeficit.dataPoints.focusMinutesLogged).toBe(15);
      expect(prepDeficit.evidence).toContain('Midterm Exam');
    });
  });

  describe('2. Wellbeing & Productivity Correlation', () => {
    it('correlates hydration target achievement with higher task completion rates', () => {
      // 2 hydrated days (met target of 2000ml) with high completion
      // 2 dehydrated days (< 2000ml) with lower completion
      const hydration = [
        { date: '2026-11-10', amountMl: 2500 },
        { date: '2026-11-11', amountMl: 2200 },
        { date: '2026-11-12', amountMl: 500 },
        { date: '2026-11-13', amountMl: 800 }
      ];

      const tasks = [
        // Day 10: 3 of 3 completed (100%)
        { dueDate: '2026-11-10', completed: true },
        { dueDate: '2026-11-10', completed: true },
        { dueDate: '2026-11-10', completed: true },
        // Day 11: 2 of 2 completed (100%)
        { dueDate: '2026-11-11', completed: true },
        { dueDate: '2026-11-11', completed: true },
        // Day 12: 1 of 3 completed (33.3%)
        { dueDate: '2026-11-12', completed: true },
        { dueDate: '2026-11-12', completed: false },
        { dueDate: '2026-11-12', completed: false },
        // Day 13: 1 of 2 completed (50%)
        { dueDate: '2026-11-13', completed: true },
        { dueDate: '2026-11-13', completed: false }
      ];

      const insights = analyzeWellbeingProductivityCorrelation({
        tasks,
        hydration,
        targetMl: 2000,
        now: new Date('2026-11-15T12:00:00Z')
      });

      expect(insights.length).toBe(1);
      const wellInsight = insights[0];
      expect(wellInsight.type).toBe(INSIGHT_TYPES.WELLBEING_PRODUCTIVITY_CORRELATION);
      expect(wellInsight.domain).toBe(INSIGHT_DOMAINS.WELLBEING);
      expect(wellInsight.dataPoints.hydratedAvgPct).toBe(100);
      expect(wellInsight.dataPoints.deltaPct).toBeGreaterThan(40);
    });
  });

  describe('3. Financial Spending Pattern Diagnostics', () => {
    it('detects weekend spending bursts', () => {
      // 2026-11-13 is Friday, 2026-11-14 is Saturday, 2026-11-15 is Sunday
      // 2026-11-10 is Tuesday, 2026-11-11 is Wednesday, 2026-11-12 is Thursday
      const transactions = [
        { date: '2026-11-10T10:00:00Z', amount: -20, type: 'expense' },
        { date: '2026-11-11T12:00:00Z', amount: -25, type: 'expense' },
        { date: '2026-11-12T14:00:00Z', amount: -15, type: 'expense' },
        { date: '2026-11-13T19:00:00Z', amount: -90, type: 'expense' }, // Fri
        { date: '2026-11-14T15:00:00Z', amount: -110, type: 'expense' }, // Sat
        { date: '2026-11-15T18:00:00Z', amount: -75, type: 'expense' }  // Sun
      ];

      const insights = analyzeSpendingPatterns({
        transactions,
        now: new Date('2026-11-15T20:00:00Z')
      });

      expect(insights.length).toBe(1);
      const finInsight = insights[0];
      expect(finInsight.type).toBe(INSIGHT_TYPES.FINANCIAL_SPENDING_BURST);
      expect(finInsight.domain).toBe(INSIGHT_DOMAINS.FINANCE);
      expect(finInsight.dataPoints.avgWeekend).toBeCloseTo(91.67, 1);
      expect(finInsight.dataPoints.avgWeekday).toBe(20);
      expect(finInsight.dataPoints.multiplier).toBeGreaterThanOrEqual(4);
    });
  });

  describe('4. Project Milestone & Deadline Pacing', () => {
    it('detects velocity pressure when project has imminent deadline with remaining tasks', () => {
      const projects = [
        {
          id: 'proj-1',
          title: 'Planrova 2.0 Launch',
          targetDate: '2026-11-18T12:00:00Z', // 3 days away
          status: 'in_progress'
        }
      ];

      const tasks = [
        { id: 't1', projectId: 'proj-1', completed: false, status: 'pending' },
        { id: 't2', projectId: 'proj-1', completed: false, status: 'pending' },
        { id: 't3', projectId: 'proj-1', completed: false, status: 'pending' },
        { id: 't4', projectId: 'proj-1', completed: true, status: 'completed' }
      ];

      const insights = analyzeProjectPacing({
        projects,
        tasks,
        now: new Date('2026-11-15T12:00:00Z')
      });

      expect(insights.length).toBe(1);
      const projInsight = insights[0];
      expect(projInsight.type).toBe(INSIGHT_TYPES.DEADLINE_PACING_PRESSURE);
      expect(projInsight.dataPoints.remainingTasksCount).toBe(3);
      expect(projInsight.dataPoints.daysRemaining).toBe(3);
    });
  });

  describe('5. Unified Pipeline & Aggregation', () => {
    it('aggregates and prioritizes multi-domain insights gracefully', () => {
      const result = generatePersonalInsights({
        courses: [{ id: 'c1', name: 'CS 101' }, { id: 'c2', name: 'MATH 101' }],
        pomodoros: [
          { courseId: 'c1', durationMinutes: 120, status: 'completed' },
          { courseId: 'c2', durationMinutes: 20, status: 'completed' }
        ],
        assessments: [
          { courseId: 'c1', score: 95, maxScore: 100, status: 'graded' },
          { courseId: 'c2', score: 65, maxScore: 100, status: 'graded' }
        ],
        projects: [
          {
            id: 'proj-x',
            title: 'Term Paper',
            targetDate: '2026-11-17T00:00:00Z',
            status: 'in_progress'
          }
        ],
        tasks: [
          { projectId: 'proj-x', completed: false },
          { projectId: 'proj-x', completed: false }
        ],
        now: new Date('2026-11-15T00:00:00Z')
      });

      expect(result.insights.length).toBeGreaterThanOrEqual(2);
      expect(result.summary.total).toBe(result.insights.length);
      expect(result.summary.highImpactCount).toBeGreaterThanOrEqual(1);
      // High impact must be prioritized at the beginning
      expect(result.insights[0].impact).toBe(INSIGHT_IMPACTS.HIGH);
    });

    it('handles empty inputs safely without throwing or producing NaN', () => {
      const result = generatePersonalInsights();
      expect(result.insights).toEqual([]);
      expect(result.summary.total).toBe(0);
      expect(result.summary.highImpactCount).toBe(0);
    });
  });
});

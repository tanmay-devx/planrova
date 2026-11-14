import { describe, it, expect } from 'vitest';
import {
  analyzeWorkload,
  calculateCognitiveLoad,
  assessFatigueRisk,
  generateWorkloadRecommendations,
  generateSmartBuffers,
  generateScheduleProposal,
  WORKLOAD_CLASSIFICATIONS
} from '../shared/domain/scheduling/index.js';

describe('Stage 5: Workload Intelligence & Smart Buffers', () => {
  describe('Cognitive Load Scoring & Fatigue Risk', () => {
    it('calculates higher cognitive load for long deep focus sessions with urgent tasks and back-to-back blocks', () => {
      const tasks = [
        { id: 't_deep1', title: 'Deep Architecture Design', priority: 'urgent' },
        { id: 't_deep2', title: 'Compiler Optimization', priority: 'urgent' },
        { id: 't_deep3', title: 'Security Audit', priority: 'high' }
      ];

      // 3 long back-to-back 90m blocks with 0m gap
      const highStrainBlocks = [
        { id: 'b1', blockType: 'task', sourceEntityId: 't_deep1', startTime: '09:00', endTime: '10:30', durationMinutes: 90 },
        { id: 'b2', blockType: 'task', sourceEntityId: 't_deep2', startTime: '10:30', endTime: '12:00', durationMinutes: 90 },
        { id: 'b3', blockType: 'task', sourceEntityId: 't_deep3', startTime: '12:00', endTime: '13:30', durationMinutes: 90 }
      ];

      const highStrainScore = calculateCognitiveLoad(highStrainBlocks, tasks);
      expect(highStrainScore).toBeGreaterThanOrEqual(60);

      const fatigueRisk = assessFatigueRisk(0.85, highStrainScore);
      expect(fatigueRisk).toBe('high');
    });

    it('calculates lower cognitive load for light, well-spaced, low-priority tasks', () => {
      const tasks = [
        { id: 't_light1', title: 'Check Emails', priority: 'low' },
        { id: 't_light2', title: 'Update JIRA', priority: 'low' }
      ];

      // 2 short 30m blocks separated by 60 min
      const lightBlocks = [
        { id: 'b1', blockType: 'task', sourceEntityId: 't_light1', startTime: '09:00', endTime: '09:30', durationMinutes: 30 },
        { id: 'b2', blockType: 'task', sourceEntityId: 't_light2', startTime: '10:30', endTime: '11:00', durationMinutes: 30 }
      ];

      const lightScore = calculateCognitiveLoad(lightBlocks, tasks);
      expect(lightScore).toBeLessThan(35);

      const fatigueRisk = assessFatigueRisk(0.25, lightScore);
      expect(fatigueRisk).toBe('low');
    });
  });

  describe('analyzeWorkload', () => {
    it('classifies workload into light, balanced, heavy, and overloaded based on flexible capacity', () => {
      // Day has 540 min total, 60 min fixed, 60 min break -> Flexible capacity = 420 min.
      const baseParams = {
        targetDate: '2026-11-16',
        totalAvailableMinutes: 540,
        fixedCommitmentMinutes: 60,
        reservedBreakMinutes: 60
      };

      // Light (< 40% of 420m = < 168m)
      const lightAnalysis = analyzeWorkload({
        ...baseParams,
        blocks: [{ blockType: 'task', startTime: '09:00', endTime: '10:30', durationMinutes: 90 }]
      });
      expect(lightAnalysis.classification).toBe(WORKLOAD_CLASSIFICATIONS.LIGHT);
      expect(lightAnalysis.capacityUtilization).toBeCloseTo(90 / 420, 2);

      // Balanced (40% to 80% of 420m = 168m to 336m)
      const balancedAnalysis = analyzeWorkload({
        ...baseParams,
        blocks: [{ blockType: 'task', startTime: '09:00', endTime: '13:00', durationMinutes: 240 }]
      });
      expect(balancedAnalysis.classification).toBe(WORKLOAD_CLASSIFICATIONS.BALANCED);

      // Heavy (80% to 100% of 420m = 336m to 420m)
      const heavyAnalysis = analyzeWorkload({
        ...baseParams,
        blocks: [{ blockType: 'task', startTime: '09:00', endTime: '15:00', durationMinutes: 360 }]
      });
      expect(heavyAnalysis.classification).toBe(WORKLOAD_CLASSIFICATIONS.HEAVY);

      // Overloaded (> 100% of 420m = > 420m)
      const overloadedAnalysis = analyzeWorkload({
        ...baseParams,
        blocks: [{ blockType: 'task', startTime: '09:00', endTime: '17:00', durationMinutes: 480 }]
      });
      expect(overloadedAnalysis.classification).toBe(WORKLOAD_CLASSIFICATIONS.OVERLOADED);
      expect(overloadedAnalysis.capacityUtilization).toBeGreaterThan(1.0);
    });

    it('generates actionable recommendations for overloaded and tight schedules', () => {
      const recommendations = generateWorkloadRecommendations({
        classification: WORKLOAD_CLASSIFICATIONS.OVERLOADED,
        capacityUtilization: 1.15,
        cognitiveLoadScore: 85,
        fatigueRisk: 'high',
        unallocatedMinutes: 0,
        unscheduledTasks: [{ taskId: 't1', title: 'Task 1' }],
        backToBackCount: 3
      });

      expect(recommendations.length).toBeGreaterThanOrEqual(3);
      expect(recommendations.some(r => r.action === 'reschedule')).toBe(true);
      expect(recommendations.some(r => r.action === 'rest')).toBe(true);
      expect(recommendations.some(r => r.action === 'spacing')).toBe(true);
    });
  });

  describe('generateSmartBuffers', () => {
    it('creates an exam prep buffer before an examination block', () => {
      const targetDate = '2026-11-16';
      const blocks = [
        { id: 'b_exam', title: 'Midterm Exam: Algorithms', startTime: '14:00', endTime: '16:00', durationMinutes: 120, blockType: 'fixed_event', isFixed: true }
      ];

      const buffers = generateSmartBuffers({
        targetDate,
        blocks,
        preferences: { breakBetweenSessionsMinutes: 10 }
      });

      expect(buffers.length).toBeGreaterThanOrEqual(1);
      const examBuf = buffers.find(b => b.blockType === 'buffer' && b.title.includes('Prep & Review'));
      expect(examBuf).toBeDefined();
      expect(examBuf.startTime).toBe('13:30');
      expect(examBuf.endTime).toBe('14:00');
      expect(examBuf.durationMinutes).toBe(30);
      expect(examBuf.isFixed).toBe(false);
    });

    it('places transition buffers between demanding consecutive tasks when gap is available', () => {
      const targetDate = '2026-11-16';
      // Task 1: 09:00 - 10:00 (60m). Gap 10:00 - 10:30 (30m). Task 2: 10:30 - 11:30 (60m).
      const blocks = [
        { id: 'b_t1', title: 'Task 1', startTime: '09:00', endTime: '10:00', durationMinutes: 60, blockType: 'task' },
        { id: 'b_t2', title: 'Task 2', startTime: '10:30', endTime: '11:30', durationMinutes: 60, blockType: 'task' }
      ];

      const buffers = generateSmartBuffers({
        targetDate,
        blocks,
        preferences: { breakBetweenSessionsMinutes: 15 }
      });

      const transBuf = buffers.find(b => b.blockType === 'buffer' && b.title.includes('Transition'));
      expect(transBuf).toBeDefined();
      expect(transBuf.startTime).toBe('10:00');
      expect(transBuf.endTime).toBe('10:15');
      expect(transBuf.durationMinutes).toBe(15);
    });

    it('prevents overlapping buffers with existing occupied intervals', () => {
      const targetDate = '2026-11-16';
      // Lecture immediately prior to exam (13:00 - 14:00, then Exam 14:00 - 16:00).
      // Buffer cannot fit in 13:30 - 14:00 because lecture occupies it.
      const blocks = [
        { id: 'b_lec', title: 'Lecture', startTime: '13:00', endTime: '14:00', durationMinutes: 60, blockType: 'lecture', isFixed: true },
        { id: 'b_exam', title: 'Final Exam', startTime: '14:00', endTime: '16:00', durationMinutes: 120, blockType: 'fixed_event', isFixed: true }
      ];

      const buffers = generateSmartBuffers({
        targetDate,
        blocks
      });

      // Should not create an overlapping prep buffer in 13:30 - 14:00
      const overlappingPrep = buffers.find(b => b.startTime === '13:30');
      expect(overlappingPrep).toBeUndefined();
    });
  });

  describe('Integrated Proposal Workload & Buffers', () => {
    it('automatically includes workload recommendations and buffers in proposal output', () => {
      const targetDate = '2026-11-16';
      const sampleAvailability = {
        userId: 'user_stage5',
        defaultWorkingHours: { start: '09:00', end: '18:00' },
        preferences: {
          lunchBreak: { start: '13:00', end: '14:00', enabled: true },
          breakBetweenSessionsMinutes: 10
        }
      };

      const fixedEvents = [
        { id: 'ev_exam', title: 'Midterm Exam: Physics', startTime: '15:00', endTime: '17:00', isFixed: true }
      ];

      const tasks = [
        { id: 'tk_urgent', title: 'Critical Presentation', estimatedMinutes: 60, priority: 'urgent', dueDate: '2026-11-16', deadlineTime: '12:00' }
      ];

      const proposal = generateScheduleProposal({
        targetDate,
        tasks,
        fixedEvents,
        userAvailability: sampleAvailability
      });

      expect(proposal.workload.recommendations).toBeDefined();
      expect(Array.isArray(proposal.workload.recommendations)).toBe(true);
      expect(proposal.workload.cognitiveLoadScore).toBeDefined();
      expect(proposal.workload.fatigueRisk).toBeDefined();

      // Check that buffers were generated (e.g. exam prep buffer before 15:00)
      expect(proposal.buffers.length).toBeGreaterThanOrEqual(1);
      expect(proposal.buffers.some(b => b.title.includes('Prep & Review'))).toBe(true);
    });
  });
});


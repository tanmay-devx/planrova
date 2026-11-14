import { describe, it, expect } from 'vitest';
import {
  rankTasksForScheduling,
  scoreCandidateSlot,
  generateScheduleProposal,
  PROPOSAL_STATUSES,
  ALGORITHM_VERSION
} from '../shared/domain/scheduling/index.js';

describe('Stage 4: Deterministic Scheduling Engine & Scoring', () => {
  const sampleAvailability = {
    userId: 'user_test_stage4',
    timezone: 'Asia/Kolkata',
    workingHours: {
      monday: { start: '09:00', end: '18:00', active: true },
      tuesday: { start: '09:00', end: '18:00', active: true },
      wednesday: { start: '09:00', end: '18:00', active: true },
      thursday: { start: '09:00', end: '18:00', active: true },
      friday: { start: '09:00', end: '18:00', active: true },
      saturday: { start: '10:00', end: '14:00', active: true },
      sunday: { start: '09:00', end: '18:00', active: false }
    },
    preferences: {
      focusHours: { start: '10:00', end: '12:00' },
      lunchBreak: { start: '13:00', end: '14:00', enabled: true },
      minSessionMinutes: 30,
      maxSessionMinutes: 120,
      allowTaskSplitting: true
    }
  };

  describe('Task Ranking & Prioritization Queue', () => {
    it('ranks tasks by deadline urgency first, then priority, then duration', () => {
      const targetDate = '2026-11-16'; // Monday
      const tasks = [
        { id: 't_low_today', title: 'Low Due Today', dueDate: '2026-11-16', deadlineTime: '17:00', priority: 'low', estimatedMinutes: 60, createdAt: 10 },
        { id: 't_urgent_tmrw', title: 'Urgent Due Tomorrow', dueDate: '2026-11-17', deadlineTime: '12:00', priority: 'urgent', estimatedMinutes: 60, createdAt: 20 },
        { id: 't_high_today', title: 'High Due Today', dueDate: '2026-11-16', deadlineTime: '17:00', priority: 'high', estimatedMinutes: 60, createdAt: 30 },
        { id: 't_overdue', title: 'Overdue Task', dueDate: '2026-11-15', deadlineTime: '18:00', priority: 'medium', estimatedMinutes: 45, createdAt: 40 }
      ];

      const ranked = rankTasksForScheduling(tasks, targetDate, '18:00');
      
      // Overdue task has highest urgency score (100) -> ranked #1
      expect(ranked[0].task.id).toBe('t_overdue');
      // High Due Today has urgency 60 + priority 30 = 90 -> ranked #2
      expect(ranked[1].task.id).toBe('t_high_today');
      // Urgent Due Tomorrow has urgency 35 + priority 40 = 75 -> ranked #3
      expect(ranked[2].task.id).toBe('t_urgent_tmrw');
      // Low Due Today has urgency 60 + priority 10 = 70 -> ranked #4
      expect(ranked[3].task.id).toBe('t_low_today');
    });

    it('uses duration DESC, creation timestamp ASC, and stable ID as deterministic tie-breakers', () => {
      const targetDate = '2026-11-16';
      const tasks = [
        { id: 'task_b', title: 'Task B 30m', dueDate: '2026-11-16', deadlineTime: '18:00', priority: 'medium', estimatedMinutes: 30, createdAt: 100 },
        { id: 'task_a', title: 'Task A 60m', dueDate: '2026-11-16', deadlineTime: '18:00', priority: 'medium', estimatedMinutes: 60, createdAt: 100 },
        { id: 'task_c', title: 'Task C 30m earlier', dueDate: '2026-11-16', deadlineTime: '18:00', priority: 'medium', estimatedMinutes: 30, createdAt: 50 }
      ];

      const ranked = rankTasksForScheduling(tasks, targetDate, '18:00');
      // All have same urgency (60) + priority (20) = 80 total
      // 1. Task A has 60m duration (longer tasks first to pack bins better)
      expect(ranked[0].task.id).toBe('task_a');
      // 2. Between task_c and task_b (both 30m), task_c was created earlier (createdAt: 50 vs 100)
      expect(ranked[1].task.id).toBe('task_c');
      // 3. task_b is last
      expect(ranked[2].task.id).toBe('task_b');
    });

    it('filters out completed, cancelled, and deleted tasks', () => {
      const targetDate = '2026-11-16';
      const tasks = [
        { id: 't_active', title: 'Active', status: 'pending', estimatedMinutes: 30 },
        { id: 't_done', title: 'Done', status: 'completed', estimatedMinutes: 30 },
        { id: 't_cancelled', title: 'Cancelled', status: 'cancelled', estimatedMinutes: 30 },
        { id: 't_deleted', title: 'Deleted', deleted: true, estimatedMinutes: 30 }
      ];

      const ranked = rankTasksForScheduling(tasks, targetDate, '18:00');
      expect(ranked.length).toBe(1);
      expect(ranked[0].task.id).toBe('t_active');
    });
  });

  describe('Slot Suitability Scoring', () => {
    it('awards high score for slot matching focus hours and adjacent to busy start', () => {
      // Slot 10:00 - 12:00 (600 to 720 min), task 60 min
      const slot = { start: 600, end: 720 };
      const result = scoreCandidateSlot(slot, 60, {
        focusSlot: { start: '10:00', end: '12:00' },
        minSessionMinutes: 30,
        isAdjacentToBusyStart: true
      });

      expect(result.feasible).toBe(true);
      // Full focus match: 40 pts
      expect(result.breakdown.focusScore).toBe(40);
      // Contiguity bonus: > 20 pts
      expect(result.breakdown.contiguityScore).toBeGreaterThanOrEqual(20);
      // Buffer proximity: 20 pts
      expect(result.breakdown.bufferScore).toBe(20);
      // No fragmentation penalty since residual gap is 60m >= 30m
      expect(result.breakdown.fragmentationPenalty).toBe(0);
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('applies fragmentation penalty when placement leaves an orphan gap smaller than minSessionMinutes', () => {
      // Slot: 600 to 675 (75 min). Task: 60 min. Residual gap = 15 min < 30 min minSessionMinutes
      const slot = { start: 600, end: 675 };
      const result = scoreCandidateSlot(slot, 60, {
        minSessionMinutes: 30
      });

      expect(result.feasible).toBe(true);
      // Residual is 15 min. severity = (30 - 15) / 30 = 0.5. Penalty = 0.5 * 25 = 12.5 pts
      expect(result.breakdown.fragmentationPenalty).toBe(12.5);
    });

    it('rejects candidate slots with insufficient capacity', () => {
      const slot = { start: 600, end: 630 }; // 30 min
      const result = scoreCandidateSlot(slot, 60); // needs 60 min
      expect(result.feasible).toBe(false);
      expect(result.score).toBe(-1);
    });
  });

  describe('generateScheduleProposal', () => {
    it('places fixed events, lunch breaks, and schedules flexible tasks around them', () => {
      const targetDate = '2026-11-16'; // Monday
      const fixedEvents = [
        { id: 'fe_lecture', title: 'Data Structures Lecture', startTime: '11:00', endTime: '12:30', isFixed: true }
      ];
      const tasks = [
        { id: 'task_prep', title: 'Prepare Assignment', estimatedMinutes: 60, priority: 'high', dueDate: '2026-11-16', deadlineTime: '17:00' }
      ];

      const proposal = generateScheduleProposal({
        targetDate,
        tasks,
        userAvailability: sampleAvailability,
        fixedEvents
      });

      expect(proposal.status).toBe(PROPOSAL_STATUSES.DRAFT);
      expect(proposal.algorithmVersion).toBe(ALGORITHM_VERSION);
      expect(proposal.proposedBlocks.length).toBeGreaterThanOrEqual(2);

      // Verify fixed event is present and locked
      const lectureBlock = proposal.proposedBlocks.find(b => b.sourceEntityId === 'fe_lecture');
      expect(lectureBlock).toBeDefined();
      expect(lectureBlock.isFixed).toBe(true);
      expect(lectureBlock.startTime).toBe('11:00');
      expect(lectureBlock.endTime).toBe('12:30');

      // Verify task was placed in a free interval (e.g., 09:00 - 10:00 or 10:00 - 11:00)
      const taskBlock = proposal.proposedBlocks.find(b => b.sourceEntityId === 'task_prep');
      expect(taskBlock).toBeDefined();
      expect(taskBlock.durationMinutes).toBe(60);
      expect(taskBlock.isFixed).toBe(false);
      // Ensure it does not overlap 11:00 - 12:30 or lunch 13:00 - 14:00
      expect(taskBlock.endTime <= '11:00' || taskBlock.startTime >= '12:30').toBe(true);
    });

    it('splits a long task into Part 1 and Part 2 when allowSplit is true', () => {
      const targetDate = '2026-11-16';
      // Fill the day except two 60-min slots: 09:00 - 10:00 and 15:00 - 16:00
      const fixedEvents = [
        { id: 'fe1', title: 'Morning Block', startTime: '10:00', endTime: '13:00', isFixed: true },
        // Lunch is 13:00 - 14:00
        { id: 'fe2', title: 'Afternoon Block', startTime: '14:00', endTime: '15:00', isFixed: true },
        { id: 'fe3', title: 'Late Block', startTime: '16:00', endTime: '18:00', isFixed: true }
      ];

      // A 120-min task cannot fit into any single slot (max free is 60m).
      // With allowSplit: true, it splits into 60m + 60m
      const tasks = [
        { id: 'task_long', title: 'Deep Research Paper', estimatedMinutes: 120, allowSplit: true, priority: 'urgent', dueDate: '2026-11-16', deadlineTime: '18:00' }
      ];

      const proposal = generateScheduleProposal({
        targetDate,
        tasks,
        userAvailability: sampleAvailability,
        fixedEvents
      });

      const splitBlocks = proposal.proposedBlocks.filter(b => b.sourceEntityId === 'task_long');
      expect(splitBlocks.length).toBe(2);
      expect(splitBlocks[0].id).toBe('sb_task_long_p1');
      expect(splitBlocks[0].title).toContain('Part 1/2');
      expect(splitBlocks[0].durationMinutes).toBe(60);
      expect(splitBlocks[1].id).toBe('sb_task_long_p2');
      expect(splitBlocks[1].title).toContain('Part 2/2');
      expect(splitBlocks[1].durationMinutes).toBe(60);
    });

    it('reports tasks with missing estimates in unscheduledTasks', () => {
      const targetDate = '2026-11-16';
      const tasks = [
        { id: 't_no_est', title: 'Task Without Estimate', estimatedMinutes: null }
      ];

      const proposal = generateScheduleProposal({
        targetDate,
        tasks,
        userAvailability: sampleAvailability
      });

      expect(proposal.unscheduledTasks.length).toBe(1);
      expect(proposal.unscheduledTasks[0].taskId).toBe('t_no_est');
      expect(proposal.unscheduledTasks[0].reason).toContain('estimated duration');
    });

    it('reports past deadline tasks in unscheduledTasks', () => {
      const targetDate = '2026-11-16';
      const tasks = [
        { id: 't_expired', title: 'Expired Task', estimatedMinutes: 45, dueDate: '2026-11-10', deadlineTime: '12:00' }
      ];

      const proposal = generateScheduleProposal({
        targetDate,
        tasks,
        userAvailability: sampleAvailability
      });

      expect(proposal.unscheduledTasks.length).toBe(1);
      expect(proposal.unscheduledTasks[0].taskId).toBe('t_expired');
      expect(proposal.unscheduledTasks[0].reason).toContain('Deadline passed');
    });

    it('computes accurate workload summary with capacity utilization and classification', () => {
      const targetDate = '2026-11-16'; // 9:00 - 18:00 = 540 min. Lunch = 60 min. Flexible capacity = 480 min.
      const tasks = [
        { id: 't1', title: 'Task 1', estimatedMinutes: 120, priority: 'urgent' },
        { id: 't2', title: 'Task 2', estimatedMinutes: 120, priority: 'high' }
      ];

      const proposal = generateScheduleProposal({
        targetDate,
        tasks,
        userAvailability: sampleAvailability
      });

      // Scheduled 240m flexible out of 480m flexible capacity = 50%
      expect(proposal.workload.scheduledWorkMinutes).toBe(240);
      expect(proposal.workload.capacityUtilization).toBe(0.5);
      expect(proposal.workload.classification).toBe('balanced'); // 0.40 - 0.80 is balanced
      expect(proposal.workload.priorityDistribution.urgent).toBe(1);
      expect(proposal.workload.priorityDistribution.high).toBe(1);
    });

    it('handles greedy limitation adversarial case deterministically with explainable unscheduled reason', () => {
      const targetDate = '2026-11-16';
      // Total working window 09:00 - 11:00 = 120 minutes. Lunch disabled.
      const customAvailability = {
        ...sampleAvailability,
        workingHours: {
          ...sampleAvailability.workingHours,
          monday: { start: '09:00', end: '11:00', active: true }
        },
        preferences: {
          ...sampleAvailability.preferences,
          lunchBreak: { enabled: false }
        }
      };

      // Two tasks: task_urgent (needs 80 min, urgent) and task_high (needs 60 min, high).
      // Urgency order places task_urgent first. task_urgent takes 09:00 - 10:20 (80m).
      // Remaining slot is 10:20 - 11:00 (40m).
      // task_high needs 60m, so it cannot fit into the 40m remainder!
      // Engine deterministically places task_urgent and reports task_high in unscheduledTasks with clear explanation.
      const tasks = [
        { id: 'task_urgent', title: 'Critical Bugfix', estimatedMinutes: 80, priority: 'urgent', dueDate: '2026-11-16', deadlineTime: '11:00' },
        { id: 'task_high', title: 'Feature Review', estimatedMinutes: 60, priority: 'high', dueDate: '2026-11-16', deadlineTime: '11:00' }
      ];

      const proposal = generateScheduleProposal({
        targetDate,
        tasks,
        userAvailability: customAvailability
      });

      expect(proposal.proposedBlocks.some(b => b.sourceEntityId === 'task_urgent')).toBe(true);
      expect(proposal.unscheduledTasks.some(u => u.taskId === 'task_high')).toBe(true);
      const unscheduled = proposal.unscheduledTasks.find(u => u.taskId === 'task_high');
      expect(unscheduled.reason).toBeDefined();
      expect(unscheduled.reason.length).toBeGreaterThan(10);
    });

    it('handles inactive day off gracefully', () => {
      const targetDate = '2026-11-22'; // Sunday (active: false in sampleAvailability)
      const tasks = [
        { id: 't_sun', title: 'Sunday Work', estimatedMinutes: 60 }
      ];

      const proposal = generateScheduleProposal({
        targetDate,
        tasks,
        userAvailability: sampleAvailability
      });

      expect(proposal.workload.totalAvailableMinutes).toBe(0);
      expect(proposal.unscheduledTasks.length).toBe(1);
      expect(proposal.unscheduledTasks[0].reason).toContain('inactive holiday');
    });
  });
});

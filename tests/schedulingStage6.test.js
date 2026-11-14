import { describe, it, expect } from 'vitest';
import {
  generateRescheduleProposal,
  PROPOSAL_STATUSES
} from '../shared/domain/scheduling/index.js';

describe('Stage 6: Adaptive Rescheduling Engine', () => {
  const targetDate = '2026-11-16'; // Monday
  const availability = {
    userId: 'user_stage6',
    defaultWorkingHours: { start: '09:00', end: '18:00' },
    preferences: {
      lunchBreak: { start: '13:00', end: '14:00', enabled: true },
      minSessionMinutes: 30,
      maxSessionMinutes: 120
    }
  };

  it('reschedules remaining tasks when an earlier block overruns', () => {
    // Original plan:
    // 09:00 - 10:00: Task A (overran by 60 min to 11:00)
    // 10:00 - 11:00: Task B (originally scheduled at 10:00)
    // 11:00 - 12:00: Task C (originally scheduled at 11:00)
    const currentBlocks = [
      { id: 'b_ta', sourceEntityId: 'ta', title: 'Task A', startTime: '09:00', endTime: '10:00', durationMinutes: 60, blockType: 'task' },
      { id: 'b_tb', sourceEntityId: 'tb', title: 'Task B', startTime: '10:00', endTime: '11:00', durationMinutes: 60, blockType: 'task' },
      { id: 'b_tc', sourceEntityId: 'tc', title: 'Task C', startTime: '11:00', endTime: '12:00', durationMinutes: 60, blockType: 'task' }
    ];

    const tasks = [
      { id: 'ta', title: 'Task A', estimatedMinutes: 60, priority: 'medium', dueDate: targetDate, deadlineTime: '18:00' },
      { id: 'tb', title: 'Task B', estimatedMinutes: 60, priority: 'high', dueDate: targetDate, deadlineTime: '18:00' },
      { id: 'tc', title: 'Task C', estimatedMinutes: 60, priority: 'urgent', dueDate: targetDate, deadlineTime: '18:00' }
    ];

    const proposal = generateRescheduleProposal({
      targetDate,
      currentBlocks,
      tasks,
      userAvailability: availability,
      overrun: { blockId: 'b_ta', actualDurationMinutes: 120 }, // 09:00 - 11:00
      currentTimeStr: '11:00'
    });

    expect(proposal.status).toBe(PROPOSAL_STATUSES.PENDING_APPROVAL);
    expect(proposal.changeSummary).toBeDefined();

    // Task B and Task C must now be scheduled after 11:00!
    const taskBProposed = proposal.proposedBlocks.find(b => b.sourceEntityId === 'tb');
    const taskCProposed = proposal.proposedBlocks.find(b => b.sourceEntityId === 'tc');

    expect(taskBProposed).toBeDefined();
    expect(taskCProposed).toBeDefined();
    expect(taskBProposed.startTime >= '11:00').toBe(true);
    expect(taskCProposed.startTime >= '11:00').toBe(true);

    // Verify changeSummary reflects shifted blocks
    expect(proposal.changeSummary.rescheduledCount).toBeGreaterThanOrEqual(1);
    expect(proposal.changeSummary.explanation).toBeDefined();
  });

  it('strictly preserves locked blocks at their original time', () => {
    // Task Locked: 14:00 - 15:00 is user-locked.
    // An inserted emergency meeting arrives 10:00 - 13:00.
    const currentBlocks = [
      { id: 'b_locked', sourceEntityId: 't_locked', title: 'Important Strategy Sync', startTime: '14:00', endTime: '15:00', durationMinutes: 60, blockType: 'task', isLocked: true },
      { id: 'b_flex', sourceEntityId: 't_flex', title: 'Drafting Docs', startTime: '10:00', endTime: '11:00', durationMinutes: 60, blockType: 'task' }
    ];

    const tasks = [
      { id: 't_locked', title: 'Important Strategy Sync', estimatedMinutes: 60, priority: 'urgent' },
      { id: 't_flex', title: 'Drafting Docs', estimatedMinutes: 60, priority: 'medium' }
    ];

    const fixedEvents = [
      { id: 'ev_emergency', title: 'Emergency Board Call', startTime: '10:00', endTime: '12:00', isFixed: true }
    ];

    const proposal = generateRescheduleProposal({
      targetDate,
      currentBlocks,
      tasks,
      fixedEvents,
      lockedBlockIds: ['b_locked'],
      userAvailability: availability
    });

    // The locked block must stay exactly at 14:00 - 15:00
    const lockedProposed = proposal.proposedBlocks.find(b => b.id === 'b_locked' || b.sourceEntityId === 't_locked');
    expect(lockedProposed).toBeDefined();
    expect(lockedProposed.startTime).toBe('14:00');
    expect(lockedProposed.endTime).toBe('15:00');

    // Drafting Docs was pushed out of 10:00 - 11:00 to another free window (e.g. 09:00 - 10:00 or 15:00 - 16:00)
    const flexProposed = proposal.proposedBlocks.find(b => b.sourceEntityId === 't_flex');
    expect(flexProposed).toBeDefined();
    expect(flexProposed.startTime !== '10:00').toBe(true);
  });

  it('identifies displaced tasks when day capacity is exceeded and marks them for spillover', () => {
    // Day only has 2 hours remaining (16:00 - 18:00)
    const tightAvailability = {
      ...availability,
      defaultWorkingHours: { start: '16:00', end: '18:00' },
      preferences: { lunchBreak: { enabled: false } }
    };

    const currentBlocks = [
      { id: 'b1', sourceEntityId: 't1', title: 'Task 1', startTime: '16:00', endTime: '17:00', durationMinutes: 60, blockType: 'task' },
      { id: 'b2', sourceEntityId: 't2', title: 'Task 2', startTime: '17:00', endTime: '18:00', durationMinutes: 60, blockType: 'task' }
    ];

    // New unexpected 90m high-priority meeting takes 16:00 - 17:30
    const fixedEvents = [
      { id: 'ev_call', title: 'Client Sync', startTime: '16:00', endTime: '17:30', isFixed: true }
    ];

    const tasks = [
      { id: 't1', title: 'Task 1', estimatedMinutes: 60, priority: 'urgent' },
      { id: 't2', title: 'Task 2', estimatedMinutes: 60, priority: 'low' }
    ];

    const proposal = generateRescheduleProposal({
      targetDate,
      currentBlocks,
      tasks,
      fixedEvents,
      userAvailability: tightAvailability
    });

    // Client sync takes 16:00 - 17:30 (90m). Remaining time is 17:30 - 18:00 (30m).
    // Neither 60m task can fit into 30m!
    expect(proposal.changeSummary.displacedCount).toBeGreaterThanOrEqual(1);
    expect(proposal.unscheduledTasks.length).toBeGreaterThanOrEqual(1);
  });

  it('reschedules an explicitly missed morning block into an available afternoon slot', () => {
    // Task Missed: was supposed to run 09:00 - 10:00, but user missed it.
    // Afternoon (14:00 - 18:00) is free.
    const currentBlocks = [
      { id: 'b_missed', sourceEntityId: 't_missed', title: 'Morning Workout/Review', startTime: '09:00', endTime: '10:00', durationMinutes: 60, blockType: 'task' },
      { id: 'b_work', sourceEntityId: 't_work', title: 'Work Session', startTime: '10:00', endTime: '12:00', durationMinutes: 120, blockType: 'task', isLocked: true }
    ];

    const tasks = [
      { id: 't_missed', title: 'Morning Workout/Review', estimatedMinutes: 60, priority: 'high', dueDate: targetDate, deadlineTime: '18:00' },
      { id: 't_work', title: 'Work Session', estimatedMinutes: 120, priority: 'urgent', dueDate: targetDate, deadlineTime: '18:00' }
    ];

    const proposal = generateRescheduleProposal({
      targetDate,
      currentBlocks,
      tasks,
      missedBlockIds: ['b_missed'],
      currentTimeStr: '10:00',
      userAvailability: availability
    });

    const rescheduledMissed = proposal.proposedBlocks.find(b => b.sourceEntityId === 't_missed');
    expect(rescheduledMissed).toBeDefined();
    // Must be rescheduled to after current time and locked block (>= 12:00)
    expect(rescheduledMissed.startTime >= '12:00').toBe(true);
    expect(proposal.changeSummary.rescheduledCount).toBeGreaterThanOrEqual(1);
  });
});

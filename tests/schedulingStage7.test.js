import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserAvailability,
  saveUserAvailability,
  getDraftProposal,
  saveDraftProposal,
  clearDraftProposal,
  getAcceptedScheduleBlocks,
  acceptScheduleProposal
} from '../src/modules/scheduling-storage.js';

import {
  generateScheduleProposal,
  PROPOSAL_STATUSES
} from '../shared/domain/scheduling/index.js';

import { clearMemoryCache, setStorageItem, getStorageItem } from '../src/utils/storage.js';

describe('Stage 7: Persistence & Synchronization Integration', () => {
  beforeEach(() => {
    clearMemoryCache();
  });

  describe('User Availability Storage', () => {
    it('returns default availability with isUserConfigured: false when unconfigured', () => {
      const avail = getUserAvailability('user_st7');
      expect(avail.isUserConfigured).toBe(false);
      expect(avail.defaultWorkingHours.start).toBe('09:00');
      expect(avail.defaultWorkingHours.end).toBe('18:00');
    });

    it('persists and retrieves custom availability profile with isUserConfigured: true', () => {
      const custom = {
        timezone: 'America/New_York',
        defaultWorkingHours: { start: '08:00', end: '16:00' },
        preferences: {
          minSessionMinutes: 25,
          maxSessionMinutes: 90
        }
      };

      saveUserAvailability(custom, 'user_st7');
      const retrieved = getUserAvailability('user_st7');

      expect(retrieved.isUserConfigured).toBe(true);
      expect(retrieved.timezone).toBe('America/New_York');
      expect(retrieved.defaultWorkingHours.start).toBe('08:00');
      expect(retrieved.defaultWorkingHours.end).toBe('16:00');
      expect(retrieved.preferences.minSessionMinutes).toBe(25);
    });
  });

  describe('Draft Proposal Storage', () => {
    it('saves, retrieves, and clears draft proposals by date', () => {
      const targetDate = '2026-11-20';
      const proposal = {
        targetDate,
        proposedBlocks: [
          { id: 'sb_1', title: 'Task Block', startTime: '09:00', endTime: '10:00', durationMinutes: 60, blockType: 'task', date: targetDate }
        ]
      };

      saveDraftProposal(proposal);
      const retrieved = getDraftProposal(targetDate);

      expect(retrieved).toBeDefined();
      expect(retrieved.targetDate).toBe(targetDate);
      expect(retrieved.proposedBlocks.length).toBe(1);

      clearDraftProposal(targetDate);
      expect(getDraftProposal(targetDate)).toBeNull();
    });
  });

  describe('Proposal Acceptance & Atomic Task Update', () => {
    it('atomically updates canonical tasks (scheduledSessions, startTime/endTime) and writes schedule_blocks upon acceptance', () => {
      const targetDate = '2026-11-20';

      // Seed canonical tasks in storage
      const existingTasks = [
        { id: 't_split', title: 'Long Project Task', allowSplit: true, status: 'pending', estimatedMinutes: 120 }
      ];
      setStorageItem('tasks', existingTasks);

      // Proposal with split blocks
      const proposal = {
        targetDate,
        status: PROPOSAL_STATUSES.DRAFT,
        proposedBlocks: [
          {
            id: 'sb_t_split_p1',
            date: targetDate,
            startTime: '09:00',
            endTime: '10:00',
            durationMinutes: 60,
            blockType: 'task',
            sourceEntityId: 't_split',
            splitInfo: { part: 1, totalParts: 2, parentTaskId: 't_split' },
            title: 'Long Project Task (Part 1/2)'
          },
          {
            id: 'sb_t_split_p2',
            date: targetDate,
            startTime: '14:00',
            endTime: '15:00',
            durationMinutes: 60,
            blockType: 'task',
            sourceEntityId: 't_split',
            splitInfo: { part: 2, totalParts: 2, parentTaskId: 't_split' },
            title: 'Long Project Task (Part 2/2)'
          }
        ]
      };

      const result = acceptScheduleProposal(proposal);
      expect(result.success).toBe(true);
      expect(result.proposal.status).toBe(PROPOSAL_STATUSES.ACCEPTED);

      // Verify canonical task entity was atomically updated
      const updatedTasks = getStorageItem('tasks');
      const updatedTask = updatedTasks.find(t => t.id === 't_split');

      expect(updatedTask).toBeDefined();
      expect(updatedTask.scheduledSessions.length).toBe(2);
      expect(updatedTask.scheduledSessions[0].blockId).toBe('sb_t_split_p1');
      expect(updatedTask.scheduledSessions[1].blockId).toBe('sb_t_split_p2');

      // Backward compatibility: earliest session
      expect(updatedTask.startTime).toBe('09:00');
      expect(updatedTask.endTime).toBe('10:00');

      // Verify materialized schedule_blocks
      const acceptedBlocks = getAcceptedScheduleBlocks(targetDate);
      expect(acceptedBlocks.length).toBe(2);
      expect(acceptedBlocks.some(b => b.id === 'sb_t_split_p1')).toBe(true);
      expect(acceptedBlocks.some(b => b.id === 'sb_t_split_p2')).toBe(true);
    });

    it('supports partial acceptance with selectedBlockIds', () => {
      const targetDate = '2026-11-20';
      const existingTasks = [
        { id: 't1', title: 'Task 1', estimatedMinutes: 60 },
        { id: 't2', title: 'Task 2', estimatedMinutes: 60 }
      ];
      setStorageItem('tasks', existingTasks);

      const proposal = {
        targetDate,
        proposedBlocks: [
          { id: 'b1', date: targetDate, startTime: '09:00', endTime: '10:00', durationMinutes: 60, blockType: 'task', sourceEntityId: 't1' },
          { id: 'b2', date: targetDate, startTime: '11:00', endTime: '12:00', durationMinutes: 60, blockType: 'task', sourceEntityId: 't2' }
        ]
      };

      // Accept only b1
      const result = acceptScheduleProposal(proposal, { selectedBlockIds: ['b1'] });
      expect(result.success).toBe(true);
      expect(result.proposal.status).toBe(PROPOSAL_STATUSES.PARTIALLY_ACCEPTED);
      expect(result.acceptedBlocks.length).toBe(1);

      // Task 1 updated, Task 2 untouched
      const tasks = getStorageItem('tasks');
      const task1 = tasks.find(t => t.id === 't1');
      const task2 = tasks.find(t => t.id === 't2');

      expect(task1.scheduledSessions).toBeDefined();
      expect(task2.scheduledSessions).toBeUndefined();
    });

    it('rejects acceptance and marks proposal as stale when tasks were modified after proposal generation', () => {
      const targetDate = '2026-11-20';
      const initialTask = {
        id: 't_stale',
        title: 'Original Title',
        estimatedMinutes: 60,
        status: 'pending',
        updatedAt: 1000
      };

      const proposal = generateScheduleProposal({
        targetDate,
        tasks: [initialTask]
      });

      // User modified the task out-of-band (e.g. marked completed or changed duration)
      const modifiedSnapshot = {
        tasks: [{ ...initialTask, status: 'completed', updatedAt: 2000 }],
        events: []
      };

      const result = acceptScheduleProposal(proposal, { currentSnapshot: modifiedSnapshot });
      expect(result.success).toBe(false);
      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('stale');
    });
  });
});


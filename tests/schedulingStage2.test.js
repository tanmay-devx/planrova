/**
 * tests/schedulingStage2.test.js
 * Comprehensive Vitest suite for Planrova 2.0 Adaptive Planning Stage 2:
 * Domain Contracts, Validation, Pure Time Arithmetic, and Snapshot Hash Freshness.
 */

import { describe, it, expect } from 'vitest';

import {
  ALGORITHM_VERSION,
  BLOCK_TYPES,
  PROPOSAL_STATUSES,
  CONFLICT_TYPES,
  CONFLICT_SEVERITIES,
  WORKLOAD_CLASSIFICATIONS,
  WORKLOAD_THRESHOLDS,
  TASK_PRIORITY_RANKS,
  SLOT_SUITABILITY_WEIGHTS,
  DEFAULT_SCHEDULING_PREFERENCES,
  timeStringToMinutes,
  minutesToTimeString,
  calculateDurationMinutes,
  splitCrossMidnightInterval,
  areIntervalsOverlapping,
  intersectIntervals,
  mergeIntervals,
  subtractIntervals,
  resolveDeadlineMinutes,
  calculateWorkloadUtilization,
  classifyWorkload,
  generateSnapshotHash,
  validateAvailability,
  normalizeAvailability,
  validateScheduleBlock,
  normalizeScheduleBlock,
  validateScheduleProposal,
  normalizeScheduleProposal,
  validateProposalFreshness
} from '../shared/domain/scheduling/index.js';
import { normalizeTask, validateTask } from '../shared/domain/entities/task.schema.js';

describe('Stage 2: Scheduling Types & Constants', () => {
  it('strictly sums slot suitability weights to exactly 100', () => {
    const sum = 
      SLOT_SUITABILITY_WEIGHTS.PREFERRED_FOCUS_MATCH +
      SLOT_SUITABILITY_WEIGHTS.CONTIGUITY_BONUS +
      SLOT_SUITABILITY_WEIGHTS.BUFFER_PROXIMITY +
      SLOT_SUITABILITY_WEIGHTS.EARLINESS_PREFERENCE;

    expect(sum).toBe(100);
  });

  it('defines valid non-empty block types and proposal statuses', () => {
    expect(Object.values(BLOCK_TYPES)).toContain('task');
    expect(Object.values(BLOCK_TYPES)).toContain('fixed_event');
    expect(Object.values(BLOCK_TYPES)).toContain('lecture');
    expect(Object.values(BLOCK_TYPES)).toContain('buffer');
    expect(Object.values(BLOCK_TYPES)).toContain('break');

    expect(Object.values(PROPOSAL_STATUSES)).toContain('draft');
    expect(Object.values(PROPOSAL_STATUSES)).toContain('stale');
    expect(Object.values(PROPOSAL_STATUSES)).toContain('accepted');
  });
});

describe('Stage 2: Pure Time Arithmetic & Interval Utilities', () => {
  it('converts HH:MM strings to minutes and back accurately', () => {
    expect(timeStringToMinutes('00:00')).toBe(0);
    expect(timeStringToMinutes('09:30')).toBe(570);
    expect(timeStringToMinutes('13:45')).toBe(825);
    expect(timeStringToMinutes('18:00')).toBe(1080);
    expect(timeStringToMinutes('24:00')).toBe(1440);

    // Inverse roundtrip
    expect(minutesToTimeString(0)).toBe('00:00');
    expect(minutesToTimeString(570)).toBe('09:30');
    expect(minutesToTimeString(825)).toBe('13:45');
    expect(minutesToTimeString(1080)).toBe('18:00');
    expect(minutesToTimeString(1440)).toBe('24:00');
  });

  it('returns NaN for malformed or out-of-range time strings', () => {
    expect(isNaN(timeStringToMinutes('25:00'))).toBe(true);
    expect(isNaN(timeStringToMinutes('12:60'))).toBe(true);
    expect(isNaN(timeStringToMinutes('-01:00'))).toBe(true);
    expect(isNaN(timeStringToMinutes('abc'))).toBe(true);
    expect(isNaN(timeStringToMinutes(''))).toBe(true);
    expect(isNaN(timeStringToMinutes(null))).toBe(true);
  });

  it('calculates duration in minutes accurately', () => {
    expect(calculateDurationMinutes('09:00', '10:30')).toBe(90);
    expect(calculateDurationMinutes('10:00', '10:00')).toBe(0);
    expect(calculateDurationMinutes('14:00', '12:00')).toBe(-120);
  });

  it('determines interval overlaps and intersections correctly', () => {
    const a = { start: 60, end: 120 };  // 01:00 - 02:00
    const b = { start: 90, end: 150 };  // 01:30 - 02:30
    const c = { start: 120, end: 180 }; // 02:00 - 03:00 (touching a at boundary)
    const d = { start: 200, end: 300 }; // disjoint

    expect(areIntervalsOverlapping(a, b)).toBe(true);
    expect(intersectIntervals(a, b)).toEqual({ start: 90, end: 120 });

    // Touching boundaries do not overlap by default (exclusive)
    expect(areIntervalsOverlapping(a, c, false)).toBe(false);
    expect(areIntervalsOverlapping(a, c, true)).toBe(true);
    expect(intersectIntervals(a, c)).toBe(null);

    // Disjoint
    expect(areIntervalsOverlapping(a, d)).toBe(false);
    expect(intersectIntervals(a, d)).toBe(null);
  });

  it('merges overlapping and contiguous intervals into sorted disjoint sets', () => {
    const raw = [
      { start: 100, end: 150 },
      { start: 60, end: 110 },
      { start: 200, end: 240 },
      { start: 240, end: 300 }
    ];

    const merged = mergeIntervals(raw);
    expect(merged).toEqual([
      { start: 60, end: 150 },
      { start: 200, end: 300 }
    ]);
  });

  it('subtracts busy intervals from a base working window correctly', () => {
    const base = { start: 540, end: 1080 }; // 09:00 - 18:00 (540 min total)
    const busy = [
      { start: 600, end: 660 }, // Lecture 1: 10:00 - 11:00
      { start: 780, end: 840 }, // Lunch break: 13:00 - 14:00
      { start: 960, end: 1020 } // Meeting: 16:00 - 17:00
    ];

    const freeSlots = subtractIntervals(base, busy);
    expect(freeSlots).toEqual([
      { start: 540, end: 600 }, // 09:00 - 10:00 (60 min)
      { start: 660, end: 780 }, // 11:00 - 13:00 (120 min)
      { start: 840, end: 960 }, // 14:00 - 16:00 (120 min)
      { start: 1020, end: 1080 } // 17:00 - 18:00 (60 min)
    ]);
  });

  it('handles edge case where busy intervals completely cover or exceed base window', () => {
    const base = { start: 600, end: 900 };
    const busy = [{ start: 500, end: 1000 }];
    expect(subtractIntervals(base, busy)).toEqual([]);
  });
});

describe('Stage 2: Temporal Deadline & Workload Semantics', () => {
  it('resolves date-only deadline to end of working hours, not midnight start', () => {
    const targetDate = '2026-11-14';
    
    // Date-only deadline (no time specified)
    const deadlineMins = resolveDeadlineMinutes('2026-11-14', '', targetDate, '18:00');
    expect(deadlineMins).toBe(1080); // 18:00

    // Specific time deadline
    const specificMins = resolveDeadlineMinutes('2026-11-14', '15:30', targetDate, '18:00');
    expect(specificMins).toBe(930); // 15:30

    // Past date (overdue by 1 day)
    expect(resolveDeadlineMinutes('2026-11-13', '', targetDate, '18:00')).toBe(-360);

    // No deadline -> Infinity
    expect(resolveDeadlineMinutes('', '', targetDate, '18:00')).toBe(Infinity);
  });

  it('ensures multi-day future deadlines are strictly chronologically comparable', () => {
    const targetDate = '2026-11-14';

    // Same day specific time (15:00)
    const d1 = resolveDeadlineMinutes('2026-11-14', '15:00', targetDate, '18:00'); // 900
    // Same day date-only (18:00)
    const d2 = resolveDeadlineMinutes('2026-11-14', '', targetDate, '18:00');      // 1080
    // Tomorrow morning (10:00)
    const d3 = resolveDeadlineMinutes('2026-11-15', '10:00', targetDate, '18:00'); // 1440 + 600 = 2040
    // Tomorrow date-only (18:00)
    const d4 = resolveDeadlineMinutes('2026-11-15', '', targetDate, '18:00');      // 1440 + 1080 = 2520
    // Day after tomorrow afternoon (14:00)
    const d5 = resolveDeadlineMinutes('2026-11-16', '14:00', targetDate, '18:00'); // 2880 + 840 = 3720
    // No deadline
    const dInf = resolveDeadlineMinutes(null, null, targetDate, '18:00');           // Infinity

    expect(d1).toBe(900);
    expect(d2).toBe(1080);
    expect(d3).toBe(2040);
    expect(d4).toBe(2520);
    expect(d5).toBe(3720);
    expect(dInf).toBe(Infinity);

    // Strict chronological ordering
    expect(d1 < d2).toBe(true);
    expect(d2 < d3).toBe(true);
    expect(d3 < d4).toBe(true);
    expect(d4 < d5).toBe(true);
    expect(d5 < dInf).toBe(true);
  });

  it('splits cross-midnight intervals into two valid single-day intervals', () => {
    import('../shared/domain/scheduling/scheduling.utils.js').then(m => {
      const segments = m.splitCrossMidnightInterval('23:00', '02:00', '2026-11-14');
      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        date: '2026-11-14',
        startTime: '23:00',
        endTime: '24:00',
        durationMinutes: 60
      });
      expect(segments[1]).toEqual({
        date: '2026-11-15',
        startTime: '00:00',
        endTime: '02:00',
        durationMinutes: 120
      });
    });
  });

  it('calculates workload utilization using flexible capacity formula', () => {
    // Total working hours: 540 min (09:00 - 18:00)
    // Fixed commitments: 120 min
    // Breaks: 60 min
    // Flexible capacity = 540 - 120 - 60 = 360 min
    
    // Case 1: 180 min scheduled work -> 180 / 360 = 0.50 (balanced)
    const u1 = calculateWorkloadUtilization(180, 540, 120, 60);
    expect(u1).toBe(0.5);
    expect(classifyWorkload(u1)).toBe('balanced');

    // Case 2: 90 min scheduled work -> 90 / 360 = 0.25 (light)
    const u2 = calculateWorkloadUtilization(90, 540, 120, 60);
    expect(u2).toBe(0.25);
    expect(classifyWorkload(u2)).toBe('light');

    // Case 3: 324 min scheduled work -> 324 / 360 = 0.90 (heavy)
    const u3 = calculateWorkloadUtilization(324, 540, 120, 60);
    expect(u3).toBe(0.9);
    expect(classifyWorkload(u3)).toBe('heavy');

    // Case 4: 450 min scheduled work -> 450 / 360 = 1.25 (overloaded)
    const u4 = calculateWorkloadUtilization(450, 540, 120, 60);
    expect(u4).toBe(1.25);
    expect(classifyWorkload(u4)).toBe('overloaded');

    // Edge Case: 0 flexible capacity with 60 min work -> Infinity (overloaded)
    const uEdgeOver = calculateWorkloadUtilization(60, 120, 120, 0);
    expect(uEdgeOver).toBe(Infinity);
    expect(classifyWorkload(uEdgeOver)).toBe('overloaded');

    // Edge Case: 0 flexible capacity with 0 min work -> 0 (light)
    const uEdgeZero = calculateWorkloadUtilization(0, 120, 120, 0);
    expect(uEdgeZero).toBe(0);
    expect(classifyWorkload(uEdgeZero)).toBe('light');
  });

  it('generates deterministic snapshot hash resistant to property ordering', () => {
    const payloadA = {
      targetDate: '2026-11-14',
      tasks: [{ id: 't_1', title: 'Task 1' }, { id: 't_2', title: 'Task 2' }]
    };

    const payloadB = {
      tasks: [{ title: 'Task 1', id: 't_1' }, { id: 't_2', title: 'Task 2' }],
      targetDate: '2026-11-14'
    };

    const hashA = generateSnapshotHash(payloadA);
    const hashB = generateSnapshotHash(payloadB);

    expect(hashA).toMatch(/^snap_[0-9a-f]{16}$/);
    expect(hashA).toBe(hashB);

    // Mutation changes hash
    const mutated = {
      ...payloadA,
      tasks: [{ id: 't_1', title: 'Task 1 Mutated' }]
    };
    expect(generateSnapshotHash(mutated)).not.toBe(hashA);
  });
});

describe('Stage 2: Validation & Normalization Contracts', () => {
  it('validates and normalizes User Availability correctly', () => {
    const valid = validateAvailability({
      userId: 'u_1',
      defaultWorkingHours: { start: '09:00', end: '18:00' },
      preferences: { minSessionMinutes: 25, maxSessionMinutes: 90 }
    });
    expect(valid.valid).toBe(true);

    // Invalid start/end
    const invalidHours = validateAvailability({
      defaultWorkingHours: { start: '18:00', end: '09:00' }
    });
    expect(invalidHours.valid).toBe(false);
    expect(invalidHours.errors[0]).toContain('precede end time');

    // Normalization fills defaults
    const normalized = normalizeAvailability({ userId: 'u_test' });
    expect(normalized.defaultWorkingHours.start).toBe('09:00');
    expect(normalized.defaultWorkingHours.end).toBe('18:00');
    expect(normalized.preferences.minSessionMinutes).toBe(25);
    expect(normalized.weekdayRules[1].active).toBe(true);
    expect(normalized.weekdayRules[0].active).toBe(false); // Sunday
  });

  it('validates and normalizes ScheduleBlock entities', () => {
    const validBlock = {
      id: 'sb_1',
      date: '2026-11-14',
      startTime: '10:00',
      endTime: '11:00',
      durationMinutes: 60,
      blockType: 'task'
    };
    expect(validateScheduleBlock(validBlock).valid).toBe(true);

    // Duration mismatch
    const mismatched = {
      ...validBlock,
      durationMinutes: 45
    };
    expect(validateScheduleBlock(mismatched).valid).toBe(false);
    expect(validateScheduleBlock(mismatched).errors[0]).toContain('does not match time interval');

    // Normalization
    const norm = normalizeScheduleBlock({ title: 'Read Book', startTime: '14:00', endTime: '15:15' });
    expect(norm.durationMinutes).toBe(75);
    expect(norm.isFixed).toBe(false);
    expect(norm.isLocked).toBe(false);
    expect(norm.schemaVersion).toBe(1);
  });

  it('validates ScheduleProposal and detects stale proposals', () => {
    const now = Date.now();
    const proposal = normalizeScheduleProposal({
      id: 'prop_123',
      targetDate: '2026-11-14',
      algorithmVersion: ALGORITHM_VERSION,
      sourceSnapshotHash: 'snap_abcd1234ef567890',
      createdAt: now,
      proposedBlocks: [
        {
          id: 'b_1',
          blockType: 'task',
          sourceEntityId: 't_1',
          title: 'Math Study',
          startTime: '10:00',
          endTime: '11:00'
        }
      ]
    });

    expect(validateScheduleProposal(proposal).valid).toBe(true);

    // Test Freshness with untouched tasks
    const currentTasksFresh = [
      { id: 't_1', title: 'Math Study', status: 'todo', updatedAt: now - 5000 }
    ];
    const freshness = validateProposalFreshness(proposal, { tasks: currentTasksFresh, hash: 'snap_abcd1234ef567890' });
    expect(freshness.isFresh).toBe(true);

    // Stale Case 1: Task completed after proposal generated
    const currentTasksCompleted = [
      { id: 't_1', title: 'Math Study', status: 'completed', updatedAt: now + 1000 }
    ];
    const staleCompleted = validateProposalFreshness(proposal, { tasks: currentTasksCompleted });
    expect(staleCompleted.isFresh).toBe(false);
    expect(staleCompleted.reason).toContain('already been completed');

    // Stale Case 2: Task modified after proposal
    const currentTasksModified = [
      { id: 't_1', title: 'Math Study', status: 'todo', updatedAt: now + 5000 }
    ];
    const staleModified = validateProposalFreshness(proposal, { tasks: currentTasksModified });
    expect(staleModified.isFresh).toBe(false);
    expect(staleModified.reason).toContain('was modified after proposal');

    // Stale Case 3: Task deleted
    const staleDeleted = validateProposalFreshness(proposal, { tasks: [] });
    expect(staleDeleted.isFresh).toBe(false);
    expect(staleDeleted.reason).toContain('was deleted after proposal');

    // Stale Case 4: Algorithm version mismatch
    const proposalOldVersion = { ...proposal, algorithmVersion: '0.9.0' };
    const staleVersion = validateProposalFreshness(proposalOldVersion, {});
    expect(staleVersion.isFresh).toBe(false);
    expect(staleVersion.reason).toContain('differs from active version');

    // Stale Case 5: Fixed calendar event modified on targetDate
    const staleCal = validateProposalFreshness(proposal, {
      tasks: currentTasksFresh,
      calendarEvents: [
        { id: 'cal_1', title: 'Midterm Exam', date: '2026-11-14', updatedAt: now + 5000 }
      ]
    });
    expect(staleCal.isFresh).toBe(false);
    expect(staleCal.reason).toContain('Fixed calendar event');

    // Stale Case 6: Availability configuration updated after proposal
    const staleAvail = validateProposalFreshness(proposal, {
      tasks: currentTasksFresh,
      availability: { updatedAt: now + 6000 }
    });
    expect(staleAvail.isFresh).toBe(false);
    expect(staleAvail.reason).toContain('User working hours or availability preferences were updated');

    // Stale Case 7: Locked block modified on targetDate
    const staleLocked = validateProposalFreshness(proposal, {
      tasks: currentTasksFresh,
      lockedBlocks: [
        { id: 'lb_1', title: 'Doctor Visit', date: '2026-11-14', updatedAt: now + 7000 }
      ]
    });
    expect(staleLocked.isFresh).toBe(false);
    expect(staleLocked.reason).toContain('Locked schedule block');
  });

  it('normalizes task with scheduledSessions without breaking flat startTime/endTime legacy compatibility', () => {
    const rawTask = {
      id: 't_split_1',
      title: 'Deep Work Session',
      estimatedMinutes: 120,
      allowSplit: true,
      startTime: '09:00',
      endTime: '10:00',
      scheduledSessions: [
        { blockId: 'sb_t_split_1_p1', date: '2026-11-14', startTime: '09:00', endTime: '10:00', part: 1, totalParts: 2, durationMinutes: 60 },
        { blockId: 'sb_t_split_1_p2', date: '2026-11-14', startTime: '14:00', endTime: '15:00', part: 2, totalParts: 2, durationMinutes: 60 }
      ]
    };

    const normTask = normalizeTask(rawTask);
    expect(normTask.allowSplit).toBe(true);
    expect(normTask.scheduledSessions).toHaveLength(2);
    expect(normTask.startTime).toBe('09:00'); // Legacy backward compatibility: earliest session
    expect(normTask.endTime).toBe('10:00');

    // ScheduleBlock stable ID generation for split parts
    const block1 = normalizeScheduleBlock({
      splitInfo: { part: 1, totalParts: 2, parentTaskId: 't_split_1' },
      startTime: '09:00',
      endTime: '10:00',
      date: '2026-11-14'
    });
    expect(block1.id).toBe('sb_t_split_1_p1');
    expect(block1.splitInfo.parentTaskId).toBe('t_split_1');

    const block2 = normalizeScheduleBlock({
      splitInfo: { part: 2, totalParts: 2, parentTaskId: 't_split_1' },
      startTime: '14:00',
      endTime: '15:00',
      date: '2026-11-14'
    });
    expect(block2.id).toBe('sb_t_split_1_p2');
  });

  it('distinguishes configurable onboarding availability defaults from user-configured settings', () => {
    // Default onboarding
    const defaultAvail = normalizeAvailability({ userId: 'u_new' });
    expect(defaultAvail.isUserConfigured).toBe(false);

    // User-configured
    const userAvail = normalizeAvailability({ userId: 'u_custom', isUserConfigured: true });
    expect(userAvail.isUserConfigured).toBe(true);
  });
});


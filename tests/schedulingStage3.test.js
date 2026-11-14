/**
 * tests/schedulingStage3.test.js
 * Comprehensive Vitest suite for Planrova 2.0 Adaptive Planning Stage 3:
 * Availability Engine & Conflict Detection Engine.
 */

import { describe, it, expect } from 'vitest';

import {
  calculateDailyAvailability,
  materializeTimetableForDate,
  detectSchedulingConflicts,
  CONFLICT_TYPES,
  CONFLICT_SEVERITIES
} from '../shared/domain/scheduling/index.js';

describe('Stage 3: Availability Engine', () => {
  const baseAvailability = {
    userId: 'u_test',
    defaultWorkingHours: { start: '09:00', end: '18:00' },
    weekdayRules: {
      1: { active: true, start: '09:00', end: '18:00', focusSlot: { start: '09:30', end: '12:30' } }, // Monday
      2: { active: true, start: '09:00', end: '18:00', focusSlot: { start: '09:30', end: '12:30' } }, // Tuesday
      0: { active: false } // Sunday
    },
    preferences: {
      lunchBreak: { start: '13:00', end: '14:00' }
    }
  };

  it('calculates full available capacity for a clear working day with lunch break', () => {
    // 2026-11-16 is a Monday
    const result = calculateDailyAvailability({
      date: '2026-11-16',
      userAvailability: baseAvailability
    });

    expect(result.isDayActive).toBe(true);
    expect(result.dayName).toBe('Monday');
    expect(result.totalWorkingMinutes).toBe(540); // 09:00 to 18:00 (9 hours)
    expect(result.reservedBreakMinutes).toBe(60); // 13:00 to 14:00
    expect(result.fixedCommitmentMinutes).toBe(0);
    expect(result.remainingAvailableMinutes).toBe(480); // 540 - 60 = 480 min

    expect(result.freeIntervals).toEqual([
      { start: 540, end: 780 },  // 09:00 - 13:00 (240 min)
      { start: 840, end: 1080 }  // 14:00 - 18:00 (240 min)
    ]);
  });

  it('materializes weekly recurring college timetable entries on matching days only', () => {
    const timetable = {
      Monday: [
        { id: 'cs101', subject: 'Operating Systems', startTime: '10:00', endTime: '11:30', room: 'Hall A' },
        { id: 'cs102', subject: 'Database Lab', startTime: '15:00', endTime: '16:30', room: 'Lab 2' }
      ],
      Tuesday: [
        { id: 'cs103', subject: 'Computer Networks', startTime: '09:30', endTime: '11:00', room: 'Hall B' }
      ]
    };

    // Monday (2026-11-16)
    const mondayMat = materializeTimetableForDate(timetable, '2026-11-16');
    expect(mondayMat).toHaveLength(2);
    expect(mondayMat[0].title).toBe('Operating Systems (Hall A)');
    expect(mondayMat[0].durationMinutes).toBe(90);
    expect(mondayMat[0].isFixed).toBe(true);

    // Tuesday (2026-11-17)
    const tuesdayMat = materializeTimetableForDate(timetable, '2026-11-17');
    expect(tuesdayMat).toHaveLength(1);
    expect(tuesdayMat[0].title).toBe('Computer Networks (Hall B)');

    // Subtracts from availability
    const availResult = calculateDailyAvailability({
      date: '2026-11-16',
      userAvailability: baseAvailability,
      timetable
    });

    expect(availResult.fixedCommitmentMinutes).toBe(180); // 90 + 90
    expect(availResult.remainingAvailableMinutes).toBe(300); // 540 - 60(lunch) - 180(lectures)
  });

  it('handles all-day calendar events by reserving the full working window', () => {
    const fixedEvents = [
      { id: 'exam_1', title: 'University Midterm Exam Day', date: '2026-11-16', allDay: true }
    ];

    const result = calculateDailyAvailability({
      date: '2026-11-16',
      userAvailability: baseAvailability,
      fixedEvents
    });

    expect(result.remainingAvailableMinutes).toBe(0);
    expect(result.freeIntervals).toEqual([]);
    expect(result.warnings.some(w => w.includes('reserves the full date'))).toBe(true);
  });

  it('handles custom date exceptions (holiday / leave)', () => {
    const customAvail = {
      ...baseAvailability,
      customExceptions: [
        { date: '2026-11-16', active: false, reason: 'National Holiday' }
      ]
    };

    const result = calculateDailyAvailability({
      date: '2026-11-16',
      userAvailability: customAvail
    });

    expect(result.isDayActive).toBe(false);
    expect(result.totalWorkingMinutes).toBe(0);
    expect(result.freeIntervals).toEqual([]);
    expect(result.warnings.some(w => w.includes('National Holiday'))).toBe(true);
  });
});

describe('Stage 3: Conflict Detection Engine', () => {
  const testAvailability = {
    userId: 'u_1',
    defaultWorkingHours: { start: '09:00', end: '18:00' },
    weekdayRules: {
      1: { active: true, start: '09:00', end: '18:00' }
    },
    preferences: { maxSessionMinutes: 90, breakBetweenSessionsMinutes: 10 }
  };

  it('detects HARD conflicts for overlapping fixed commitments', () => {
    const fixedCommitments = [
      { id: 'c1', title: 'Dean Seminar', startTime: '10:00', endTime: '11:30', isFixed: true },
      { id: 'c2', title: 'Physics Lecture', startTime: '11:00', endTime: '12:00', isFixed: true }
    ];

    const conflicts = detectSchedulingConflicts({
      date: '2026-11-16',
      blocks: [],
      fixedCommitments,
      availability: testAvailability
    });

    const overlap = conflicts.find(c => c.type === CONFLICT_TYPES.OVERLAP);
    expect(overlap).toBeDefined();
    expect(overlap.severity).toBe(CONFLICT_SEVERITIES.HARD);
    expect(overlap.explanation).toContain('Fixed commitment collision');
    expect(overlap.isResolvable).toBe(false); // Two fixed events cannot be auto-resolved
  });

  it('detects HARD conflict when a flexible task collides with a locked schedule block', () => {
    const blocks = [
      { id: 'b_locked', title: 'Dentist Appointment', startTime: '14:00', endTime: '15:00', isLocked: true, blockType: 'task' },
      { id: 'b_flexible', title: 'Math Homework', startTime: '14:30', endTime: '16:00', isLocked: false, blockType: 'task' }
    ];

    const conflicts = detectSchedulingConflicts({
      date: '2026-11-16',
      blocks,
      availability: testAvailability
    });

    const lockedConf = conflicts.find(c => c.type === CONFLICT_TYPES.LOCKED_BLOCK_CONFLICT);
    expect(lockedConf).toBeDefined();
    expect(lockedConf.severity).toBe(CONFLICT_SEVERITIES.HARD);
    expect(lockedConf.explanation).toContain('collides with locked block');
  });

  it('detects HARD conflict for task deadline violations', () => {
    const tasks = [
      { id: 't_due', title: 'Urgent Grant Submission', dueDate: '2026-11-16', deadlineTime: '15:00' }
    ];

    const blocks = [
      // Scheduled to finish at 16:30, after 15:00 deadline!
      { id: 'b1', title: 'Urgent Grant Submission', sourceEntityId: 't_due', startTime: '15:30', endTime: '16:30', blockType: 'task' }
    ];

    const conflicts = detectSchedulingConflicts({
      date: '2026-11-16',
      blocks,
      tasks,
      availability: testAvailability
    });

    const deadlineConf = conflicts.find(c => c.type === CONFLICT_TYPES.DEADLINE_VIOLATION);
    expect(deadlineConf).toBeDefined();
    expect(deadlineConf.severity).toBe(CONFLICT_SEVERITIES.HARD);
    expect(deadlineConf.explanation).toContain('after its deadline');
  });

  it('detects HARD conflict for tasks placed outside configured availability', () => {
    const blocks = [
      // Scheduled at 07:00, but working hours start at 09:00
      { id: 'b_early', title: 'Morning Review', startTime: '07:00', endTime: '08:00', blockType: 'task' }
    ];

    const conflicts = detectSchedulingConflicts({
      date: '2026-11-16',
      blocks,
      availability: testAvailability
    });

    const availConf = conflicts.find(c => c.type === CONFLICT_TYPES.AVAILABILITY_BREACH);
    expect(availConf).toBeDefined();
    expect(availConf.severity).toBe(CONFLICT_SEVERITIES.HARD);
    expect(availConf.explanation).toContain('outside configured working hours');
  });

  it('detects SOFT conflict for excessive continuous focus without sufficient breaks', () => {
    const blocks = [
      // 120 minutes continuous focus without break (max is 90 min)
      { id: 'b_focus', title: 'Marathon Coding Session', startTime: '10:00', endTime: '12:00', durationMinutes: 120, blockType: 'task' }
    ];

    const conflicts = detectSchedulingConflicts({
      date: '2026-11-16',
      blocks,
      availability: testAvailability
    });

    const breakConf = conflicts.find(c => c.type === CONFLICT_TYPES.INSUFFICIENT_BREAK);
    expect(breakConf).toBeDefined();
    expect(breakConf.severity).toBe(CONFLICT_SEVERITIES.SOFT);
    expect(breakConf.explanation).toContain('exceeds recommended 90 min');
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeGreeting,
  computeTodayStats,
  computePriorityActions,
  computeNextBestAction,
  computeWeeklyOutlook
} from '../src/modules/command-center/command-center.engine.js';

describe('Stage 2 — Daily Command Center Engine & Intelligence Tests', () => {
  describe('1. Dynamic Greeting Engine', () => {
    it('computes morning greeting between 5:00 and 11:59', () => {
      expect(computeGreeting(5, 'Sarah')).toBe('Good morning, Sarah');
      expect(computeGreeting(9, 'Sarah')).toBe('Good morning, Sarah');
      expect(computeGreeting(11, 'Sarah')).toBe('Good morning, Sarah');
    });

    it('computes afternoon greeting between 12:00 and 16:59', () => {
      expect(computeGreeting(12, 'Marcus')).toBe('Good afternoon, Marcus');
      expect(computeGreeting(14, 'Marcus')).toBe('Good afternoon, Marcus');
      expect(computeGreeting(16, 'Marcus')).toBe('Good afternoon, Marcus');
    });

    it('computes evening greeting between 17:00 and 21:59', () => {
      expect(computeGreeting(17, 'Elena')).toBe('Good evening, Elena');
      expect(computeGreeting(20, 'Elena')).toBe('Good evening, Elena');
    });

    it('computes late night greeting between 22:00 and 4:59', () => {
      expect(computeGreeting(22, 'Dev')).toBe('Working late, Dev');
      expect(computeGreeting(2, 'Dev')).toBe('Working late, Dev');
    });

    it('defaults to "Builder" when username is blank or missing', () => {
      expect(computeGreeting(8, '')).toBe('Good morning, Builder');
      expect(computeGreeting(8, null)).toBe('Good morning, Builder');
      expect(computeGreeting(8, '   ')).toBe('Good morning, Builder');
    });
  });

  describe('2. Consolidated Daily Stats Aggregator', () => {
    const todayStr = '2026-11-15';

    it('correctly calculates tasks, habits, hydration, and pomodoro metrics', () => {
      const mockTasks = [
        { id: '1', title: 'Complete Math Lab', date: '2026-11-15', completed: true, priority: 'high' },
        { id: '2', title: 'Submit Essay', date: '2026-11-15', completed: false, priority: 'high' },
        { id: '3', title: 'Review Flashcards', date: '2026-11-15', completed: false, priority: 'medium' },
        { id: '4', title: 'Buy Groceries', date: '2026-11-20', completed: false, priority: 'low' }
      ];

      const mockHabits = [
        { id: 'h1', name: 'Read 20 mins' },
        { id: 'h2', name: 'Drink water' },
        { id: 'h3', name: 'Meditate' }
      ];

      const mockHabitLogs = {
        '2026-11-15': ['h1', 'h2']
      };

      const mockHydration = { water: 1500, target: 2000 };
      const mockPomodoroStats = { roundsToday: 3 };

      const stats = computeTodayStats({
        tasks: mockTasks,
        habits: mockHabits,
        habitLogs: mockHabitLogs,
        hydration: mockHydration,
        pomodoroStats: mockPomodoroStats,
        todayStr
      });

      expect(stats.tasksTotal).toBe(3);
      expect(stats.tasksDone).toBe(1);
      expect(stats.tasksRemaining).toBe(2);
      expect(stats.highPriorityRemaining).toBe(1);

      expect(stats.habitsTotal).toBe(3);
      expect(stats.habitsDone).toBe(2);
      expect(stats.habitsPct).toBe(67);

      expect(stats.water).toBe(1500);
      expect(stats.waterTarget).toBe(2000);
      expect(stats.waterPct).toBe(75);

      expect(stats.focusRounds).toBe(3);
      expect(stats.focusMinutes).toBe(75);
    });

    it('handles empty or zero-state safely without NaN', () => {
      const stats = computeTodayStats({
        tasks: [],
        habits: [],
        habitLogs: {},
        hydration: {},
        pomodoroStats: {},
        todayStr
      });

      expect(stats.tasksTotal).toBe(0);
      expect(stats.tasksDone).toBe(0);
      expect(stats.habitsTotal).toBe(0);
      expect(stats.habitsPct).toBe(0);
      expect(stats.waterPct).toBe(0);
      expect(stats.focusMinutes).toBe(0);
    });
  });

  describe('3. Ranked Priority Actions', () => {
    const todayStr = '2026-11-15';

    it('prioritizes overdue and urgent academic assessments above regular tasks', () => {
      const assessments = [
        { id: 'ass-1', title: 'Midterm Exam', dueDate: '2026-11-15', courseCode: 'CS101', status: 'pending' },
        { id: 'ass-2', title: 'Overdue Quiz', dueDate: '2026-11-14', courseCode: 'MATH201', status: 'pending' }
      ];

      const tasks = [
        { id: 't-1', title: 'Regular Task', date: '2026-11-15', completed: false, priority: 'medium' },
        { id: 't-2', title: 'High Priority Task', date: '2026-11-15', completed: false, priority: 'high' }
      ];

      const habits = [
        { id: 'h-1', name: 'Workout' }
      ];

      const priorities = computePriorityActions({
        tasks,
        assessments,
        habits,
        habitLogs: {},
        todayStr,
        limit: 5
      });

      expect(priorities.length).toBe(5);
      // Overdue assessment should have highest weight (120)
      expect(priorities[0].id).toBe('ass-2');
      expect(priorities[0].type).toBe('academic');
      // Due today assessment should be second (100)
      expect(priorities[1].id).toBe('ass-1');
      // High priority task should follow (75)
      expect(priorities[2].id).toBe('t-2');
    });

    it('limits output to specified limit and filters completed habits', () => {
      const habits = [
        { id: 'h-1', name: 'Exercise' },
        { id: 'h-2', name: 'Journal' }
      ];
      const habitLogs = {
        '2026-11-15': ['h-1'] // h-1 is done
      };

      const priorities = computePriorityActions({
        tasks: [],
        assessments: [],
        habits,
        habitLogs,
        todayStr,
        limit: 1
      });

      expect(priorities.length).toBe(1);
      expect(priorities[0].id).toBe('h-2'); // only incomplete habit
    });
  });

  describe('4. Explainable Next Best Action Engine', () => {
    const todayStr = '2026-11-15';

    it('recommends urgent assessment when an assessment is due today', () => {
      const assessments = [
        { id: 'ass-99', title: 'Physics Final', dueDate: todayStr, courseCode: 'PHYS101', status: 'pending' }
      ];
      const tasks = [
        { id: 't-1', title: 'Write code', priority: 'high', completed: false, date: todayStr }
      ];

      const action = computeNextBestAction({
        assessments,
        tasks,
        hour: 9,
        todayStr
      });

      expect(action.actionType).toBe('academic');
      expect(action.title).toContain('Physics Final');
      expect(action.reason).toContain('High Stakes Deadline');
      expect(action.targetId).toBe('ass-99');
    });

    it('recommends deep work for high priority task in peak morning hours (hour < 12)', () => {
      const tasks = [
        { id: 't-focus', title: 'Architect System Core', priority: 'high', completed: false, date: todayStr }
      ];

      const action = computeNextBestAction({
        tasks,
        hour: 10,
        todayStr
      });

      expect(action.actionType).toBe('task');
      expect(action.title).toBe('Architect System Core');
      expect(action.reason).toContain('Peak Morning Focus');
    });

    it('recommends afternoon execution during 12:00-16:59', () => {
      const tasks = [
        { id: 't-exec', title: 'Deploy Web Service', priority: 'medium', completed: false, date: todayStr }
      ];

      const action = computeNextBestAction({
        tasks,
        hour: 14,
        todayStr
      });

      expect(action.actionType).toBe('task');
      expect(action.title).toBe('Deploy Web Service');
      expect(action.reason).toContain('Afternoon Execution');
    });

    it('recommends habit completion in evening hours (hour >= 17)', () => {
      const habits = [
        { id: 'h-evening', name: 'Reflective Journaling' }
      ];

      const action = computeNextBestAction({
        tasks: [],
        habits,
        habitLogs: {},
        hour: 19,
        todayStr
      });

      expect(action.actionType).toBe('habit');
      expect(action.title).toContain('Reflective Journaling');
      expect(action.reason).toContain('Evening Consistency');
    });

    it('returns celebratory all-clear recommendation when all objectives are completed', () => {
      const action = computeNextBestAction({
        tasks: [],
        assessments: [],
        habits: [],
        habitLogs: {},
        hour: 15,
        todayStr
      });

      expect(action.actionType).toBe('done');
      expect(action.title).toBe('Daily Objectives Cleared!');
      expect(action.reason).toContain('All priority actions for today are complete');
    });
  });

  describe('5. Weekly Outlook Strip Aggregator', () => {
    it('returns a 7-day strip with task counts and today indicator', () => {
      const baseDate = new Date('2026-11-15T12:00:00Z'); // Sunday
      const tasks = [
        { id: '1', date: '2026-11-15', completed: false, priority: 'high' },
        { id: '2', date: '2026-11-15', completed: true, priority: 'low' },
        { id: '3', date: '2026-11-10', completed: true, priority: 'medium' }
      ];

      const week = computeWeeklyOutlook({ tasks, baseDate });

      expect(week.length).toBe(7);
      const todayPill = week.find(d => d.isToday);
      expect(todayPill).toBeDefined();
      expect(todayPill.dateStr).toBe('2026-11-15');
      expect(todayPill.totalCount).toBe(2);
      expect(todayPill.doneCount).toBe(1);
      expect(todayPill.hasHigh).toBe(true);
    });
  });
});


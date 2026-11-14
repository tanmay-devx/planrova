/**
 * dataFixtures.js — Planrova Reusable Test Fixtures
 */

export const mockTasks = [
  {
    id: 'task_1',
    title: 'Complete Operating Systems Assignment',
    desc: 'Solve CPU scheduling problems in Chapter 5',
    date: '2026-11-14',
    startTime: '09:00',
    endTime: '11:00',
    category: 'study',
    priority: 'high',
    completed: false,
    updated_at: 1700000000000
  },
  {
    id: 'task_2',
    title: 'Drink 3L Water',
    desc: 'Daily Habit: Drink 3L Water',
    date: '2026-11-14',
    startTime: '08:00',
    endTime: '',
    category: 'health',
    priority: 'medium',
    completed: true,
    updated_at: 1700000100000
  }
];

export const mockHabits = [
  {
    id: 'h1',
    name: 'Drink 3L Water',
    streak: 5,
    icon: 'water-outline',
    logs: ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']
  },
  {
    id: 'h2',
    name: 'Read 10 Pages',
    streak: 2,
    icon: 'book-outline',
    logs: ['2026-11-13', '2026-11-14']
  }
];

export const mockExpenses = [
  {
    id: 'exp_1',
    amount: 150,
    amount_minor: 15000,
    category: 'Food',
    notes: 'Campus Canteen Lunch',
    date: '2026-11-14'
  },
  {
    id: 'exp_2',
    amount: 45.50,
    amount_minor: 4550,
    category: 'Transport',
    notes: 'Bus pass recharge',
    date: '2026-11-14'
  }
];

export const mockNotes = [
  {
    id: 'note_2026-11-14',
    date: '2026-11-14',
    title: 'Distributed Systems Lecture Notes',
    content: 'Discussed Raft consensus algorithm and Byzantine fault tolerance.',
    pinned: true,
    tags: ['college', 'cs'],
    linkedTasks: ['task_1']
  }
];

export const mockHydrationLogs = [
  {
    id: 'h_1700000000',
    amount: 500,
    type: 'Water',
    date: '2026-11-14',
    timestamp: 1700000000000
  },
  {
    id: 'h_1700003600',
    amount: 250,
    type: 'Water',
    date: '2026-11-14',
    timestamp: 1700003600000
  }
];


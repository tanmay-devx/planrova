import { describe, it, expect } from 'vitest';
import { searchUniversal } from '../src/modules/search/search.engine.js';

describe('Stage 3A — Universal Global Search Engine Tests', () => {
  const mockTasks = [
    { id: 't1', title: 'Calculus Assignment 4', desc: 'Derivatives practice', category: 'academic', dueDate: '2026-11-16', completed: false },
    { id: 't2', title: 'Prepare Board Pitch', desc: 'Q4 financials', category: 'work', dueDate: '2026-11-18', completed: false },
    { id: 't3', title: 'Old Deleted Task', deleted: true }
  ];

  const mockNotes = [
    { id: 'n1', date: '2026-11-15', title: 'Quantum Computing Lecture Notes', content: 'Qubits superposition', subject: 'Physics' },
    { id: 'n2', date: '2026-11-14', title: 'Weekly Sprint Retrospective', content: 'Velocity improved', subject: 'Work' }
  ];

  const mockCourses = [
    { id: 'c1', code: 'CS201', name: 'Data Structures and Algorithms', instructor: 'Prof. Cormen', credits: 4 },
    { id: 'c2', code: 'ECON101', name: 'Principles of Macroeconomics', instructor: 'Dr. Keynes', credits: 3 }
  ];

  const mockAssessments = [
    { id: 'a1', title: 'Midterm Exam', courseCode: 'CS201', type: 'exam', dueDate: '2026-11-20' },
    { id: 'a2', title: 'Essay on Fiscal Policy', courseCode: 'ECON101', type: 'assignment', dueDate: '2026-11-22' }
  ];

  const mockSyllabus = [
    { id: 's1', title: 'Binary Search Trees & Balancing', courseCode: 'CS201', status: 'completed' },
    { id: 's2', title: 'Inflation Dynamics', courseCode: 'ECON101', status: 'pending' }
  ];

  const mockTransactions = [
    { id: 'tx1', title: 'Campus Bookstore', amount: 84.50, type: 'expense', category: 'Education' },
    { id: 'tx2', title: 'Freelance Design Payment', amount: 450.00, type: 'income', category: 'Work' }
  ];

  const mockHabits = [
    { id: 'h1', name: 'Morning Cardio Run', category: 'Health' },
    { id: 'h2', name: 'Algorithm LeetCode Problem', category: 'Learning' }
  ];

  const mockActions = [
    { id: 'act_add_task', title: '+ Add Task', desc: 'Create planner task', icon: '+' },
    { id: 'act_pomo', title: 'Start Focus Session', desc: 'Pomodoro timer', icon: '⏱️' }
  ];

  it('returns default actions and recent active items when query is empty', () => {
    const results = searchUniversal({
      query: '',
      tasks: mockTasks,
      notes: mockNotes,
      courses: mockCourses,
      assessments: mockAssessments,
      syllabusTopics: mockSyllabus,
      transactions: mockTransactions,
      habits: mockHabits,
      actions: mockActions
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'act_add_task')).toBe(true);
    expect(results.some(r => r.type === 'task')).toBe(true);
    expect(results.some(r => r.type === 'note')).toBe(true);
  });

  it('searches tasks across title, description, and category', () => {
    const results = searchUniversal({
      query: 'Calculus',
      tasks: mockTasks
    });

    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Calculus Assignment 4');
    expect(results[0].type).toBe('task');
    expect(results[0].category).toBe('Tasks');
  });

  it('searches notes across title, content, and subject', () => {
    const results = searchUniversal({
      query: 'superposition',
      notes: mockNotes
    });

    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Quantum Computing Lecture Notes');
    expect(results[0].type).toBe('note');
  });

  it('searches academic courses by course code and instructor', () => {
    const byCode = searchUniversal({
      query: 'CS201',
      courses: mockCourses
    });
    expect(byCode.length).toBe(1);
    expect(byCode[0].title).toContain('CS201: Data Structures');

    const byInstructor = searchUniversal({
      query: 'Cormen',
      courses: mockCourses
    });
    expect(byInstructor.length).toBe(1);
    expect(byInstructor[0].desc).toContain('Prof. Cormen');
  });

  it('searches academic assessments and syllabus topics', () => {
    const assResults = searchUniversal({
      query: 'Fiscal Policy',
      assessments: mockAssessments
    });
    expect(assResults.length).toBe(1);
    expect(assResults[0].title).toBe('Essay on Fiscal Policy');
    expect(assResults[0].type).toBe('assessment');

    const topResults = searchUniversal({
      query: 'Binary Search Trees',
      syllabusTopics: mockSyllabus
    });
    expect(topResults.length).toBe(1);
    expect(topResults[0].type).toBe('topic');
  });

  it('searches finance transactions by title and category', () => {
    const results = searchUniversal({
      query: 'Bookstore',
      transactions: mockTransactions
    });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Campus Bookstore');
    expect(results[0].type).toBe('transaction');
    expect(results[0].icon).toBe('💳');
  });

  it('searches habits by name', () => {
    const results = searchUniversal({
      query: 'Cardio',
      habits: mockHabits
    });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Morning Cardio Run');
    expect(results[0].type).toBe('habit');
  });

  it('filters out deleted items across all domains', () => {
    const results = searchUniversal({
      query: 'Deleted',
      tasks: mockTasks
    });
    expect(results.length).toBe(0);
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedStarterData } from '../src/modules/onboarding/onboarding.ui.js';
import { ACADEMIC_STORAGE_KEYS } from '../shared/domain/academic/academic.types.js';

// In-memory mock storage
const storageMap = new Map();
vi.mock('../src/utils/storage.js', () => ({
  getStorageItem: vi.fn((key, defaultValue) => {
    return storageMap.has(key) ? storageMap.get(key) : defaultValue;
  }),
  setStorageItem: vi.fn((key, value) => {
    storageMap.set(key, value);
  })
}));

describe('Stage 3C — Guided Onboarding & Persona Starter Seeding Tests', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
  });

  it('seeds academic starter courses, assessments, and habits for Student persona', () => {
    seedStarterData('student');

    const habits = storageMap.get('user_habits');
    expect(habits).toBeDefined();
    expect(habits.length).toBeGreaterThan(0);
    expect(habits.some(h => h.name.includes('Water'))).toBe(true);

    const courses = storageMap.get(ACADEMIC_STORAGE_KEYS.COURSES);
    expect(courses).toBeDefined();
    expect(courses.length).toBe(1);
    expect(courses[0].code).toBe('CS101');

    const assessments = storageMap.get(ACADEMIC_STORAGE_KEYS.ASSESSMENTS);
    expect(assessments).toBeDefined();
    expect(assessments.length).toBe(1);
    expect(assessments[0].courseCode).toBe('CS101');
  });

  it('seeds professional priority tasks and starter habits for Professional persona', () => {
    seedStarterData('professional');

    const habits = storageMap.get('user_habits');
    expect(habits).toBeDefined();
    expect(habits.length).toBeGreaterThan(0);

    const tasks = storageMap.get('tasks');
    expect(tasks).toBeDefined();
    expect(tasks.length).toBe(2);
    expect(tasks.some(t => t.title.includes('Architecture'))).toBe(true);

    // Should not seed academic courses for pure professional persona
    expect(storageMap.has(ACADEMIC_STORAGE_KEYS.COURSES)).toBe(false);
  });

  it('does not overwrite existing collections if user already has data', () => {
    storageMap.set('user_habits', [{ id: 'custom-h', name: 'Existing Custom Habit' }]);
    storageMap.set(ACADEMIC_STORAGE_KEYS.COURSES, [{ id: 'custom-c', code: 'MATH300' }]);

    seedStarterData('student');

    const habits = storageMap.get('user_habits');
    expect(habits.length).toBe(1);
    expect(habits[0].name).toBe('Existing Custom Habit');

    const courses = storageMap.get(ACADEMIC_STORAGE_KEYS.COURSES);
    expect(courses.length).toBe(1);
    expect(courses[0].code).toBe('MATH300');
  });
});


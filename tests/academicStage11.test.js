/**
 * tests/academicStage11.test.js
 * Stage 11: Academic Storage, Account Isolation & Migration Verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveSemester,
  getSemesters,
  saveCourse,
  getCourses,
  saveTopic,
  getSyllabusTopics,
  saveAssessment,
  getAssessments,
  saveAssignment,
  getAssignments,
  saveFlashcard,
  getFlashcards
} from '../src/modules/academic/academic-storage.js';
import { clearMemoryCache, setCurrentUserId, getCurrentUserId, getScopedRecordId } from '../src/utils/storage.js';

describe('Academic Domain - Stage 11: Storage & Account Isolation', () => {
  beforeEach(() => {
    clearMemoryCache();
    setCurrentUserId('user_alice');
  });

  it('isolates academic records between User A and User B', () => {
    // 1. User Alice creates courses and topics
    setCurrentUserId('user_alice');
    const courseAlice = saveCourse({
      id: 'crs_alice_1',
      name: 'Alice Computer Science',
      credits: 4
    });
    expect(getCourses()).toHaveLength(1);
    expect(getCourses()[0].name).toBe('Alice Computer Science');

    // 2. Switch to User Bob
    clearMemoryCache();
    setCurrentUserId('user_bob');
    expect(getCourses()).toHaveLength(0); // Bob has zero courses

    const courseBob = saveCourse({
      id: 'crs_bob_1',
      name: 'Bob Mechanical Engineering',
      credits: 3
    });
    expect(getCourses()).toHaveLength(1);
    expect(getCourses()[0].name).toBe('Bob Mechanical Engineering');

    // 3. Switch back to Alice
    clearMemoryCache();
    setCurrentUserId('user_alice');
    // In-memory cache cleared; if restored, scoped ID matches alice
    expect(getCurrentUserId()).toBe('user_alice');
    const aliceScopedKey = getScopedRecordId('academic_courses', 'user_alice');
    const bobScopedKey = getScopedRecordId('academic_courses', 'user_bob');
    expect(aliceScopedKey).toBe('user_alice:academic_courses');
    expect(bobScopedKey).toBe('user_bob:academic_courses');
  });

  it('correctly persists and normalizes academic entities through storage adapter', () => {
    const sem = saveSemester({ name: 'Fall 2026', targetSGPA: 3.9 });
    expect(sem.id).toBeDefined();
    expect(sem.name).toBe('Fall 2026');

    const course = saveCourse({ name: 'Advanced Algorithms', semesterId: sem.id, credits: 4 });
    expect(course.id).toBeDefined();

    const topic = saveTopic({ courseId: course.id, title: 'Network Flow', estimatedMinutes: 60 });
    expect(topic.id).toBeDefined();

    const asm = saveAssessment({ courseId: course.id, title: 'Final Exam', weightPercentage: 50 });
    expect(asm.id).toBeDefined();

    const asgn = saveAssignment({ courseId: course.id, title: 'Homework 1', estimatedMinutes: 90 });
    expect(asgn.id).toBeDefined();

    const card = saveFlashcard({ courseId: course.id, front: 'Ford-Fulkerson?', back: 'Max flow algorithm' });
    expect(card.id).toBeDefined();
    expect(card.box).toBe(1);
  });
});


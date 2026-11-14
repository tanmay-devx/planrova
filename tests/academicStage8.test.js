/**
 * tests/academicStage8.test.js
 * Stage 8: Academic Intelligence Dashboard Verification
 */

import { describe, it, expect } from 'vitest';
import {
  computeAcademicDashboard,
  SEMESTER_STATUSES,
  COURSE_STATUSES,
  ASSESSMENT_TYPES,
  ASSESSMENT_STATUSES,
  TOPIC_MASTERY_LEVELS
} from '../shared/domain/academic/index.js';

describe('Academic Domain - Stage 8: Academic Intelligence Dashboard', () => {
  const refDate = '2026-11-14';

  const mockSemester = {
    id: 'sem_1',
    name: 'Fall 2026',
    status: SEMESTER_STATUSES.ACTIVE,
    targetSGPA: 3.7
  };

  const mockCourses = [
    { id: 'cs101', semesterId: 'sem_1', name: 'Algorithms', courseCode: 'CS 101', credits: 4, status: COURSE_STATUSES.ACTIVE },
    { id: 'math201', semesterId: 'sem_1', name: 'Calculus', courseCode: 'MATH 201', credits: 3, status: COURSE_STATUSES.ACTIVE }
  ];

  const mockTopics = [
    { id: 'top_dp', courseId: 'cs101', title: 'Dynamic Programming', masteryLevel: TOPIC_MASTERY_LEVELS.UNSTARTED, completed: false },
    { id: 'top_int', courseId: 'math201', title: 'Integration Techniques', masteryLevel: TOPIC_MASTERY_LEVELS.LEARNING, completed: false }
  ];

  const mockAssessments = [
    // Imminent exam in 3 days: 2026-11-17
    { id: 'exam_cs', courseId: 'cs101', title: 'Midterm 2', type: ASSESSMENT_TYPES.MIDTERM, status: ASSESSMENT_STATUSES.PENDING, examDate: '2026-11-17' },
    // Later exam in 30 days: 2026-12-14
    { id: 'exam_math', courseId: 'math201', title: 'Final Exam', type: ASSESSMENT_TYPES.FINAL, status: ASSESSMENT_STATUSES.PENDING, examDate: '2026-12-14' }
  ];

  const mockAssignments = [
    // Overdue: due 2026-11-12
    { id: 'asgn_overdue', courseId: 'cs101', title: 'Problem Set 4', dueDate: '2026-11-12', priority: 'high', status: 'not_started' },
    // Due tomorrow: 2026-11-15 (within 48h)
    { id: 'asgn_urgent', courseId: 'math201', title: 'Homework 6', dueDate: '2026-11-15', priority: 'urgent', status: 'in_progress' },
    // Due next week: 2026-11-25
    { id: 'asgn_future', courseId: 'cs101', title: 'Project Draft', dueDate: '2026-11-25', priority: 'medium', status: 'not_started' }
  ];

  const mockFlashcards = [
    // Struggling card in Box 1 with 3 reviews
    { id: 'f1', courseId: 'cs101', topicId: 'top_dp', box: 1, reviewCount: 3, nextReviewDate: '2026-11-14' },
    // Mastered card in Box 5
    { id: 'f2', courseId: 'math201', topicId: 'top_int', box: 5, reviewCount: 6, nextReviewDate: '2026-11-30' }
  ];

  it('aggregates complete dashboard with urgent deliverables, exams, and weak topics', () => {
    const dashboard = computeAcademicDashboard({
      semester: mockSemester,
      courses: mockCourses,
      topics: mockTopics,
      assessments: mockAssessments,
      assignments: mockAssignments,
      flashcards: mockFlashcards,
      referenceDateStr: refDate
    });

    expect(dashboard).toBeDefined();

    // 1. Urgent deliverables (overdue + within 48h) -> should have 2 items
    expect(dashboard.urgentDeliverables).toHaveLength(2);
    expect(dashboard.urgentDeliverables[0].id).toBe('asgn_overdue');
    expect(dashboard.urgentDeliverables[0].isOverdue).toBe(true);
    expect(dashboard.urgentDeliverables[1].id).toBe('asgn_urgent');
    expect(dashboard.urgentDeliverables[1].isOverdue).toBe(false);

    // 2. Upcoming exams countdown
    expect(dashboard.upcomingExams).toHaveLength(2);
    expect(dashboard.upcomingExams[0].id).toBe('exam_cs');
    expect(dashboard.upcomingExams[0].daysRemaining).toBe(3); // 2026-11-17 - 2026-11-14 = 3 days
    expect(dashboard.upcomingExams[1].id).toBe('exam_math');
    expect(dashboard.upcomingExams[1].daysRemaining).toBe(30);

    // 3. Spaced repetition summary
    expect(dashboard.flashcardsSummary.totalDue).toBe(1); // Only f1 is due today
    expect(dashboard.flashcardsSummary.dueByCourse['cs101']).toBe(1);

    // 4. Evidence-based Weak Topics
    // top_dp is flagged because:
    // (a) Flashcard f1 is repeatedly failing in Box 1
    // (b) Midterm 2 is in 3 days and topic is unstarted
    expect(dashboard.weakTopics.length).toBeGreaterThanOrEqual(1);
    const dpWeak = dashboard.weakTopics.find(w => w.topicId === 'top_dp');
    expect(dpWeak).toBeDefined();
    expect(dpWeak.courseId).toBe('cs101');
    expect(dpWeak.severity).toBeDefined();
  });
});


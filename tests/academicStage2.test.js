/**
 * tests/academicStage2.test.js
 * Stage 2: Semester & Course Workspaces Engine Verification
 */

import { describe, it, expect } from 'vitest';
import {
  filterCoursesBySemester,
  computeCourseMetrics,
  computeSemesterSummary,
  COURSE_STATUSES,
  SEMESTER_STATUSES,
  TOPIC_MASTERY_LEVELS,
  ASSESSMENT_STATUSES,
  GRADING_SCALE_TYPES
} from '../shared/domain/academic/index.js';

describe('Academic Domain - Stage 2: Course & Semester Workspaces', () => {
  const mockSemester = {
    id: 'sem_fall_2026',
    name: 'Fall 2026',
    status: SEMESTER_STATUSES.ACTIVE,
    targetSGPA: 3.8
  };

  const mockCourses = [
    {
      id: 'course_cs101',
      semesterId: 'sem_fall_2026',
      name: 'Introduction to Algorithms',
      courseCode: 'CS 101',
      credits: 4,
      color: '#4f46e5',
      status: COURSE_STATUSES.ACTIVE
    },
    {
      id: 'course_math201',
      semesterId: 'sem_fall_2026',
      name: 'Linear Algebra',
      courseCode: 'MATH 201',
      credits: 3,
      color: '#059669',
      status: COURSE_STATUSES.ACTIVE
    },
    {
      id: 'course_phys101',
      semesterId: 'sem_fall_2026',
      name: 'Classical Mechanics',
      courseCode: 'PHYS 101',
      credits: 3,
      color: '#dc2626',
      status: COURSE_STATUSES.DROPPED
    },
    {
      id: 'course_old',
      semesterId: 'sem_spring_2026',
      name: 'Old Course',
      credits: 3,
      status: COURSE_STATUSES.ARCHIVED
    }
  ];

  const mockTopics = [
    // CS 101 Topics
    { id: 't1', courseId: 'course_cs101', title: 'Sorting', completed: true, masteryLevel: TOPIC_MASTERY_LEVELS.MASTERED, estimatedMinutes: 60 },
    { id: 't2', courseId: 'course_cs101', title: 'Binary Search', completed: false, masteryLevel: TOPIC_MASTERY_LEVELS.LEARNING, estimatedMinutes: 45 },
    { id: 't3', courseId: 'course_cs101', title: 'Graph Traversal', completed: false, masteryLevel: TOPIC_MASTERY_LEVELS.UNSTARTED, estimatedMinutes: 90 },
    // MATH 201 Topics
    { id: 't4', courseId: 'course_math201', title: 'Vector Spaces', completed: true, masteryLevel: TOPIC_MASTERY_LEVELS.MASTERED, estimatedMinutes: 60 }
  ];

  const mockAssessments = [
    // CS 101
    { id: 'a1', courseId: 'course_cs101', title: 'Quiz 1', status: ASSESSMENT_STATUSES.GRADED, totalMarks: 20, obtainedMarks: 18, weightPercentage: 10 },
    { id: 'a2', courseId: 'course_cs101', title: 'Midterm', status: ASSESSMENT_STATUSES.GRADED, totalMarks: 100, obtainedMarks: 85, weightPercentage: 30 },
    { id: 'a3', courseId: 'course_cs101', title: 'Final Exam', status: ASSESSMENT_STATUSES.PENDING, examDate: '2026-12-10', totalMarks: 100, weightPercentage: 60 },
    // MATH 201
    { id: 'a4', courseId: 'course_math201', title: 'Exam 1', status: ASSESSMENT_STATUSES.GRADED, totalMarks: 100, obtainedMarks: 95, weightPercentage: 40 },
    { id: 'a5', courseId: 'course_math201', title: 'Exam 2', status: ASSESSMENT_STATUSES.PENDING, examDate: '2026-11-20', totalMarks: 100, weightPercentage: 60 }
  ];

  const mockAssignments = [
    { id: 'as1', courseId: 'course_cs101', title: 'PSet 1', status: 'completed', estimatedMinutes: 120 },
    { id: 'as2', courseId: 'course_cs101', title: 'PSet 2', status: 'not_started', dueDate: '2026-11-10', estimatedMinutes: 90 }, // Overdue if ref date is 2026-11-14
    { id: 'as3', courseId: 'course_cs101', title: 'PSet 3', status: 'in_progress', dueDate: '2026-11-20', estimatedMinutes: 60 },
    { id: 'as4', courseId: 'course_math201', title: 'Homework 1', status: 'not_started', dueDate: '2026-11-18', estimatedMinutes: 45 }
  ];

  const referenceDateStr = '2026-11-14';

  describe('filterCoursesBySemester', () => {
    it('filters courses by semester excluding dropped and archived by default', () => {
      const activeCourses = filterCoursesBySemester(mockCourses, 'sem_fall_2026', false);
      expect(activeCourses).toHaveLength(2);
      expect(activeCourses.map(c => c.id)).toEqual(['course_cs101', 'course_math201']);
    });

    it('includes inactive courses when includeInactive is true', () => {
      const allCourses = filterCoursesBySemester(mockCourses, 'sem_fall_2026', true);
      expect(allCourses).toHaveLength(3);
      expect(allCourses.map(c => c.id)).toContain('course_phys101');
    });
  });

  describe('computeCourseMetrics', () => {
    it('computes accurate metrics for a course with topics, assessments, and assignments', () => {
      const metrics = computeCourseMetrics({
        course: mockCourses[0],
        topics: mockTopics,
        assessments: mockAssessments,
        assignments: mockAssignments,
        gradingScale: GRADING_SCALE_TYPES.LETTER_4_0,
        referenceDateStr
      });

      expect(metrics).toBeDefined();
      expect(metrics.courseId).toBe('course_cs101');
      expect(metrics.courseCode).toBe('CS 101');
      expect(metrics.credits).toBe(4);

      // Syllabus Topics (1 completed out of 3 -> 33.3%)
      expect(metrics.totalTopics).toBe(3);
      expect(metrics.masteredTopics).toBe(1);
      expect(metrics.syllabusCompletionPercentage).toBe(33.3);
      // Remaining topic study minutes: 45 + 90 = 135
      expect(metrics.remainingTopicMinutes).toBe(135);

      // Grades
      // Quiz 1: 18/20 = 90% of 10% weight = 9.0 earned
      // Midterm: 85/100 = 85% of 30% weight = 25.5 earned
      // Completed contribution = 34.5 out of 40% completed weight -> currentScore = (34.5 / 40) * 100 = 86.25%
      expect(metrics.currentScorePercent).toBe(86.25);
      // 86.25% on US 4.0 scale falls into B (83 - 86.99) -> 3.0 points
      expect(metrics.currentLetter).toBe('B');
      expect(metrics.currentGradePoint).toBe(3.0);

      // Projected min/max
      // Min score (0 on 60% final) = 34.5% -> F (0.0)
      expect(metrics.projectedMinGradePoint).toBe(0.0);
      expect(metrics.projectedMinLetter).toBe('F');
      // Max score (100 on 60% final) = 34.5 + 60 = 94.5% -> A (4.0)
      expect(metrics.projectedMaxGradePoint).toBe(4.0);
      expect(metrics.projectedMaxLetter).toBe('A');

      // Assignments
      expect(metrics.assignments.total).toBe(3);
      expect(metrics.assignments.completed).toBe(1);
      expect(metrics.assignments.pending).toBe(2);
      expect(metrics.assignments.overdue).toBe(1); // PSet 2 due 2026-11-10
      expect(metrics.assignments.totalEstimatedMinutes).toBe(150); // 90 + 60

      // Upcoming assessments (Final Exam)
      expect(metrics.upcomingAssessments).toHaveLength(1);
      expect(metrics.upcomingAssessments[0].id).toBe('a3');
    });

    it('handles empty course gracefully without crashing', () => {
      const emptyCourse = { id: 'empty', name: 'Empty Course', credits: 3 };
      const metrics = computeCourseMetrics({
        course: emptyCourse,
        topics: [],
        assessments: [],
        assignments: []
      });

      expect(metrics.syllabusCompletionPercentage).toBe(0);
      expect(metrics.currentScorePercent).toBeNull();
      expect(metrics.currentGradePoint).toBe(0.0);
      expect(metrics.assignments.total).toBe(0);
      expect(metrics.upcomingAssessments).toHaveLength(0);
    });
  });

  describe('computeSemesterSummary', () => {
    it('aggregates credit load, weighted progress, and SGPA across enrolled courses', () => {
      const summary = computeSemesterSummary({
        semester: mockSemester,
        courses: mockCourses,
        topics: mockTopics,
        assessments: mockAssessments,
        assignments: mockAssignments,
        referenceDateStr
      });

      expect(summary.semesterId).toBe('sem_fall_2026');
      expect(summary.courseCount).toBe(2); // Only active courses
      expect(summary.totalCredits).toBe(7); // CS 101 (4) + MATH 201 (3)
      expect(summary.gradedCredits).toBe(7);

      // CS 101 grade point: 3.0 (4 credits -> 12.0 QP)
      // MATH 201: 95/100 -> 95% -> A (4.0 points, 3 credits -> 12.0 QP)
      // Total QP = 24.0 / 7 = 3.43 SGPA
      expect(summary.currentSGPA).toBe(3.43);
      expect(summary.targetSGPA).toBe(3.8);

      // Deliverables across all courses
      // CS 101 (2 pending, 1 overdue) + MATH 201 (1 pending, 0 overdue) = 3 pending, 1 overdue
      expect(summary.totalPendingAssignments).toBe(3);
      expect(summary.totalOverdueAssignments).toBe(1);

      // Upcoming exams: CS 101 Final + MATH 201 Exam 2 = 2
      expect(summary.totalUpcomingAssessments).toBe(2);

      // Total estimated work: CS 101 (135 topic + 150 asgn = 285) + MATH 201 (0 topic + 45 asgn = 45) = 330 mins
      expect(summary.totalEstimatedWorkMinutes).toBe(330);
    });
  });
});


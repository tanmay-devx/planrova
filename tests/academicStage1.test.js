/**
 * tests/academicStage1.test.js
 * Stage 1: Academic Domain Architecture & Schema Verification
 */

import { describe, it, expect } from 'vitest';
import {
  SEMESTER_STATUSES,
  COURSE_STATUSES,
  TOPIC_MASTERY_LEVELS,
  ASSESSMENT_TYPES,
  ASSESSMENT_STATUSES,
  GRADING_SCALE_TYPES,
  DEFAULT_GRADING_SCALES,
  LEITNER_BOX_INTERVALS,
  validateSemester,
  normalizeSemester,
  validateCourse,
  normalizeCourse,
  validateTopic,
  normalizeTopic,
  validateAssessment,
  normalizeAssessment,
  validateAssignment,
  normalizeAssignment,
  validateDeck,
  normalizeDeck,
  validateFlashcard,
  normalizeFlashcard,
  validateAcademicEntity,
  calculateTopicProgress,
  buildTopicHierarchy,
  calculateWeightedGrade,
  mapScoreToGradePoints,
  calculateSGPA,
  calculateCGPA,
  simulateRequiredSGPA,
  validateAssignmentDependencies,
  calculateNextLeitnerReview,
  getDueFlashcards
} from '../shared/domain/academic/index.js';

describe('Academic Domain - Stage 1: Schemas & Validation', () => {
  describe('Semester Schema', () => {
    it('validates a correct semester', () => {
      const validSem = {
        id: 'sem_1',
        title: 'Fall 2026',
        startDate: '2026-08-15',
        endDate: '2026-12-15',
        status: SEMESTER_STATUSES.ACTIVE
      };
      const result = validateSemester(validSem);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid semester parameters', () => {
      const invalidSem = {
        id: '',
        title: '',
        startDate: 'invalid-date',
        endDate: '2026-08-01', // End before start
        status: 'invalid_status'
      };
      const result = validateSemester(invalidSem);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it('normalizes semester with defaults', () => {
      const normalized = normalizeSemester({
        title: 'Spring 2027'
      });
      expect(normalized.id).toBeDefined();
      expect(normalized.title).toBe('Spring 2027');
      expect(normalized.status).toBe(SEMESTER_STATUSES.UPCOMING);
      expect(normalized.targetSGPA).toBeNull();
      expect(normalized.actualSGPA).toBeNull();
    });
  });

  describe('Course Schema', () => {
    it('validates a valid course', () => {
      const course = {
        id: 'cs101',
        title: 'Intro to Computer Science',
        code: 'CS 101',
        credits: 4,
        status: COURSE_STATUSES.ACTIVE
      };
      const result = validateCourse(course);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid credits and empty title', () => {
      const invalidCourse = {
        id: 'cs101',
        title: '   ',
        credits: -1
      };
      const result = validateCourse(invalidCourse);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('title is required and must be a non-empty string');
      expect(result.errors).toContain('credits must be a non-negative number');
    });

    it('normalizes course properly', () => {
      const norm = normalizeCourse({
        title: 'Algorithms',
        credits: 3.5,
        color: '#ff0000'
      });
      expect(norm.title).toBe('Algorithms');
      expect(norm.credits).toBe(3.5);
      expect(norm.color).toBe('#ff0000');
      expect(norm.gradingScaleId).toBe(GRADING_SCALE_TYPES.LETTER_4_0);
    });
  });

  describe('Syllabus Topic Schema', () => {
    it('validates a topic', () => {
      const topic = {
        id: 'top_1',
        courseId: 'cs101',
        title: 'Binary Trees',
        masteryLevel: TOPIC_MASTERY_LEVELS.LEARNING,
        estimatedHours: 5
      };
      const result = validateTopic(topic);
      expect(result.valid).toBe(true);
    });

    it('prevents direct self-parenting', () => {
      const selfParent = {
        id: 'top_1',
        courseId: 'cs101',
        title: 'Recursion',
        parentId: 'top_1'
      };
      const result = validateTopic(selfParent);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A topic cannot be its own parent');
    });

    it('normalizes topic with order and mastery', () => {
      const norm = normalizeTopic({
        courseId: 'cs101',
        title: 'Dynamic Programming',
        order: 2.7
      });
      expect(norm.title).toBe('Dynamic Programming');
      expect(norm.masteryLevel).toBe(TOPIC_MASTERY_LEVELS.UNSTARTED);
      expect(norm.order).toBe(2);
      expect(norm.parentId).toBeNull();
    });
  });

  describe('Assessment Schema', () => {
    it('validates an assessment', () => {
      const asm = {
        id: 'asm_1',
        courseId: 'cs101',
        title: 'Midterm Exam',
        type: ASSESSMENT_TYPES.MIDTERM,
        status: ASSESSMENT_STATUSES.PENDING,
        totalMarks: 100,
        weightPercentage: 25,
        examDate: '2026-10-15'
      };
      const result = validateAssessment(asm);
      expect(result.valid).toBe(true);
    });

    it('rejects obtainedMarks exceeding totalMarks', () => {
      const asm = {
        id: 'asm_1',
        courseId: 'cs101',
        title: 'Quiz 1',
        totalMarks: 20,
        obtainedMarks: 25
      };
      const result = validateAssessment(asm);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('obtainedMarks cannot exceed totalMarks');
    });

    it('normalizes assessment clamping obtainedMarks safely', () => {
      const norm = normalizeAssessment({
        courseId: 'cs101',
        title: 'Quiz 2',
        totalMarks: 50,
        obtainedMarks: 60
      });
      expect(norm.obtainedMarks).toBe(50);
      expect(norm.status).toBe(ASSESSMENT_STATUSES.PENDING);
    });
  });

  describe('Assignment Schema', () => {
    it('validates assignment and dependencies', () => {
      const asgn = {
        id: 'asg_1',
        courseId: 'cs101',
        title: 'Project Milestone 1',
        priority: 'high',
        status: 'in_progress',
        estimatedMinutes: 120,
        dependencyIds: ['asg_0']
      };
      const result = validateAssignment(asgn);
      expect(result.valid).toBe(true);
    });

    it('rejects non-array dependencyIds or invalid minutes', () => {
      const asgn = {
        id: 'asg_1',
        courseId: 'cs101',
        title: 'Broken Asgn',
        estimatedMinutes: -10,
        dependencyIds: 'not-an-array'
      };
      const result = validateAssignment(asgn);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('estimatedMinutes must be a non-negative number');
      expect(result.errors).toContain('dependencyIds must be an array of string IDs');
    });

    it('normalizes assignment and sets completedAt when completed', () => {
      const norm = normalizeAssignment({
        courseId: 'cs101',
        title: 'Finished Homework',
        status: 'completed'
      });
      expect(norm.status).toBe('completed');
      expect(norm.completedAt).toBeTypeOf('number');
      expect(norm.estimatedMinutes).toBe(60);
    });
  });

  describe('Flashcard & Deck Schemas', () => {
    it('validates deck and flashcard', () => {
      const deck = { id: 'd1', title: 'Data Structures' };
      expect(validateDeck(deck).valid).toBe(true);

      const card = {
        id: 'c1',
        deckId: 'd1',
        front: 'What is the time complexity of QuickSort average case?',
        back: 'O(N log N)',
        box: 3
      };
      expect(validateFlashcard(card).valid).toBe(true);
    });

    it('rejects flashcard with invalid box or empty sides', () => {
      const card = {
        id: 'c1',
        deckId: 'd1',
        front: '',
        back: 'Something',
        box: 6
      };
      const res = validateFlashcard(card);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('front text/prompt is required and must be non-empty');
      expect(res.errors).toContain('box must be an integer between 1 and 5');
    });

    it('normalizes flashcard to Box 1 and today review date by default', () => {
      const norm = normalizeFlashcard({
        deckId: 'd1',
        front: 'Question',
        back: 'Answer'
      });
      expect(norm.box).toBe(1);
      expect(norm.nextReviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(norm.consecutiveCorrect).toBe(0);
    });
  });

  describe('Unified Validator validateAcademicEntity', () => {
    it('dispatches to correct entity validators', () => {
      expect(validateAcademicEntity('semester', { id: 's', title: 'T' }).valid).toBe(true);
      expect(validateAcademicEntity('course', { id: 'c', title: 'T' }).valid).toBe(true);
      expect(validateAcademicEntity('topic', { id: 't', courseId: 'c', title: 'T' }).valid).toBe(true);
      expect(validateAcademicEntity('assessment', { id: 'a', courseId: 'c', title: 'T' }).valid).toBe(true);
      expect(validateAcademicEntity('assignment', { id: 'as', courseId: 'c', title: 'T' }).valid).toBe(true);
      expect(validateAcademicEntity('deck', { id: 'd', title: 'T' }).valid).toBe(true);
      expect(validateAcademicEntity('flashcard', { id: 'fc', deckId: 'd', front: 'Q', back: 'A' }).valid).toBe(true);
      expect(validateAcademicEntity('unknown', {}).valid).toBe(false);
    });
  });
});

describe('Academic Domain - Stage 1: Utility Functions', () => {
  describe('calculateTopicProgress', () => {
    it('calculates weighted progress across topic mastery levels', () => {
      const topics = [
        { id: '1', masteryLevel: TOPIC_MASTERY_LEVELS.MASTERED },
        { id: '2', masteryLevel: TOPIC_MASTERY_LEVELS.LEARNING },
        { id: '3', masteryLevel: TOPIC_MASTERY_LEVELS.UNSTARTED }
      ];
      const prog = calculateTopicProgress(topics);
      expect(prog.totalTopics).toBe(3);
      expect(prog.masteredCount).toBe(1);
      expect(prog.learningCount).toBe(1);
      expect(prog.unstartedCount).toBe(1);
      // (1*100 + 1*50 + 0) / 3 = 150 / 3 = 50%
      expect(prog.progressPercentage).toBe(50);
    });

    it('handles empty topics gracefully', () => {
      const prog = calculateTopicProgress([]);
      expect(prog.totalTopics).toBe(0);
      expect(prog.progressPercentage).toBe(0);
    });
  });

  describe('buildTopicHierarchy', () => {
    it('constructs nested tree from flat topics', () => {
      const flat = [
        { id: 'root1', title: 'Module 1', parentId: null, order: 1 },
        { id: 'child1', title: 'Topic 1.1', parentId: 'root1', order: 1 },
        { id: 'child2', title: 'Topic 1.2', parentId: 'root1', order: 2 },
        { id: 'root2', title: 'Module 2', parentId: null, order: 2 }
      ];
      const tree = buildTopicHierarchy(flat);
      expect(tree).toHaveLength(2);
      expect(tree[0].id).toBe('root1');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].id).toBe('child1');
      expect(tree[1].id).toBe('root2');
      expect(tree[1].children).toHaveLength(0);
    });

    it('safely handles circular parent references without infinite recursion', () => {
      const cyclic = [
        { id: 'a', title: 'A', parentId: 'b' },
        { id: 'b', title: 'B', parentId: 'a' }
      ];
      // Since neither is an unparented root and cycle exists, they should be attached safely or handled as root fallback
      const tree = buildTopicHierarchy(cyclic);
      expect(Array.isArray(tree)).toBe(true);
      expect(tree.length).toBeGreaterThan(0);
    });
  });

  describe('calculateWeightedGrade', () => {
    it('calculates current standing without penalizing pending assessments', () => {
      const assessments = [
        // Completed: Quiz 1 (10% weight, scored 90/100 -> 9/10 earned)
        { id: '1', title: 'Quiz 1', status: 'graded', totalMarks: 100, obtainedMarks: 90, weightPercentage: 10 },
        // Completed: Midterm (30% weight, scored 80/100 -> 24/30 earned)
        { id: '2', title: 'Midterm', status: 'graded', totalMarks: 100, obtainedMarks: 80, weightPercentage: 30 },
        // Pending: Final (60% weight, not yet taken)
        { id: '3', title: 'Final', status: 'pending', totalMarks: 100, obtainedMarks: null, weightPercentage: 60 }
      ];

      const res = calculateWeightedGrade(assessments);
      expect(res.completedWeight).toBe(40);
      expect(res.remainingWeight).toBe(60);
      expect(res.earnedWeightPoints).toBe(33); // 9 + 24 = 33
      // Current percentage = (33 / 40) * 100 = 82.5%
      expect(res.currentPercentage).toBe(82.5);
      // Min score (0% on remaining 60%) = 33%
      expect(res.projectedMinPercentage).toBe(33);
      // Max score (100% on remaining 60%) = 33 + 60 = 93%
      expect(res.projectedMaxPercentage).toBe(93);
    });
  });

  describe('mapScoreToGradePoints', () => {
    it('maps percentage to 4.0 scale accurately', () => {
      expect(mapScoreToGradePoints(95, GRADING_SCALE_TYPES.LETTER_4_0)).toEqual({
        letter: 'A',
        points: 4.0
      });
      expect(mapScoreToGradePoints(88, GRADING_SCALE_TYPES.LETTER_4_0)).toEqual({
        letter: 'B+',
        points: 3.3
      });
      expect(mapScoreToGradePoints(55, GRADING_SCALE_TYPES.LETTER_4_0)).toEqual({
        letter: 'F',
        points: 0.0
      });
    });

    it('maps percentage to 10-point scale', () => {
      expect(mapScoreToGradePoints(92, GRADING_SCALE_TYPES.POINTS_10)).toEqual({
        letter: 'O',
        points: 10.0
      });
      expect(mapScoreToGradePoints(75, GRADING_SCALE_TYPES.POINTS_10)).toEqual({
        letter: 'A',
        points: 8.0
      });
    });
  });

  describe('calculateSGPA and calculateCGPA', () => {
    it('calculates SGPA correctly from course credits and grade points', () => {
      const courses = [
        { id: 'c1', credits: 4, gradePoints: 4.0 }, // 16.0
        { id: 'c2', credits: 3, gradePoints: 3.0 }, // 9.0
        { id: 'c3', credits: 3, gradePoints: 3.3 }  // 9.9
      ];
      // Total quality points = 34.9, total credits = 10 -> SGPA = 3.49
      const sgpa = calculateSGPA(courses);
      expect(sgpa.sgpa).toBe(3.49);
    });

    it('calculates cumulative CGPA weighted by semester credits', () => {
      const semesters = [
        { id: 's1', credits: 15, sgpa: 3.6 }, // 54.0 quality points
        { id: 's2', credits: 15, sgpa: 3.2 }  // 48.0 quality points
      ];
      // Total QP = 102.0 / 30 = 3.40
      const cgpa = calculateCGPA(semesters);
      expect(cgpa.cgpa).toBe(3.40);
    });
  });

  describe('simulateRequiredSGPA', () => {
    it('computes realistic required SGPA to reach target CGPA', () => {
      // Completed 60 credits at 3.2 CGPA (192 QP)
      // Taking 15 credits this semester
      // Target CGPA: 3.4 across total 75 credits (requires 255 QP)
      // Required QP this sem = 255 - 192 = 63 QP -> Required SGPA = 63 / 15 = 4.20 (impossible on 4.0 scale)
      const resImpossible = simulateRequiredSGPA({
        completedCredits: 60,
        currentCGPA: 3.2,
        upcomingCredits: 15,
        targetCGPA: 3.4,
        maxGradePoint: 4.0
      });
      expect(resImpossible.requiredSGPA).toBe(4.2);
      expect(resImpossible.isFeasible).toBe(false);

      // Target CGPA: 3.3 across total 75 credits (requires 247.5 QP)
      // Required QP this sem = 247.5 - 192 = 55.5 QP -> Required SGPA = 55.5 / 15 = 3.70 (feasible)
      const resFeasible = simulateRequiredSGPA({
        completedCredits: 60,
        currentCGPA: 3.2,
        upcomingCredits: 15,
        targetCGPA: 3.3,
        maxGradePoint: 4.0
      });
      expect(resFeasible.requiredSGPA).toBe(3.7);
      expect(resFeasible.isFeasible).toBe(true);
    });
  });

  describe('validateAssignmentDependencies', () => {
    it('detects cyclical assignment dependencies and marks blocked assignments', () => {
      const assignments = [
        { id: 'a1', title: 'Task 1', status: 'completed', dependencyIds: [] },
        { id: 'a2', title: 'Task 2', status: 'not_started', dependencyIds: ['a1'] },
        { id: 'a3', title: 'Task 3', status: 'not_started', dependencyIds: ['a2'] }
      ];
      const validDAG = validateAssignmentDependencies(assignments);
      expect(validDAG.hasCycle).toBe(false);
      expect(validDAG.blockedAssignments.map(a => a.id)).not.toContain('a2'); // a1 is completed, so a2 is not blocked
      expect(validDAG.blockedAssignments.map(a => a.id)).toContain('a3'); // a2 is not completed, so a3 is blocked

      const cyclicAssignments = [
        { id: 'c1', title: 'C1', status: 'not_started', dependencyIds: ['c2'] },
        { id: 'c2', title: 'C2', status: 'not_started', dependencyIds: ['c1'] }
      ];
      const cyclicRes = validateAssignmentDependencies(cyclicAssignments);
      expect(cyclicRes.hasCycle).toBe(true);
      expect(cyclicRes.cyclePath.length).toBeGreaterThan(0);
    });
  });

  describe('Leitner Spaced Repetition', () => {
    it('promotes card on easy/good and demotes to Box 1 on again', () => {
      const today = '2026-11-14';
      // Promotion from Box 1 to Box 2
      const promo = calculateNextLeitnerReview({ currentBox: 1, rating: 'good', todayStr: today });
      expect(promo.nextBox).toBe(2);
      expect(promo.intervalDays).toBe(LEITNER_BOX_INTERVALS[2]); // 2 days

      // Max Box promotion stays at 5
      const maxPromo = calculateNextLeitnerReview({ currentBox: 5, rating: 'good', todayStr: today });
      expect(maxPromo.nextBox).toBe(5);
      expect(maxPromo.intervalDays).toBe(LEITNER_BOX_INTERVALS[5]); // 14 days

      // Reset to Box 1 on AGAIN
      const demoted = calculateNextLeitnerReview({ currentBox: 4, rating: 'again', todayStr: today });
      expect(demoted.nextBox).toBe(1);
      expect(demoted.intervalDays).toBe(LEITNER_BOX_INTERVALS[1]); // 1 day
    });

    it('filters due flashcards based on date', () => {
      const cards = [
        { id: 'card1', nextReviewDate: '2026-11-10' }, // Overdue
        { id: 'card2', nextReviewDate: '2026-11-14' }, // Due today
        { id: 'card3', nextReviewDate: '2026-11-20' }  // Due in future
      ];
      const due = getDueFlashcards(cards, '2026-11-14');
      expect(due).toHaveLength(2);
      expect(due.map(c => c.id)).toEqual(['card1', 'card2']);
    });
  });
});

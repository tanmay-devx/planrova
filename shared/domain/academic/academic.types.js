/**
 * shared/domain/academic/academic.types.js
 * Domain types, constants, enumerations, and default scales for Planrova 2.0 Academic Workspaces.
 *
 * 100% platform-independent; zero external dependencies.
 */

export const SEMESTER_STATUSES = Object.freeze({
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
});

export const VALID_SEMESTER_STATUSES = Object.freeze(Object.values(SEMESTER_STATUSES));

export const COURSE_STATUSES = Object.freeze({
  ENROLLED: 'enrolled',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  ARCHIVED: 'archived'
});

export const VALID_COURSE_STATUSES = Object.freeze(Object.values(COURSE_STATUSES));

export const TOPIC_MASTERY_LEVELS = Object.freeze({
  UNSTARTED: 'unstarted',
  LEARNING: 'learning',
  MASTERED: 'mastered'
});

export const VALID_TOPIC_MASTERY_LEVELS = Object.freeze(Object.values(TOPIC_MASTERY_LEVELS));

export const ASSESSMENT_TYPES = Object.freeze({
  ASSIGNMENT: 'assignment',
  QUIZ: 'quiz',
  MIDTERM: 'midterm',
  FINAL: 'final',
  PRACTICAL: 'practical',
  PROJECT: 'project',
  PRESENTATION: 'presentation',
  OTHER: 'other'
});

export const VALID_ASSESSMENT_TYPES = Object.freeze(Object.values(ASSESSMENT_TYPES));

export const ASSESSMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  GRADED: 'graded',
  EXCUSED: 'excused'
});

export const VALID_ASSESSMENT_STATUSES = Object.freeze(Object.values(ASSESSMENT_STATUSES));

export const GRADING_SCALE_TYPES = Object.freeze({
  LETTER_4_0: 'letter_4_0',
  POINTS_10: 'points_10',
  PERCENTAGE_100: 'percentage_100',
  CUSTOM: 'custom'
});

export const VALID_GRADING_SCALE_TYPES = Object.freeze(Object.values(GRADING_SCALE_TYPES));

/**
 * Default grading scales with non-overlapping percentage boundaries.
 */
export const DEFAULT_GRADING_SCALES = Object.freeze({
  [GRADING_SCALE_TYPES.LETTER_4_0]: Object.freeze({
    id: GRADING_SCALE_TYPES.LETTER_4_0,
    name: 'US 4.0 Scale',
    maxGradePoint: 4.0,
    grades: [
      { letter: 'A', points: 4.0, minPercent: 93, maxPercent: 100 },
      { letter: 'A-', points: 3.7, minPercent: 90, maxPercent: 92.99 },
      { letter: 'B+', points: 3.3, minPercent: 87, maxPercent: 89.99 },
      { letter: 'B', points: 3.0, minPercent: 83, maxPercent: 86.99 },
      { letter: 'B-', points: 2.7, minPercent: 80, maxPercent: 82.99 },
      { letter: 'C+', points: 2.3, minPercent: 77, maxPercent: 79.99 },
      { letter: 'C', points: 2.0, minPercent: 73, maxPercent: 76.99 },
      { letter: 'C-', points: 1.7, minPercent: 70, maxPercent: 72.99 },
      { letter: 'D', points: 1.0, minPercent: 60, maxPercent: 69.99 },
      { letter: 'F', points: 0.0, minPercent: 0, maxPercent: 59.99 }
    ]
  }),
  [GRADING_SCALE_TYPES.POINTS_10]: Object.freeze({
    id: GRADING_SCALE_TYPES.POINTS_10,
    name: '10-Point CGPA Scale',
    maxGradePoint: 10.0,
    grades: [
      { letter: 'O', points: 10.0, minPercent: 90, maxPercent: 100 },
      { letter: 'A+', points: 9.0, minPercent: 80, maxPercent: 89.99 },
      { letter: 'A', points: 8.0, minPercent: 70, maxPercent: 79.99 },
      { letter: 'B+', points: 7.0, minPercent: 60, maxPercent: 69.99 },
      { letter: 'B', points: 6.0, minPercent: 50, maxPercent: 59.99 },
      { letter: 'C', points: 5.0, minPercent: 40, maxPercent: 49.99 },
      { letter: 'F', points: 0.0, minPercent: 0, maxPercent: 39.99 }
    ]
  }),
  [GRADING_SCALE_TYPES.PERCENTAGE_100]: Object.freeze({
    id: GRADING_SCALE_TYPES.PERCENTAGE_100,
    name: 'Percentage Scale (0-100%)',
    maxGradePoint: 100.0,
    grades: [
      { letter: 'Distinction', points: 100.0, minPercent: 75, maxPercent: 100 },
      { letter: 'First Class', points: 74.0, minPercent: 60, maxPercent: 74.99 },
      { letter: 'Second Class', points: 59.0, minPercent: 50, maxPercent: 59.99 },
      { letter: 'Pass', points: 49.0, minPercent: 40, maxPercent: 49.99 },
      { letter: 'Fail', points: 0.0, minPercent: 0, maxPercent: 39.99 }
    ]
  })
});

/**
 * Standard Leitner 5-box intervals in days
 */
export const LEITNER_BOX_INTERVALS = Object.freeze({
  1: 1,   // Box 1: daily review (1 day)
  2: 2,   // Box 2: 2 days
  3: 4,   // Box 3: 4 days
  4: 7,   // Box 4: 7 days
  5: 14   // Box 5: 14 days
});

export const FLASHCARD_RATINGS = Object.freeze({
  AGAIN: 'again',
  HARD: 'hard',
  GOOD: 'good',
  EASY: 'easy'
});

export const VALID_FLASHCARD_RATINGS = Object.freeze(Object.values(FLASHCARD_RATINGS));

/**
 * Standard Dexie and Firestore storage keys for academic workspaces
 */
export const ACADEMIC_STORAGE_KEYS = Object.freeze({
  SEMESTERS: 'academic_semesters',
  COURSES: 'academic_courses',
  SYLLABUS_TOPICS: 'academic_syllabus_topics',
  ASSESSMENTS: 'academic_assessments',
  ASSIGNMENTS: 'academic_assignments',
  FLASHCARD_DECKS: 'academic_flashcard_decks',
  FLASHCARDS: 'academic_flashcards',
  FLASHCARD_REVIEWS: 'academic_flashcard_reviews',
  GRADING_SCALES: 'academic_grading_scales'
});


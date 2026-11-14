/**
 * shared/domain/academic/course.engine.js
 * Course & Semester Workspace aggregation engine for Planrova 2.0.
 *
 * Computes course progress, academic standings, credit loads, and deliverable summaries.
 * 100% platform-independent; zero external dependencies.
 */

import {
  calculateTopicProgress,
  calculateWeightedGrade,
  mapScoreToGradePoints,
  calculateSGPA
} from './academic.utils.js';
import { DEFAULT_GRADING_SCALES, GRADING_SCALE_TYPES, COURSE_STATUSES } from './academic.types.js';

/**
 * Filters courses belonging to a specific semester and optionally filters by active status.
 */
export function filterCoursesBySemester(courses = [], semesterId = null, includeInactive = false) {
  if (!semesterId) {
    return (courses || []).filter(c => c && !c.deleted && (includeInactive || c.status !== COURSE_STATUSES.ARCHIVED));
  }
  return (courses || []).filter(c => {
    if (!c || c.deleted) return false;
    if (String(c.semesterId) !== String(semesterId)) return false;
    if (!includeInactive && (c.status === COURSE_STATUSES.ARCHIVED || c.status === COURSE_STATUSES.DROPPED)) {
      return false;
    }
    return true;
  });
}

/**
 * Computes comprehensive performance and progress metrics for a single course.
 */
export function computeCourseMetrics({
  course,
  topics = [],
  assessments = [],
  assignments = [],
  gradingScale = DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0],
  referenceDateStr = new Date().toISOString().slice(0, 10)
} = {}) {
  if (!course) {
    return null;
  }

  const courseId = String(course.id);
  const courseTopics = (topics || []).filter(t => t && !t.deleted && String(t.courseId) === courseId);
  const courseAssessments = (assessments || []).filter(a => a && !a.deleted && String(a.courseId) === courseId);
  const courseAssignments = (assignments || []).filter(as => as && !as.deleted && String(as.courseId) === courseId);

  // 1. Syllabus topic progress
  const topicProgress = calculateTopicProgress(courseTopics);

  // 2. Assessment grading performance
  const gradeResult = calculateWeightedGrade(courseAssessments);
  
  // Resolve grading scale (object or type string)
  const effectiveScale = (typeof gradingScale === 'string' && DEFAULT_GRADING_SCALES[gradingScale])
    ? DEFAULT_GRADING_SCALES[gradingScale]
    : (gradingScale && gradingScale.grades ? gradingScale : DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0]);

  let currentGradePoint = 0.0;
  let currentLetter = 'N/A';
  if (gradeResult.hasAssessments && gradeResult.currentScorePercent !== null) {
    const gp = mapScoreToGradePoints(gradeResult.currentScorePercent, effectiveScale);
    currentGradePoint = gp.points;
    currentLetter = gp.letter;
  }

  // Projected grade points
  const minGradePoint = mapScoreToGradePoints(gradeResult.projectedMinScore, effectiveScale);
  const maxGradePoint = mapScoreToGradePoints(gradeResult.projectedMaxScore, effectiveScale);

  // 3. Assignment deliverables
  let pendingAssignments = 0;
  let completedAssignments = 0;
  let overdueAssignments = 0;
  let totalEstimatedAssignmentMinutes = 0;

  for (const asgn of courseAssignments) {
    const isCompleted = asgn.status === 'completed' || Boolean(asgn.completed);
    const estMin = typeof asgn.estimatedMinutes === 'number' && asgn.estimatedMinutes > 0 ? asgn.estimatedMinutes : 60;
    
    if (isCompleted) {
      completedAssignments++;
    } else {
      pendingAssignments++;
      totalEstimatedAssignmentMinutes += estMin;
      if (asgn.dueDate && asgn.dueDate < referenceDateStr) {
        overdueAssignments++;
      }
    }
  }

  // 4. Upcoming exams & major assessments
  const upcomingAssessments = courseAssessments
    .filter(a => a.status === 'pending' || a.status === 'submitted')
    .filter(a => {
      const date = a.examDate || a.dueDate;
      return !date || date >= referenceDateStr;
    })
    .sort((a, b) => {
      const dateA = a.examDate || a.dueDate || '9999-99-99';
      const dateB = b.examDate || b.dueDate || '9999-99-99';
      return dateA.localeCompare(dateB);
    });

  return {
    courseId,
    courseCode: course.courseCode || course.code || '',
    courseName: course.name || course.title || '',
    credits: typeof course.credits === 'number' ? course.credits : 3,
    color: course.color || '#C2A878',
    status: course.status || COURSE_STATUSES.ACTIVE,
    topicProgress,
    syllabusCompletionPercentage: topicProgress.completionPercentage,
    syllabusProgressPercentage: topicProgress.progressPercentage,
    totalTopics: topicProgress.totalCount,
    masteredTopics: topicProgress.masteredCount,
    remainingTopicMinutes: topicProgress.remainingMinutes,
    grade: gradeResult,
    currentScorePercent: gradeResult.currentScorePercent,
    currentLetter,
    currentGradePoint,
    projectedMinLetter: minGradePoint.letter,
    projectedMinGradePoint: minGradePoint.points,
    projectedMaxLetter: maxGradePoint.letter,
    projectedMaxGradePoint: maxGradePoint.points,
    assignments: {
      total: courseAssignments.length,
      pending: pendingAssignments,
      completed: completedAssignments,
      overdue: overdueAssignments,
      totalEstimatedMinutes: totalEstimatedAssignmentMinutes
    },
    upcomingAssessments,
    upcomingAssessmentsCount: upcomingAssessments.length
  };
}

/**
 * Computes aggregate summary for a semester across all its enrolled courses.
 */
export function computeSemesterSummary({
  semester,
  courses = [],
  topics = [],
  assessments = [],
  assignments = [],
  gradingScale,
  referenceDateStr = new Date().toISOString().slice(0, 10)
} = {}) {
  const semesterId = semester ? String(semester.id) : null;
  const semesterCourses = filterCoursesBySemester(courses, semesterId, false);

  const courseMetricsList = semesterCourses.map(course => {
    return computeCourseMetrics({
      course,
      topics,
      assessments,
      assignments,
      gradingScale: course.gradingScaleId || gradingScale,
      referenceDateStr
    });
  }).filter(Boolean);

  let totalCredits = 0;
  let gradedCredits = 0;
  let totalQualityPoints = 0;
  let totalSyllabusMinutesRemaining = 0;
  let totalAssignmentMinutesRemaining = 0;
  let totalPendingAssignments = 0;
  let totalOverdueAssignments = 0;
  let totalUpcomingAssessments = 0;
  let weightedProgressSum = 0;

  const coursesForSGPA = [];

  for (const cm of courseMetricsList) {
    const creds = cm.credits;
    totalCredits += creds;
    totalSyllabusMinutesRemaining += cm.remainingTopicMinutes;
    totalAssignmentMinutesRemaining += cm.assignments.totalEstimatedMinutes;
    totalPendingAssignments += cm.assignments.pending;
    totalOverdueAssignments += cm.assignments.overdue;
    totalUpcomingAssessments += cm.upcomingAssessmentsCount;
    weightedProgressSum += (cm.syllabusCompletionPercentage * creds);

    if (cm.grade.hasAssessments && cm.currentScorePercent !== null) {
      gradedCredits += creds;
      totalQualityPoints += (creds * cm.currentGradePoint);
      coursesForSGPA.push({ credits: creds, gradePoints: cm.currentGradePoint });
    }
  }

  const sgpaResult = calculateSGPA(coursesForSGPA);
  const overallSyllabusPercentage = totalCredits > 0
    ? Number((weightedProgressSum / totalCredits).toFixed(1))
    : 0;

  return {
    semesterId,
    semesterName: semester ? (semester.name || semester.title || 'Current Semester') : 'Current Semester',
    courseCount: semesterCourses.length,
    totalCredits,
    gradedCredits,
    currentSGPA: sgpaResult.sgpa,
    targetSGPA: semester && typeof semester.targetSGPA === 'number' ? semester.targetSGPA : null,
    overallSyllabusPercentage,
    totalPendingAssignments,
    totalOverdueAssignments,
    totalUpcomingAssessments,
    totalEstimatedWorkMinutes: totalSyllabusMinutesRemaining + totalAssignmentMinutesRemaining,
    courseMetrics: courseMetricsList
  };
}


/**
 * shared/domain/academic/gpa.engine.js
 * GPA Calculator & Multi-Semester Target Simulator for Planrova 2.0.
 *
 * Implements precision-safe SGPA, CGPA across historical semesters,
 * and multi-semester target CGPA planning.
 * 100% platform-independent; zero external dependencies.
 */

import {
  calculateSGPA,
  calculateCGPA,
  simulateRequiredSGPA,
  mapScoreToGradePoints
} from './academic.utils.js';
import {
  DEFAULT_GRADING_SCALES,
  GRADING_SCALE_TYPES
} from './academic.types.js';

/**
 * Computes SGPA from course grade points with detailed per-course quality point breakdown.
 */
export function computeSemesterGPA({
  courses = [],
  gradingScale = DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0]
} = {}) {
  const effectiveScale = (typeof gradingScale === 'string' && DEFAULT_GRADING_SCALES[gradingScale])
    ? DEFAULT_GRADING_SCALES[gradingScale]
    : (gradingScale && gradingScale.grades ? gradingScale : DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0]);

  const active = (courses || []).filter(c => c && !c.deleted && c.status !== 'dropped' && c.status !== 'archived');

  let totalCredits = 0;
  let gradedCredits = 0;
  let totalQualityPoints = 0;

  const courseBreakdowns = active.map(c => {
    const creds = typeof c.credits === 'number' && c.credits > 0 ? c.credits : 0;
    totalCredits += creds;

    let gradePoints = null;
    let letter = 'N/A';

    if (typeof c.gradePoints === 'number') {
      gradePoints = c.gradePoints;
      letter = c.letter || 'N/A';
    } else if (typeof c.scorePercent === 'number') {
      const courseScale = (c.gradingScaleId && DEFAULT_GRADING_SCALES[c.gradingScaleId])
        ? DEFAULT_GRADING_SCALES[c.gradingScaleId]
        : effectiveScale;
      const mapped = mapScoreToGradePoints(c.scorePercent, courseScale);
      gradePoints = mapped.points;
      letter = mapped.letter;
    }

    let qualityPoints = 0;
    if (gradePoints !== null && !isNaN(gradePoints)) {
      gradedCredits += creds;
      qualityPoints = Number((creds * gradePoints).toFixed(2));
      totalQualityPoints += qualityPoints;
    }

    return {
      courseId: c.id,
      courseCode: c.courseCode || c.code || '',
      courseName: c.name || c.title || '',
      credits: creds,
      gradePoints,
      letter,
      qualityPoints
    };
  });

  const sgpa = gradedCredits > 0
    ? Number((totalQualityPoints / gradedCredits).toFixed(2))
    : 0.0;

  return {
    sgpa,
    totalCredits,
    gradedCredits,
    totalQualityPoints: Number(totalQualityPoints.toFixed(2)),
    courseBreakdowns
  };
}

/**
 * Computes Cumulative GPA across all historical and completed semesters.
 */
export function computeCumulativeGPA(historicalSemesters = []) {
  const active = (historicalSemesters || []).filter(s => s && !s.deleted && typeof s.credits === 'number' && s.credits > 0);

  let totalCumulativeCredits = 0;
  let totalQualityPoints = 0;

  const semesterBreakdowns = active.map(s => {
    const creds = s.credits;
    const sgpa = typeof s.sgpa === 'number' ? s.sgpa : 0.0;
    const qp = Number((creds * sgpa).toFixed(2));

    totalCumulativeCredits += creds;
    totalQualityPoints += qp;

    return {
      semesterId: s.id,
      name: s.name || s.title || '',
      credits: creds,
      sgpa,
      qualityPoints: qp
    };
  });

  const cgpa = totalCumulativeCredits > 0
    ? Number((totalQualityPoints / totalCumulativeCredits).toFixed(2))
    : 0.0;

  return {
    cgpa,
    totalCumulativeCredits,
    totalQualityPoints: Number(totalQualityPoints.toFixed(2)),
    semesterBreakdowns
  };
}

/**
 * Multi-semester target simulator:
 * Calculates uniform or distributed required SGPA across one or more upcoming semesters.
 */
export function simulateMultiSemesterTarget({
  currentCGPA = 0,
  completedCredits = 0,
  upcomingSemesters = [], // array of { name, credits } or single number of upcomingCredits
  targetCGPA = 0,
  gradingScale = DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0]
} = {}) {
  const effectiveScale = (typeof gradingScale === 'string' && DEFAULT_GRADING_SCALES[gradingScale])
    ? DEFAULT_GRADING_SCALES[gradingScale]
    : (gradingScale && gradingScale.grades ? gradingScale : DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0]);

  const maxGradePoint = effectiveScale.maxGradePoint || 4.0;

  // Normalize upcoming semesters
  let upcomingSemList = [];
  if (Array.isArray(upcomingSemesters)) {
    upcomingSemList = upcomingSemesters;
  } else if (typeof upcomingSemesters === 'number' && upcomingSemesters > 0) {
    upcomingSemList = [{ name: 'Upcoming Semester', credits: upcomingSemesters }];
  }

  const totalUpcomingCredits = upcomingSemList.reduce((sum, s) => sum + (s.credits || 0), 0);

  if (totalUpcomingCredits <= 0) {
    return {
      isFeasible: false,
      requiredSGPA: null,
      maxPossibleCGPA: currentCGPA,
      reason: 'At least one upcoming semester with positive credits is required.'
    };
  }

  // Base simulation for required points
  const baseSim = simulateRequiredSGPA({
    currentCGPA,
    completedCredits,
    upcomingCredits: totalUpcomingCredits,
    targetCGPA,
    maxGradePoint
  });

  // Calculate per-semester targets assuming uniform SGPA
  const semesterTargets = upcomingSemList.map(sem => {
    return {
      name: sem.name || 'Semester',
      credits: sem.credits,
      requiredSGPA: baseSim.requiredSGPA,
      isFeasible: baseSim.isFeasible
    };
  });

  return {
    isFeasible: baseSim.isFeasible,
    requiredSGPA: baseSim.requiredSGPA,
    maxPossibleCGPA: baseSim.maxPossibleCGPA,
    totalUpcomingCredits,
    targetCGPA,
    currentCGPA,
    completedCredits,
    semesterTargets,
    reason: baseSim.reason
  };
}


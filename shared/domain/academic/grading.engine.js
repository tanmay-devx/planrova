/**
 * shared/domain/academic/grading.engine.js
 * Assessment & Weighted Grading Engine for Planrova 2.0.
 *
 * Implements precision-safe weighted grading, drop-lowest policies,
 * weight validation, and what-if target score simulation.
 * 100% platform-independent; zero external dependencies.
 */

import {
  calculateWeightedGrade,
  mapScoreToGradePoints
} from './academic.utils.js';
import {
  DEFAULT_GRADING_SCALES,
  GRADING_SCALE_TYPES,
  ASSESSMENT_STATUSES
} from './academic.types.js';

/**
 * Validates that total assessment weights for a course sum to 100%.
 */
export function validateCourseAssessmentWeights(assessments = []) {
  const active = (assessments || []).filter(a => a && !a.deleted && a.status !== ASSESSMENT_STATUSES.EXCUSED);
  let totalWeight = 0;

  for (const a of active) {
    if (typeof a.weightPercentage === 'number' && !isNaN(a.weightPercentage)) {
      totalWeight += a.weightPercentage;
    }
  }

  totalWeight = Number(totalWeight.toFixed(2));
  const diff = Number((100 - totalWeight).toFixed(2));

  let status = 'complete';
  let message = 'Assessment weights total 100%.';

  if (Math.abs(diff) < 0.01) {
    status = 'complete';
  } else if (totalWeight < 100) {
    status = 'underweight';
    message = `Configured assessment weights total ${totalWeight}%, leaving ${diff}% unassigned.`;
  } else {
    status = 'overweight';
    message = `Configured assessment weights total ${totalWeight}%, exceeding 100% by ${Math.abs(diff)}%.`;
  }

  return {
    totalWeight,
    diff,
    status,
    isComplete: status === 'complete',
    isValid: status !== 'overweight',
    message
  };
}

/**
 * Computes a detailed grading breakdown with support for drop-lowest policies.
 */
export function computeDetailedGradingBreakdown({
  assessments = [],
  dropLowestPolicy = null, // e.g. { type: 'quiz', dropCount: 1 }
  gradingScale = DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0]
} = {}) {
  let active = (assessments || []).filter(a => a && !a.deleted && a.status !== ASSESSMENT_STATUSES.EXCUSED);

  // Apply Drop Lowest policy if specified
  const droppedIds = new Set();
  if (dropLowestPolicy && dropLowestPolicy.type && dropLowestPolicy.dropCount > 0) {
    const matchingGraded = active.filter(a => 
      a.type === dropLowestPolicy.type && 
      a.status === ASSESSMENT_STATUSES.GRADED &&
      typeof a.obtainedMarks === 'number' &&
      typeof a.totalMarks === 'number' &&
      a.totalMarks > 0
    );

    matchingGraded.sort((a, b) => {
      const pctA = a.obtainedMarks / a.totalMarks;
      const pctB = b.obtainedMarks / b.totalMarks;
      return pctA - pctB;
    });

    const toDrop = matchingGraded.slice(0, dropLowestPolicy.dropCount);
    for (const d of toDrop) {
      droppedIds.add(String(d.id));
    }
  }

  const effectiveAssessments = active.filter(a => !droppedIds.has(String(a.id)));

  // Calculate base weighted grade
  const gradeResult = calculateWeightedGrade(effectiveAssessments);

  const effectiveScale = (typeof gradingScale === 'string' && DEFAULT_GRADING_SCALES[gradingScale])
    ? DEFAULT_GRADING_SCALES[gradingScale]
    : (gradingScale && gradingScale.grades ? gradingScale : DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0]);

  let currentLetter = 'N/A';
  let currentGradePoint = 0.0;

  if (gradeResult.hasAssessments && gradeResult.currentScorePercent !== null) {
    const gp = mapScoreToGradePoints(gradeResult.currentScorePercent, effectiveScale);
    currentLetter = gp.letter;
    currentGradePoint = gp.points;
  }

  const minGp = mapScoreToGradePoints(gradeResult.projectedMinScore, effectiveScale);
  const maxGp = mapScoreToGradePoints(gradeResult.projectedMaxScore, effectiveScale);

  // Format line items
  const items = active.map(a => {
    const isDropped = droppedIds.has(String(a.id));
    const isGraded = a.status === ASSESSMENT_STATUSES.GRADED && typeof a.obtainedMarks === 'number' && typeof a.totalMarks === 'number' && a.totalMarks > 0;
    const percentage = isGraded ? Number(((a.obtainedMarks / a.totalMarks) * 100).toFixed(2)) : null;
    const earnedPoints = isGraded && !isDropped ? Number(((percentage / 100) * (a.weightPercentage || 0)).toFixed(2)) : 0;

    return {
      id: a.id,
      title: a.title,
      type: a.type,
      status: a.status,
      totalMarks: a.totalMarks,
      obtainedMarks: a.obtainedMarks,
      weightPercentage: a.weightPercentage || 0,
      percentage,
      earnedPoints,
      isDropped
    };
  });

  return {
    items,
    droppedIds: Array.from(droppedIds),
    completedContribution: gradeResult.completedContribution,
    completedWeight: gradeResult.completedWeight,
    remainingWeight: gradeResult.remainingWeight,
    currentScorePercent: gradeResult.currentScorePercent,
    currentLetter,
    currentGradePoint,
    projectedMinScore: gradeResult.projectedMinScore,
    projectedMinLetter: minGp.letter,
    projectedMaxScore: gradeResult.projectedMaxScore,
    projectedMaxLetter: maxGp.letter
  };
}

/**
 * What-If Target Grade Simulator:
 * Given a target overall course percentage (e.g. 85%), computes the required score
 * across remaining pending assessments.
 */
export function simulateRequiredAssessmentScore({
  assessments = [],
  targetPercentage = 85,
  targetAssessmentId = null
} = {}) {
  const breakdown = computeDetailedGradingBreakdown({ assessments });
  const remainingWeight = breakdown.remainingWeight;
  const currentEarned = breakdown.completedContribution;

  if (remainingWeight <= 0) {
    const achieved = breakdown.currentScorePercent !== null && breakdown.currentScorePercent >= targetPercentage;
    return {
      isAchievable: achieved,
      requiredPercentage: 0,
      reason: achieved 
        ? `Course is complete. Your final score of ${breakdown.currentScorePercent}% met or exceeded your target of ${targetPercentage}%.`
        : `Course is complete with a final score of ${breakdown.currentScorePercent}%. Target of ${targetPercentage}% was not reached.`
    };
  }

  // Points needed from remaining weight: TargetTotal - currentEarned
  const pointsNeeded = targetPercentage - currentEarned;

  if (targetAssessmentId) {
    const targetAssessment = assessments.find(a => String(a.id) === String(targetAssessmentId));
    if (!targetAssessment) {
      throw new Error(`Assessment with ID ${targetAssessmentId} not found`);
    }

    const targetWeight = targetAssessment.weightPercentage || 0;
    if (targetWeight <= 0) {
      return {
        isAchievable: false,
        requiredPercentage: null,
        reason: 'Target assessment has zero configured weight percentage.'
      };
    }

    // Assume 100% on other pending assessments to find minimum required on target assessment
    const otherPendingWeight = remainingWeight - targetWeight;
    // If scoring 100% on other pending assessments:
    const minPointsNeededOnTarget = pointsNeeded - otherPendingWeight;
    const requiredRatio = minPointsNeededOnTarget / targetWeight;
    const requiredPercentage = Number((requiredRatio * 100).toFixed(2));

    const isAchievable = requiredPercentage <= 100;
    const isAlreadyGuaranteed = requiredPercentage <= 0;

    let reason = '';
    if (requiredPercentage > 100) {
      reason = `Target of ${targetPercentage}% is mathematically unachievable. Even with 100% on all other work, you would need ${requiredPercentage}% on ${targetAssessment.title}.`;
    } else if (isAlreadyGuaranteed) {
      reason = `Target of ${targetPercentage}% is already secured if you maintain full marks on remaining work.`;
    } else {
      reason = `You need at least ${requiredPercentage}% on ${targetAssessment.title} (assuming 100% on other pending work) to reach ${targetPercentage}%.`;
    }

    return {
      isAchievable,
      requiredPercentage: Math.max(0, requiredPercentage),
      remainingWeight,
      pointsNeeded: Number(pointsNeeded.toFixed(2)),
      reason
    };
  }

  // Calculate uniform required percentage across all remaining pending assessments
  const requiredRatio = pointsNeeded / remainingWeight;
  const rawRequiredPercentage = Number((requiredRatio * 100).toFixed(2));
  const isAchievable = rawRequiredPercentage <= 100;
  const isAlreadyGuaranteed = rawRequiredPercentage <= 0;

  let reason = '';
  if (rawRequiredPercentage > 100) {
    reason = `Target of ${targetPercentage}% is unachievable. You would need an average of ${rawRequiredPercentage}% across remaining assessments, which exceeds 100%. Max achievable is ${breakdown.projectedMaxScore}%.`;
  } else if (isAlreadyGuaranteed) {
    reason = `Target of ${targetPercentage}% is already guaranteed with existing completed scores.`;
  } else {
    reason = `You need an average of ${rawRequiredPercentage}% across your remaining ${remainingWeight}% of course work to achieve ${targetPercentage}%.`;
  }

  return {
    isAchievable,
    requiredPercentage: Math.max(0, rawRequiredPercentage),
    remainingWeight,
    pointsNeeded: Number(pointsNeeded.toFixed(2)),
    reason
  };
}


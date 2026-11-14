/**
 * shared/domain/academic/academic.utils.js
 * Pure mathematical, grading, DAG, and Leitner scheduling algorithms for Planrova 2.0 Academic Workspaces.
 *
 * 100% platform-independent; zero external dependencies.
 */

import { 
  LEITNER_BOX_INTERVALS, 
  FLASHCARD_RATINGS, 
  DEFAULT_GRADING_SCALES, 
  GRADING_SCALE_TYPES 
} from './academic.types.js';

// ── 1. Syllabus & Topic Utilities ──────────────────────────────────────

/**
 * Calculates progress across an array of syllabus topics.
 */
export function calculateTopicProgress(topics = []) {
  const activeTopics = (topics || []).filter(t => t && !t.deleted);
  const totalCount = activeTopics.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      totalTopics: 0,
      completedCount: 0,
      masteredCount: 0,
      learningCount: 0,
      unstartedCount: 0,
      pendingCount: 0,
      completionPercentage: 0,
      progressPercentage: 0,
      totalEstimatedMinutes: 0,
      completedMinutes: 0,
      remainingMinutes: 0,
      masteryDistribution: { unstarted: 0, learning: 0, mastered: 0 }
    };
  }

  let completedCount = 0;
  let totalEstimatedMinutes = 0;
  let completedMinutes = 0;
  const masteryDist = { unstarted: 0, learning: 0, mastered: 0 };

  for (const t of activeTopics) {
    const isCompleted = Boolean(t.completed) || (t.masteryLevel && t.masteryLevel.toLowerCase() === 'mastered');
    const estMin = typeof t.estimatedMinutes === 'number' && t.estimatedMinutes > 0 ? t.estimatedMinutes : 0;
    totalEstimatedMinutes += estMin;

    if (isCompleted) {
      completedCount++;
      completedMinutes += estMin;
    }

    const mastery = (t.masteryLevel || (t.completed ? 'mastered' : 'unstarted')).toLowerCase();
    if (masteryDist[mastery] !== undefined) {
      masteryDist[mastery]++;
    } else {
      masteryDist.unstarted++;
    }
  }

  const completionPercentage = Number(((completedCount / totalCount) * 100).toFixed(1));
  const masteryWeightedScore = ((masteryDist.mastered * 100) + (masteryDist.learning * 50)) / totalCount;
  const progressPercentage = Number(masteryWeightedScore.toFixed(1));
  const remainingMinutes = Math.max(0, totalEstimatedMinutes - completedMinutes);

  return {
    totalCount,
    totalTopics: totalCount,
    completedCount,
    masteredCount: masteryDist.mastered,
    learningCount: masteryDist.learning,
    unstartedCount: masteryDist.unstarted,
    pendingCount: totalCount - completedCount,
    completionPercentage,
    progressPercentage,
    totalEstimatedMinutes,
    completedMinutes,
    remainingMinutes,
    masteryDistribution: masteryDist
  };
}

/**
 * Builds a hierarchical tree from a flat array of topics.
 * Validates that no cyclic parent references exist.
 */
export function buildTopicHierarchy(topics = []) {
  const activeTopics = (topics || []).filter(t => t && !t.deleted);
  const topicMap = new Map();
  const roots = [];

  // 1. Initialize map nodes
  for (const t of activeTopics) {
    const sub = [];
    topicMap.set(String(t.id), { ...t, subtopics: sub, children: sub });
  }

  // Detect circular references using ancestor tracking
  const hasAncestorCycle = (id, visited = new Set()) => {
    if (visited.has(id)) return true;
    visited.add(id);
    const node = topicMap.get(id);
    if (!node) return false;
    const pId = node.parentTopicId || node.parentId;
    if (!pId) return false;
    return hasAncestorCycle(String(pId), visited);
  };

  // 2. Attach subtopics / children
  for (const t of activeTopics) {
    const node = topicMap.get(String(t.id));
    const pId = t.parentTopicId || t.parentId;
    if (pId && topicMap.has(String(pId)) && String(pId) !== String(t.id) && !hasAncestorCycle(String(t.id))) {
      const parent = topicMap.get(String(pId));
      parent.subtopics.push(node);
    } else {
      roots.push(node);
    }
  }

  // 3. Sort subtopics by order then title
  const sortFn = (a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : 0;
    const orderB = typeof b.order === 'number' ? b.order : 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.title || '').localeCompare(b.title || '');
  };

  const recursiveSort = (nodes) => {
    nodes.sort(sortFn);
    for (const n of nodes) {
      if (n.subtopics && n.subtopics.length > 0) {
        recursiveSort(n.subtopics);
      }
    }
  };

  recursiveSort(roots);
  return roots;
}

// ── 2. Assessment & Weighted Grading Utilities ─────────────────────────

/**
 * Calculates weighted grade contributions from an array of assessments.
 * Precision-safe arithmetic with explicit distinction between completed and pending weights.
 */
export function calculateWeightedGrade(assessments = []) {
  const active = (assessments || []).filter(a => a && !a.deleted && a.status !== 'excused');
  if (active.length === 0) {
    return {
      hasAssessments: false,
      completedContribution: 0,
      currentScorePercent: null,
      completedWeight: 0,
      remainingWeight: 100,
      totalConfiguredWeight: 0,
      projectedMinScore: 0,
      projectedMaxScore: 100,
      letterGrade: null
    };
  }

  let totalConfiguredWeight = 0;
  let completedWeight = 0;
  let completedContribution = 0;

  for (const a of active) {
    const weight = typeof a.weightPercentage === 'number' ? a.weightPercentage : 0;
    totalConfiguredWeight += weight;

    const isGraded = a.status === 'graded' && typeof a.obtainedMarks === 'number' && typeof a.totalMarks === 'number' && a.totalMarks > 0;
    if (isGraded) {
      completedWeight += weight;
      const ratio = Math.min(1.0, Math.max(0, a.obtainedMarks / a.totalMarks));
      completedContribution += (ratio * weight);
    }
  }

  completedContribution = Number(completedContribution.toFixed(2));
  completedWeight = Number(completedWeight.toFixed(2));
  const remainingWeight = Number(Math.max(0, 100 - completedWeight).toFixed(2));

  // Current weighted score normalized to 100% of completed weight
  const currentScorePercent = completedWeight > 0 
    ? Number(((completedContribution / completedWeight) * 100).toFixed(2)) 
    : null;

  // Projected outcomes
  const projectedMinScore = completedContribution; // if 0% on all pending
  const projectedMaxScore = Number(Math.min(100, completedContribution + remainingWeight).toFixed(2)); // if 100% on pending

  return {
    hasAssessments: true,
    completedContribution,
    earnedWeightPoints: completedContribution,
    currentScorePercent,
    currentPercentage: currentScorePercent,
    completedWeight,
    remainingWeight,
    totalConfiguredWeight: Number(totalConfiguredWeight.toFixed(2)),
    projectedMinScore,
    projectedMinPercentage: projectedMinScore,
    projectedMaxScore,
    projectedMaxPercentage: projectedMaxScore
  };
}

// ── 3. GPA & Target Simulation Utilities ───────────────────────────────

/**
 * Maps a percentage score (0 - 100) to grade points and letter grade using a grading scale.
 */
export function mapScoreToGradePoints(scorePercent, scale = DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0]) {
  if (typeof scorePercent !== 'number' || isNaN(scorePercent)) {
    return { letter: 'N/A', points: 0.0 };
  }

  const effectiveScale = (typeof scale === 'string' && DEFAULT_GRADING_SCALES[scale]) 
    ? DEFAULT_GRADING_SCALES[scale] 
    : (scale && scale.grades ? scale : DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0]);

  const clamped = Math.max(0, Math.min(100, scorePercent));
  const grades = effectiveScale.grades || [];

  for (const g of grades) {
    if (clamped >= g.minPercent && clamped <= g.maxPercent) {
      return { letter: g.letter, points: g.points };
    }
  }

  // Fallback to lowest grade if below minimum
  if (grades.length > 0) {
    const lowest = grades[grades.length - 1];
    return { letter: lowest.letter, points: lowest.points };
  }
  return { letter: 'F', points: 0.0 };
}

/**
 * Calculates credit-weighted Semester GPA (SGPA).
 * SGPA = sum(Credits_i * GradePoints_i) / sum(Credits_i)
 */
export function calculateSGPA(courseGrades = []) {
  const active = (courseGrades || []).filter(c => c && !c.deleted && typeof c.credits === 'number' && c.credits > 0);
  if (active.length === 0) {
    return { sgpa: 0.0, totalCredits: 0, gradedCredits: 0 };
  }

  let totalCredits = 0;
  let gradedCredits = 0;
  let totalGradePoints = 0;

  for (const c of active) {
    totalCredits += c.credits;
    if (typeof c.gradePoints === 'number' && !isNaN(c.gradePoints)) {
      gradedCredits += c.credits;
      totalGradePoints += (c.credits * c.gradePoints);
    }
  }

  const sgpa = gradedCredits > 0 ? Number((totalGradePoints / gradedCredits).toFixed(2)) : 0.0;
  return {
    sgpa,
    totalCredits,
    gradedCredits
  };
}

/**
 * Calculates Cumulative GPA (CGPA) across multiple semesters.
 * CGPA = sum(SGPA_j * Credits_j) / sum(Credits_j)
 */
export function calculateCGPA(semesterRecords = []) {
  const active = (semesterRecords || []).filter(s => s && !s.deleted && typeof s.credits === 'number' && s.credits > 0);
  if (active.length === 0) {
    return { cgpa: 0.0, totalCumulativeCredits: 0 };
  }

  let totalCumulativeCredits = 0;
  let weightedPoints = 0;

  for (const s of active) {
    if (typeof s.sgpa === 'number' && !isNaN(s.sgpa)) {
      totalCumulativeCredits += s.credits;
      weightedPoints += (s.credits * s.sgpa);
    }
  }

  const cgpa = totalCumulativeCredits > 0 ? Number((weightedPoints / totalCumulativeCredits).toFixed(2)) : 0.0;
  return {
    cgpa,
    totalCumulativeCredits
  };
}

/**
 * Simulates required Semester GPA to achieve target CGPA.
 * Formula: RequiredSGPA = (TargetCGPA * (CompletedCredits + UpcomingCredits) - CurrentCGPA * CompletedCredits) / UpcomingCredits
 */
export function simulateRequiredSGPA({
  currentCGPA = 0,
  completedCredits = 0,
  upcomingCredits = 0,
  targetCGPA = 0,
  maxGradePoint = 4.0
}) {
  if (upcomingCredits <= 0) {
    return {
      feasible: false,
      requiredSGPA: null,
      maxPossibleCGPA: currentCGPA,
      reason: 'Upcoming credits must be greater than zero.'
    };
  }

  const totalCredits = completedCredits + upcomingCredits;
  const currentTotalPoints = currentCGPA * completedCredits;
  const targetTotalPoints = targetCGPA * totalCredits;

  const requiredPoints = targetTotalPoints - currentTotalPoints;
  const rawRequiredSGPA = requiredPoints / upcomingCredits;
  const requiredSGPA = Number(rawRequiredSGPA.toFixed(2));

  // Max possible CGPA if user scores maxGradePoint on all upcoming credits
  const maxPossiblePoints = currentTotalPoints + (maxGradePoint * upcomingCredits);
  const maxPossibleCGPA = Number((maxPossiblePoints / totalCredits).toFixed(2));

  const feasible = rawRequiredSGPA <= maxGradePoint && rawRequiredSGPA >= 0;

  let reason = '';
  if (rawRequiredSGPA > maxGradePoint) {
    reason = `Target CGPA of ${targetCGPA} is mathematically impossible; requires SGPA of ${requiredSGPA} exceeding scale maximum of ${maxGradePoint}. Maximum achievable CGPA is ${maxPossibleCGPA}.`;
  } else if (rawRequiredSGPA <= 0) {
    reason = `Target CGPA is already secured. Even with an SGPA of 0.0, your CGPA would be ${Number((currentTotalPoints / totalCredits).toFixed(2))}.`;
  } else {
    reason = `You need an SGPA of ${requiredSGPA} across ${upcomingCredits} upcoming credits to reach your target CGPA of ${targetCGPA}.`;
  }

  return {
    feasible,
    isFeasible: feasible,
    requiredSGPA: Math.max(0, requiredSGPA),
    maxPossibleCGPA,
    currentCGPA,
    targetCGPA,
    completedCredits,
    upcomingCredits,
    maxGradePoint,
    reason
  };
}

// ── 4. Assignment DAG & Cycle Detection ─────────────────────────────────

/**
 * Validates assignment dependencies using Depth-First Search.
 * Detects cycles and calculates blocked states.
 * Returns { valid: boolean, hasCycles: boolean, cyclePath: string[] | null, blockedAssignmentIds: string[] }
 */
export function validateAssignmentDependencies(assignments = []) {
  const active = (assignments || []).filter(a => a && !a.deleted);
  const adjList = new Map();
  const assignmentMap = new Map();

  for (const a of active) {
    assignmentMap.set(String(a.id), a);
    adjList.set(String(a.id), Array.isArray(a.dependencyIds) ? a.dependencyIds.map(String) : []);
  }

  // 1. Cycle Detection using 3-color DFS (0 = unvisited, 1 = visiting/ancestor, 2 = visited)
  const state = new Map();
  const parentTrack = new Map();
  let hasCycles = false;
  let cyclePath = null;

  for (const id of adjList.keys()) {
    state.set(id, 0);
  }

  function dfs(u) {
    state.set(u, 1);
    const neighbors = adjList.get(u) || [];

    for (const v of neighbors) {
      if (!assignmentMap.has(v)) continue; // ignore non-existent reference safely

      if (state.get(v) === 1) {
        // Cycle detected
        hasCycles = true;
        cyclePath = [u, v];
        return true;
      }
      if (state.get(v) === 0) {
        parentTrack.set(v, u);
        if (dfs(v)) return true;
      }
    }

    state.set(u, 2);
    return false;
  }

  for (const id of adjList.keys()) {
    if (state.get(id) === 0) {
      if (dfs(id)) break;
    }
  }

  // 2. Calculate Blocked State
  // An assignment is blocked if ANY of its active prerequisite dependencies is not completed
  const blockedIds = [];
  for (const [id, a] of assignmentMap.entries()) {
    const deps = adjList.get(id) || [];
    let isBlocked = false;

    for (const depId of deps) {
      const prerequisite = assignmentMap.get(depId);
      if (prerequisite && prerequisite.status !== 'completed' && !prerequisite.completed) {
        isBlocked = true;
        break;
      }
    }

    if (isBlocked) {
      blockedIds.push(id);
    }
  }

  return {
    valid: !hasCycles,
    hasCycles,
    hasCycle: hasCycles,
    cyclePath: cyclePath || [],
    blockedAssignmentIds: blockedIds,
    blockedAssignments: blockedIds.map(id => assignmentMap.get(id)).filter(Boolean)
  };
}

// ── 5. Leitner Spaced Repetition Scheduler ──────────────────────────────

/**
 * Calculates next review date and box state based on Leitner 5-box algorithm.
 */
export function calculateNextLeitnerReview({
  currentBox = 1,
  rating = FLASHCARD_RATINGS.GOOD,
  reviewTimestamp,
  todayStr,
  customIntervals = LEITNER_BOX_INTERVALS
} = {}) {
  const ts = reviewTimestamp !== undefined 
    ? reviewTimestamp 
    : (todayStr ? new Date(`${todayStr}T12:00:00Z`).getTime() : Date.now());

  const intervals = { ...LEITNER_BOX_INTERVALS, ...(customIntervals || {}) };
  const box = Math.max(1, Math.min(5, Number(currentBox) || 1));
  let nextBox = 1;

  switch (rating) {
    case FLASHCARD_RATINGS.AGAIN:
      // Incorrect: reset back to Box 1
      nextBox = 1;
      break;
    case FLASHCARD_RATINGS.HARD:
      // Difficult: stay in current box
      nextBox = box;
      break;
    case FLASHCARD_RATINGS.GOOD:
      // Correct: advance one box
      nextBox = Math.min(5, box + 1);
      break;
    case FLASHCARD_RATINGS.EASY:
      // Very Easy: leap two boxes (max 5)
      nextBox = Math.min(5, box + 2);
      break;
    default:
      nextBox = Math.min(5, box + 1);
  }

  const intervalDays = intervals[nextBox] || 1;
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const nextReviewAt = ts + intervalMs;
  const nextReviewDate = new Date(nextReviewAt).toISOString().split('T')[0];

  return {
    previousBox: box,
    nextBox,
    intervalDays,
    lastReviewedAt: ts,
    nextReviewAt,
    nextReviewDate
  };
}

/**
 * Filters flashcards to find those currently due for review.
 * Accepts timestamp number or 'YYYY-MM-DD' date string.
 */
export function getDueFlashcards(flashcards = [], currentDateOrTimestamp = Date.now()) {
  const isDateStr = typeof currentDateOrTimestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(currentDateOrTimestamp);
  const targetDateStr = isDateStr ? currentDateOrTimestamp : new Date(currentDateOrTimestamp).toISOString().slice(0, 10);
  const targetTimestamp = isDateStr ? new Date(`${currentDateOrTimestamp}T23:59:59.999Z`).getTime() : currentDateOrTimestamp;

  const active = (flashcards || []).filter(f => f && !f.deleted);
  const due = active.filter(f => {
    if (f.nextReviewDate) {
      return f.nextReviewDate <= targetDateStr;
    }
    if (f.nextReviewAt) {
      return f.nextReviewAt <= targetTimestamp;
    }
    return true;
  });

  due.sort((a, b) => {
    const boxA = a.box || 1;
    const boxB = b.box || 1;
    if (boxA !== boxB) return boxA - boxB;
    const timeA = a.nextReviewDate ? a.nextReviewDate : (a.nextReviewAt || 0);
    const timeB = b.nextReviewDate ? b.nextReviewDate : (b.nextReviewAt || 0);
    return timeA < timeB ? -1 : (timeA > timeB ? 1 : 0);
  });

  return due;
}

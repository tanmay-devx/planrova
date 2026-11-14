/**
 * shared/domain/academic/syllabus.engine.js
 * Syllabus & Hierarchical Topic Tracking Engine for Planrova 2.0.
 *
 * Implements tree operations, completion cascades, mastery progression,
 * and pedagogical next-topic recommendation.
 * 100% platform-independent; zero external dependencies.
 */

import { TOPIC_MASTERY_LEVELS, VALID_TOPIC_MASTERY_LEVELS } from './academic.types.js';
import { buildTopicHierarchy, calculateTopicProgress } from './academic.utils.js';

/**
 * Builds a structured syllabus tree for a course with aggregate completion
 * and minute rollups for each branch/module.
 */
export function buildCourseSyllabusTree(topics = []) {
  const hierarchy = buildTopicHierarchy(topics);

  // Recursively compute rollups for each branch node
  function computeBranchRollup(node) {
    const children = node.subtopics || node.children || [];
    let branchTotalMinutes = typeof node.estimatedMinutes === 'number' && node.estimatedMinutes > 0 ? node.estimatedMinutes : 0;
    let branchCompletedMinutes = node.completed ? branchTotalMinutes : 0;
    let branchTotalCount = 1;
    let branchCompletedCount = node.completed ? 1 : 0;
    let branchMasteredCount = node.masteryLevel === TOPIC_MASTERY_LEVELS.MASTERED ? 1 : 0;

    for (const child of children) {
      const childRollup = computeBranchRollup(child);
      branchTotalMinutes += childRollup.branchTotalMinutes;
      branchCompletedMinutes += childRollup.branchCompletedMinutes;
      branchTotalCount += childRollup.branchTotalCount;
      branchCompletedCount += childRollup.branchCompletedCount;
      branchMasteredCount += childRollup.branchMasteredCount;
    }

    const branchCompletionPercent = branchTotalCount > 0
      ? Number(((branchCompletedCount / branchTotalCount) * 100).toFixed(1))
      : 0;

    node.rollup = {
      branchTotalMinutes,
      branchCompletedMinutes,
      branchRemainingMinutes: Math.max(0, branchTotalMinutes - branchCompletedMinutes),
      branchTotalCount,
      branchCompletedCount,
      branchMasteredCount,
      branchCompletionPercent
    };

    return node.rollup;
  }

  for (const root of hierarchy) {
    computeBranchRollup(root);
  }

  return hierarchy;
}

/**
 * Immutably updates a topic's mastery level and cascades changes.
 */
export function updateTopicMastery(topics = [], topicId, newMasteryLevel, { cascadeToDescendants = false } = {}) {
  if (!VALID_TOPIC_MASTERY_LEVELS.includes(newMasteryLevel)) {
    throw new Error(`Invalid mastery level: ${newMasteryLevel}`);
  }

  const isMastered = newMasteryLevel === TOPIC_MASTERY_LEVELS.MASTERED;
  const targetId = String(topicId);
  const now = Date.now();

  // Find all descendant IDs if cascading
  const descendantIds = new Set();
  if (cascadeToDescendants) {
    const findDescendants = (parentId) => {
      for (const t of topics) {
        const pId = t.parentTopicId || t.parentId;
        if (pId && String(pId) === parentId) {
          descendantIds.add(String(t.id));
          findDescendants(String(t.id));
        }
      }
    };
    findDescendants(targetId);
  }

  // 1. Update target and descendants
  let updatedTopics = topics.map(t => {
    const id = String(t.id);
    if (id === targetId || descendantIds.has(id)) {
      return {
        ...t,
        masteryLevel: newMasteryLevel,
        completed: isMastered,
        completedAt: isMastered ? (t.completedAt || now) : null,
        updatedAt: now
      };
    }
    return t;
  });

  // 2. Cascade upwards to parent if all siblings are mastered
  const targetTopic = updatedTopics.find(t => String(t.id) === targetId);
  const parentId = targetTopic ? (targetTopic.parentTopicId || targetTopic.parentId) : null;

  if (parentId) {
    const siblings = updatedTopics.filter(t => {
      const p = t.parentTopicId || t.parentId;
      return p && String(p) === String(parentId);
    });

    const allSiblingsMastered = siblings.length > 0 && siblings.every(s => s.masteryLevel === TOPIC_MASTERY_LEVELS.MASTERED);
    const anySiblingLearning = siblings.some(s => s.masteryLevel === TOPIC_MASTERY_LEVELS.LEARNING || s.masteryLevel === TOPIC_MASTERY_LEVELS.MASTERED);

    updatedTopics = updatedTopics.map(t => {
      if (String(t.id) === String(parentId)) {
        let parentMastery = t.masteryLevel;
        if (allSiblingsMastered) {
          parentMastery = TOPIC_MASTERY_LEVELS.MASTERED;
        } else if (anySiblingLearning && parentMastery === TOPIC_MASTERY_LEVELS.UNSTARTED) {
          parentMastery = TOPIC_MASTERY_LEVELS.LEARNING;
        }
        return {
          ...t,
          masteryLevel: parentMastery,
          completed: allSiblingsMastered,
          completedAt: allSiblingsMastered ? (t.completedAt || now) : null,
          updatedAt: now
        };
      }
      return t;
    });
  }

  return updatedTopics;
}

/**
 * Toggles completion status of a topic with two-way cascading (upwards & downwards).
 */
export function toggleTopicCompletion(topics = [], topicId, isCompleted = true, { cascadeDown = true } = {}) {
  const targetId = String(topicId);
  const newStatus = Boolean(isCompleted);
  const newMastery = newStatus ? TOPIC_MASTERY_LEVELS.MASTERED : TOPIC_MASTERY_LEVELS.UNSTARTED;

  return updateTopicMastery(topics, targetId, newMastery, { cascadeToDescendants: cascadeDown });
}

/**
 * Pedagogical recommendation engine: recommends next sequential topics to study.
 * Prioritizes topics currently in 'learning' status, then sequential 'unstarted' topics
 * whose prerequisites are met.
 */
export function getNextRecommendedTopics({
  topics = [],
  courseId = null,
  maxCount = 3,
  leafOnly = true
} = {}) {
  let active = (topics || []).filter(t => t && !t.deleted);
  if (courseId) {
    active = active.filter(t => String(t.courseId) === String(courseId));
  }

  // Filter out already mastered topics
  let uncompleted = active.filter(t => t.masteryLevel !== TOPIC_MASTERY_LEVELS.MASTERED && !t.completed);

  // If leafOnly, filter out container module topics that have children
  if (leafOnly) {
    const parentIds = new Set(
      active.map(t => t.parentTopicId || t.parentId).filter(Boolean).map(String)
    );
    uncompleted = uncompleted.filter(t => !parentIds.has(String(t.id)));
  }

  // Group by parent
  const topicMap = new Map();
  for (const t of active) {
    topicMap.set(String(t.id), t);
  }

  // Sort candidate topics:
  // 1. In-progress / learning topics come first (+10000)
  // 2. Sequential order (incorporating parent module order and topic order)
  const candidateScores = uncompleted.map(topic => {
    let score = 0;
    if (topic.masteryLevel === TOPIC_MASTERY_LEVELS.LEARNING) {
      score += 10000;
    }

    const pId = topic.parentTopicId || topic.parentId;
    const parent = pId && topicMap.has(String(pId)) ? topicMap.get(String(pId)) : null;
    const parentOrder = parent && typeof parent.order === 'number' ? parent.order : 0;
    const topicOrder = typeof topic.order === 'number' ? topic.order : 0;

    const globalSequence = (parentOrder * 1000) + topicOrder;

    return {
      topic,
      score: score - globalSequence
    };
  });

  candidateScores.sort((a, b) => b.score - a.score);

  return candidateScores.slice(0, maxCount).map(c => c.topic);
}

/**
 * Immutably links a note ID to a topic.
 */
export function linkNoteToTopic(topics = [], topicId, noteId) {
  const nId = String(noteId).trim();
  if (!nId) return topics;

  return (topics || []).map(t => {
    if (String(t.id) === String(topicId)) {
      const existing = Array.isArray(t.linkedNoteIds) ? t.linkedNoteIds : [];
      if (!existing.includes(nId)) {
        return {
          ...t,
          linkedNoteIds: [...existing, nId],
          updatedAt: Date.now()
        };
      }
    }
    return t;
  });
}

/**
 * Immutably links a task ID to a topic.
 */
export function linkTaskToTopic(topics = [], topicId, taskId) {
  const tId = String(taskId).trim();
  if (!tId) return topics;

  return (topics || []).map(t => {
    if (String(t.id) === String(topicId)) {
      const existing = Array.isArray(t.linkedTaskIds) ? t.linkedTaskIds : [];
      if (!existing.includes(tId)) {
        return {
          ...t,
          linkedTaskIds: [...existing, tId],
          updatedAt: Date.now()
        };
      }
    }
    return t;
  });
}

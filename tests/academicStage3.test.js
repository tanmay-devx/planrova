/**
 * tests/academicStage3.test.js
 * Stage 3: Syllabus & Hierarchical Topic Tracking Engine Verification
 */

import { describe, it, expect } from 'vitest';
import {
  buildCourseSyllabusTree,
  updateTopicMastery,
  toggleTopicCompletion,
  getNextRecommendedTopics,
  linkNoteToTopic,
  linkTaskToTopic,
  TOPIC_MASTERY_LEVELS
} from '../shared/domain/academic/index.js';

describe('Academic Domain - Stage 3: Syllabus & Topic Engine', () => {
  const initialTopics = [
    {
      id: 'mod_1',
      courseId: 'cs101',
      title: 'Module 1: Foundations',
      parentTopicId: null,
      order: 1,
      estimatedMinutes: 30,
      completed: false,
      masteryLevel: TOPIC_MASTERY_LEVELS.UNSTARTED
    },
    {
      id: 'top_1_1',
      courseId: 'cs101',
      title: '1.1 Asymptotic Analysis',
      parentTopicId: 'mod_1',
      order: 1,
      estimatedMinutes: 60,
      completed: false,
      masteryLevel: TOPIC_MASTERY_LEVELS.LEARNING
    },
    {
      id: 'top_1_2',
      courseId: 'cs101',
      title: '1.2 Recurrence Relations',
      parentTopicId: 'mod_1',
      order: 2,
      estimatedMinutes: 45,
      completed: false,
      masteryLevel: TOPIC_MASTERY_LEVELS.UNSTARTED
    },
    {
      id: 'mod_2',
      courseId: 'cs101',
      title: 'Module 2: Graph Theory',
      parentTopicId: null,
      order: 2,
      estimatedMinutes: 20,
      completed: false,
      masteryLevel: TOPIC_MASTERY_LEVELS.UNSTARTED
    },
    {
      id: 'top_2_1',
      courseId: 'cs101',
      title: '2.1 Breadth-First Search',
      parentTopicId: 'mod_2',
      order: 1,
      estimatedMinutes: 50,
      completed: false,
      masteryLevel: TOPIC_MASTERY_LEVELS.UNSTARTED
    }
  ];

  describe('buildCourseSyllabusTree & Branch Rollups', () => {
    it('builds tree and computes branch metrics accurately', () => {
      const tree = buildCourseSyllabusTree(initialTopics);
      expect(tree).toHaveLength(2); // Two root modules

      const mod1 = tree[0];
      expect(mod1.id).toBe('mod_1');
      expect(mod1.subtopics).toHaveLength(2);

      // Rollup on Module 1:
      // Minutes: mod_1 (30) + top_1_1 (60) + top_1_2 (45) = 135 mins
      expect(mod1.rollup.branchTotalMinutes).toBe(135);
      expect(mod1.rollup.branchTotalCount).toBe(3);
      expect(mod1.rollup.branchCompletedCount).toBe(0);
      expect(mod1.rollup.branchCompletionPercent).toBe(0);
    });
  });

  describe('Mastery Updates & Cascading', () => {
    it('cascades downwards when parent topic is toggled complete', () => {
      const updated = toggleTopicCompletion(initialTopics, 'mod_1', true, { cascadeDown: true });
      const mod1 = updated.find(t => t.id === 'mod_1');
      const top11 = updated.find(t => t.id === 'top_1_1');
      const top12 = updated.find(t => t.id === 'top_1_2');
      const mod2 = updated.find(t => t.id === 'mod_2');

      expect(mod1.completed).toBe(true);
      expect(mod1.masteryLevel).toBe(TOPIC_MASTERY_LEVELS.MASTERED);
      expect(top11.completed).toBe(true);
      expect(top11.masteryLevel).toBe(TOPIC_MASTERY_LEVELS.MASTERED);
      expect(top12.completed).toBe(true);
      expect(top12.masteryLevel).toBe(TOPIC_MASTERY_LEVELS.MASTERED);

      // Module 2 is untouched
      expect(mod2.completed).toBe(false);
    });

    it('cascades upwards to parent when all subtopics are mastered', () => {
      // Step 1: Master topic 1.1 -> Parent module should become 'learning'
      const step1 = updateTopicMastery(initialTopics, 'top_1_1', TOPIC_MASTERY_LEVELS.MASTERED);
      const mod1Step1 = step1.find(t => t.id === 'mod_1');
      expect(mod1Step1.masteryLevel).toBe(TOPIC_MASTERY_LEVELS.LEARNING);
      expect(mod1Step1.completed).toBe(false);

      // Step 2: Master topic 1.2 -> All siblings are now mastered, so Parent becomes 'mastered'
      const step2 = updateTopicMastery(step1, 'top_1_2', TOPIC_MASTERY_LEVELS.MASTERED);
      const mod1Step2 = step2.find(t => t.id === 'mod_1');
      expect(mod1Step2.masteryLevel).toBe(TOPIC_MASTERY_LEVELS.MASTERED);
      expect(mod1Step2.completed).toBe(true);
    });
  });

  describe('Pedagogical Next Topics Recommendation', () => {
    it('prioritizes topics currently in learning status before unstarted', () => {
      const recommended = getNextRecommendedTopics({
        topics: initialTopics,
        courseId: 'cs101',
        maxCount: 2
      });

      expect(recommended).toHaveLength(2);
      // top_1_1 is in LEARNING state, so it must be recommended first
      expect(recommended[0].id).toBe('top_1_1');
      // Next sequential topic
      expect(recommended[1].id).toBe('top_1_2');
    });
  });

  describe('Entity Linking (Notes & Tasks)', () => {
    it('links note IDs and task IDs immutably without duplicates', () => {
      const withNote = linkNoteToTopic(initialTopics, 'top_1_1', 'note_123');
      const targetWithNote = withNote.find(t => t.id === 'top_1_1');
      expect(targetWithNote.linkedNoteIds).toEqual(['note_123']);

      // Attempt duplicate link
      const withDupNote = linkNoteToTopic(withNote, 'top_1_1', 'note_123');
      const targetWithDup = withDupNote.find(t => t.id === 'top_1_1');
      expect(targetWithDup.linkedNoteIds).toEqual(['note_123']);

      // Link task
      const withTask = linkTaskToTopic(withNote, 'top_1_1', 'task_abc');
      const targetWithTask = withTask.find(t => t.id === 'top_1_1');
      expect(targetWithTask.linkedTaskIds).toEqual(['task_abc']);
    });
  });
});


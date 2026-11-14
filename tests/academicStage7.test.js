/**
 * tests/academicStage7.test.js
 * Stage 7: Leitner Spaced Repetition Engine Verification
 */

import { describe, it, expect } from 'vitest';
import {
  generateReviewQueue,
  processFlashcardReview,
  computeDeckStats,
  FLASHCARD_RATINGS,
  LEITNER_BOX_INTERVALS
} from '../shared/domain/academic/index.js';

describe('Academic Domain - Stage 7: Flashcards & Leitner Spaced Repetition', () => {
  const sampleDeckId = 'deck_cs101';
  const referenceDate = '2026-11-14';

  const sampleFlashcards = [
    { id: 'c1', deckId: sampleDeckId, courseId: 'cs101', front: 'Q1', back: 'A1', box: 1, nextReviewDate: '2026-11-12', consecutiveCorrect: 0, reviewCount: 2 }, // Overdue
    { id: 'c2', deckId: sampleDeckId, courseId: 'cs101', front: 'Q2', back: 'A2', box: 2, nextReviewDate: '2026-11-14', consecutiveCorrect: 1, reviewCount: 3 }, // Due today
    { id: 'c3', deckId: sampleDeckId, courseId: 'cs101', front: 'Q3', back: 'A3', box: 3, nextReviewDate: '2026-11-20', consecutiveCorrect: 3, reviewCount: 5 }, // Due in future
    { id: 'c4', deckId: sampleDeckId, courseId: 'cs101', front: 'Q4', back: 'A4', box: 5, nextReviewDate: '2026-11-25', consecutiveCorrect: 6, reviewCount: 8 }  // Mastered, future
  ];

  describe('generateReviewQueue', () => {
    it('selects only cards due on or before reference date, prioritizing lower boxes', () => {
      const queue = generateReviewQueue({
        flashcards: sampleFlashcards,
        deckId: sampleDeckId,
        referenceDateStr: referenceDate
      });

      expect(queue).toHaveLength(2);
      // Box 1 card comes first
      expect(queue[0].id).toBe('c1');
      expect(queue[0].box).toBe(1);
      // Box 2 card comes second
      expect(queue[1].id).toBe('c2');
    });

    it('limits queue length when maxCards is specified', () => {
      const queue = generateReviewQueue({
        flashcards: sampleFlashcards,
        referenceDateStr: referenceDate,
        maxCards: 1
      });
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('c1');
    });
  });

  describe('processFlashcardReview', () => {
    const card = {
      id: 'test_card',
      deckId: 'deck_1',
      box: 2,
      reviewCount: 3,
      consecutiveCorrect: 2
    };

    it('advances box by 1 on GOOD rating and updates review count/streak', () => {
      const res = processFlashcardReview({
        flashcard: card,
        rating: FLASHCARD_RATINGS.GOOD,
        todayStr: '2026-11-14'
      });

      expect(res.updatedCard.box).toBe(3);
      expect(res.updatedCard.reviewCount).toBe(4);
      expect(res.updatedCard.consecutiveCorrect).toBe(3);
      expect(res.updatedCard.nextReviewDate).toBeDefined();

      expect(res.reviewRecord).toBeDefined();
      expect(res.reviewRecord.previousBox).toBe(2);
      expect(res.reviewRecord.newBox).toBe(3);
      expect(res.reviewRecord.intervalDays).toBe(LEITNER_BOX_INTERVALS[3]);
    });

    it('advances box by 2 on EASY rating (clamped to 5)', () => {
      const res = processFlashcardReview({
        flashcard: { ...card, box: 4 },
        rating: FLASHCARD_RATINGS.EASY,
        todayStr: '2026-11-14'
      });

      // Box 4 + 2 = 6, clamped to 5
      expect(res.updatedCard.box).toBe(5);
      expect(res.reviewRecord.newBox).toBe(5);
    });

    it('resets to Box 1 and clears streak on AGAIN rating', () => {
      const res = processFlashcardReview({
        flashcard: { ...card, box: 4, consecutiveCorrect: 5 },
        rating: FLASHCARD_RATINGS.AGAIN,
        todayStr: '2026-11-14'
      });

      expect(res.updatedCard.box).toBe(1);
      expect(res.updatedCard.consecutiveCorrect).toBe(0);
      expect(res.updatedCard.reviewCount).toBe(4);
      expect(res.reviewRecord.newBox).toBe(1);
    });

    it('maintains current box on HARD rating', () => {
      const res = processFlashcardReview({
        flashcard: card,
        rating: FLASHCARD_RATINGS.HARD,
        todayStr: '2026-11-14'
      });

      expect(res.updatedCard.box).toBe(2);
      expect(res.reviewRecord.newBox).toBe(2);
    });
  });

  describe('computeDeckStats', () => {
    it('aggregates deck distribution, due count, and mastery metrics', () => {
      const stats = computeDeckStats({
        flashcards: sampleFlashcards,
        deckId: sampleDeckId,
        referenceDateStr: referenceDate
      });

      expect(stats.totalCards).toBe(4);
      expect(stats.dueCount).toBe(2);
      expect(stats.masteredCount).toBe(1); // c4 is in box 5
      expect(stats.masteryPercentage).toBe(25); // 1 / 4 = 25%
      expect(stats.boxDistribution).toEqual({ 1: 1, 2: 1, 3: 1, 4: 0, 5: 1 });
      // 2 due cards * 30s = 60s -> 1 minute
      expect(stats.estimatedReviewMinutes).toBe(1);
    });
  });
});


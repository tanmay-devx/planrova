/**
 * shared/domain/academic/spaced-repetition.engine.js
 * Leitner 5-Box Spaced Repetition Engine for Planrova 2.0.
 *
 * Implements review queue generation, rating processing, deck analytics,
 * and study session logging.
 * 100% platform-independent; zero external dependencies.
 */

import {
  calculateNextLeitnerReview,
  getDueFlashcards
} from './academic.utils.js';
import {
  LEITNER_BOX_INTERVALS,
  FLASHCARD_RATINGS,
  VALID_FLASHCARD_RATINGS
} from './academic.types.js';

/**
 * Generates an active review queue for a user, course, or deck.
 */
export function generateReviewQueue({
  flashcards = [],
  deckId = null,
  courseId = null,
  topicId = null,
  referenceDateStr = new Date().toISOString().slice(0, 10),
  maxCards = null
} = {}) {
  let active = (flashcards || []).filter(f => f && !f.deleted);

  if (deckId) {
    active = active.filter(f => String(f.deckId) === String(deckId));
  }
  if (courseId) {
    active = active.filter(f => String(f.courseId) === String(courseId));
  }
  if (topicId) {
    active = active.filter(f => String(f.topicId) === String(topicId));
  }

  const due = getDueFlashcards(active, referenceDateStr);

  if (typeof maxCards === 'number' && maxCards > 0) {
    return due.slice(0, maxCards);
  }
  return due;
}

/**
 * Processes a card review submission, calculating new box, next review date,
 * and generating a structured review log record.
 */
export function processFlashcardReview({
  flashcard,
  rating = FLASHCARD_RATINGS.GOOD,
  reviewTimestamp = Date.now(),
  todayStr = null,
  customIntervals = LEITNER_BOX_INTERVALS
} = {}) {
  if (!flashcard) {
    throw new Error('flashcard is required');
  }

  const normalizedRating = String(rating).toLowerCase();
  if (!VALID_FLASHCARD_RATINGS.includes(normalizedRating)) {
    throw new Error(`Invalid flashcard rating: ${rating}. Must be one of ${VALID_FLASHCARD_RATINGS.join(', ')}`);
  }

  const currentBox = typeof flashcard.box === 'number' && flashcard.box >= 1 && flashcard.box <= 5
    ? flashcard.box
    : 1;

  const reviewResult = calculateNextLeitnerReview({
    currentBox,
    rating: normalizedRating,
    reviewTimestamp,
    todayStr,
    customIntervals
  });

  const isCorrect = normalizedRating === FLASHCARD_RATINGS.GOOD || normalizedRating === FLASHCARD_RATINGS.EASY;
  const currentConsecutive = typeof flashcard.consecutiveCorrect === 'number' ? flashcard.consecutiveCorrect : 0;
  const consecutiveCorrect = isCorrect ? currentConsecutive + 1 : 0;
  const reviewCount = (typeof flashcard.reviewCount === 'number' ? flashcard.reviewCount : 0) + 1;

  const updatedCard = {
    ...flashcard,
    box: reviewResult.nextBox,
    nextReviewDate: reviewResult.nextReviewDate,
    nextReviewAt: reviewResult.nextReviewAt,
    lastReviewedAt: reviewTimestamp,
    reviewCount,
    consecutiveCorrect,
    updatedAt: reviewTimestamp
  };

  const reviewRecord = {
    id: `rev_${reviewTimestamp}_${Math.floor(Math.random() * 1000)}`,
    cardId: flashcard.id,
    deckId: flashcard.deckId || null,
    courseId: flashcard.courseId || null,
    topicId: flashcard.topicId || null,
    rating: normalizedRating,
    previousBox: currentBox,
    newBox: reviewResult.nextBox,
    intervalDays: reviewResult.intervalDays,
    timestamp: reviewTimestamp
  };

  return {
    updatedCard,
    reviewRecord
  };
}

/**
 * Computes aggregate statistics and mastery distribution for a flashcard deck.
 */
export function computeDeckStats({
  flashcards = [],
  deckId = null,
  referenceDateStr = new Date().toISOString().slice(0, 10)
} = {}) {
  let active = (flashcards || []).filter(f => f && !f.deleted);
  if (deckId) {
    active = active.filter(f => String(f.deckId) === String(deckId));
  }

  const totalCards = active.length;
  const boxDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalBoxSum = 0;
  let totalReviews = 0;
  let masteredCount = 0;

  for (const card of active) {
    const box = typeof card.box === 'number' && card.box >= 1 && card.box <= 5 ? card.box : 1;
    boxDistribution[box] = (boxDistribution[box] || 0) + 1;
    totalBoxSum += box;
    totalReviews += (card.reviewCount || 0);
    if (box === 5) {
      masteredCount++;
    }
  }

  const dueCards = getDueFlashcards(active, referenceDateStr);
  const dueCount = dueCards.length;

  const averageBox = totalCards > 0 ? Number((totalBoxSum / totalCards).toFixed(2)) : 1.0;
  const masteryPercentage = totalCards > 0 ? Number(((masteredCount / totalCards) * 100).toFixed(1)) : 0;

  return {
    totalCards,
    dueCount,
    masteredCount,
    masteryPercentage,
    averageBox,
    totalReviews,
    boxDistribution,
    estimatedReviewMinutes: Math.ceil((dueCount * 30) / 60) // 30 seconds average per card
  };
}


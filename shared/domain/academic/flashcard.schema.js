/**
 * shared/domain/academic/flashcard.schema.js
 * Flashcard and Deck entity schemas, validation, and normalization for Planrova 2.0.
 *
 * Implements 5-box Leitner spaced repetition metadata.
 * 100% platform-independent; zero external dependencies.
 */

export function validateDeck(deck) {
  const errors = [];
  if (!deck || typeof deck !== 'object') {
    return { valid: false, errors: ['Deck must be an object'] };
  }

  if (!deck.id || typeof deck.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  if (!deck.title || typeof deck.title !== 'string' || deck.title.trim().length === 0) {
    errors.push('title is required and must be a non-empty string');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeDeck(raw = {}) {
  const now = Date.now();
  const id = raw.id || `deck_${now}_${Math.floor(Math.random() * 1000)}`;
  const userId = raw.userId || 'local';
  const title = (raw.title || 'Untitled Deck').trim();
  const description = raw.description ? String(raw.description).trim() : '';
  const courseId = raw.courseId ? String(raw.courseId).trim() : null;
  const topicId = raw.topicId ? String(raw.topicId).trim() : null;

  return {
    id,
    userId,
    title,
    description,
    courseId,
    topicId,
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}

export function validateFlashcard(card) {
  const errors = [];
  if (!card || typeof card !== 'object') {
    return { valid: false, errors: ['Flashcard must be an object'] };
  }

  if (!card.id || typeof card.id !== 'string') {
    errors.push('id is required and must be a string');
  }

  if (!card.deckId || typeof card.deckId !== 'string') {
    errors.push('deckId is required and must be a string');
  }

  if (!card.front || typeof card.front !== 'string' || card.front.trim().length === 0) {
    errors.push('front text/prompt is required and must be non-empty');
  }

  if (!card.back || typeof card.back !== 'string' || card.back.trim().length === 0) {
    errors.push('back answer/explanation is required and must be non-empty');
  }

  if (card.box !== undefined) {
    if (typeof card.box !== 'number' || card.box < 1 || card.box > 5 || !Number.isInteger(card.box)) {
      errors.push('box must be an integer between 1 and 5');
    }
  }

  if (card.nextReviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(card.nextReviewDate)) {
    errors.push('nextReviewDate must be in YYYY-MM-DD format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeFlashcard(raw = {}) {
  const now = Date.now();
  const id = raw.id || `crd_${now}_${Math.floor(Math.random() * 1000)}`;
  const userId = raw.userId || 'local';
  const deckId = raw.deckId ? String(raw.deckId).trim() : '';
  const courseId = raw.courseId ? String(raw.courseId).trim() : null;
  const topicId = raw.topicId ? String(raw.topicId).trim() : null;
  const front = (raw.front || '').trim();
  const back = (raw.back || '').trim();
  
  let box = 1;
  if (typeof raw.box === 'number' && Number.isInteger(raw.box) && raw.box >= 1 && raw.box <= 5) {
    box = raw.box;
  }

  // Default next review date to today in YYYY-MM-DD if unspecified
  const defaultDateStr = new Date(now).toISOString().slice(0, 10);
  const nextReviewDate = raw.nextReviewDate && /^\d{4}-\d{2}-\d{2}$/.test(raw.nextReviewDate)
    ? raw.nextReviewDate
    : defaultDateStr;

  const lastReviewedAt = typeof raw.lastReviewedAt === 'number' ? raw.lastReviewedAt : null;
  const reviewCount = typeof raw.reviewCount === 'number' && raw.reviewCount >= 0 ? Math.round(raw.reviewCount) : 0;
  const consecutiveCorrect = typeof raw.consecutiveCorrect === 'number' && raw.consecutiveCorrect >= 0 
    ? Math.round(raw.consecutiveCorrect) 
    : 0;

  return {
    id,
    userId,
    deckId,
    courseId,
    topicId,
    front,
    back,
    box,
    nextReviewDate,
    lastReviewedAt,
    reviewCount,
    consecutiveCorrect,
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}


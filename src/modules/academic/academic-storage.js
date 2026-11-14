/**
 * src/modules/academic/academic-storage.js
 * Scoped, offline-first persistence adapter for Academic Workspace entities.
 *
 * Utilizes Planrova's local-first storage layer (Dexie + in-memory cache + Cloud Firestore sync).
 */

import { getStorageItem, setStorageItem } from '../../utils/storage.js';
import { ACADEMIC_STORAGE_KEYS } from '../../../shared/domain/academic/academic.types.js';
import {
  normalizeSemester,
  normalizeCourse,
  normalizeTopic,
  normalizeAssessment,
  normalizeAssignment,
  normalizeDeck,
  normalizeFlashcard
} from '../../../shared/domain/academic/academic.validation.js';

// ── Semesters ───────────────────────────────────────────────────────────
export function getSemesters() {
  return getStorageItem(ACADEMIC_STORAGE_KEYS.SEMESTERS, []);
}

export function saveSemester(semester) {
  const norm = normalizeSemester(semester);
  const existing = getSemesters();
  const idx = existing.findIndex(s => String(s.id) === String(norm.id));
  let updated;
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = norm;
  } else {
    updated = [...existing, norm];
  }
  setStorageItem(ACADEMIC_STORAGE_KEYS.SEMESTERS, updated);
  return norm;
}

export function getActiveSemester() {
  const semesters = getSemesters();
  return semesters.find(s => s.status === 'active' || s.isDefault) || semesters[0] || null;
}

// ── Courses ─────────────────────────────────────────────────────────────
export function getCourses() {
  return getStorageItem(ACADEMIC_STORAGE_KEYS.COURSES, []);
}

export function saveCourse(course) {
  const norm = normalizeCourse(course);
  const existing = getCourses();
  const idx = existing.findIndex(c => String(c.id) === String(norm.id));
  let updated;
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = norm;
  } else {
    updated = [...existing, norm];
  }
  setStorageItem(ACADEMIC_STORAGE_KEYS.COURSES, updated);
  return norm;
}

export function deleteCourse(courseId) {
  const existing = getCourses();
  const updated = existing.filter(c => String(c.id) !== String(courseId));
  setStorageItem(ACADEMIC_STORAGE_KEYS.COURSES, updated);
}

// ── Syllabus Topics ─────────────────────────────────────────────────────
export function getSyllabusTopics() {
  return getStorageItem(ACADEMIC_STORAGE_KEYS.SYLLABUS_TOPICS, []);
}

export function saveSyllabusTopics(topics) {
  setStorageItem(ACADEMIC_STORAGE_KEYS.SYLLABUS_TOPICS, topics);
}

export function saveTopic(topic) {
  const norm = normalizeTopic(topic);
  const existing = getSyllabusTopics();
  const idx = existing.findIndex(t => String(t.id) === String(norm.id));
  let updated;
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = norm;
  } else {
    updated = [...existing, norm];
  }
  setStorageItem(ACADEMIC_STORAGE_KEYS.SYLLABUS_TOPICS, updated);
  return norm;
}

// ── Assessments ─────────────────────────────────────────────────────────
export function getAssessments() {
  return getStorageItem(ACADEMIC_STORAGE_KEYS.ASSESSMENTS, []);
}

export function saveAssessment(assessment) {
  const norm = normalizeAssessment(assessment);
  const existing = getAssessments();
  const idx = existing.findIndex(a => String(a.id) === String(norm.id));
  let updated;
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = norm;
  } else {
    updated = [...existing, norm];
  }
  setStorageItem(ACADEMIC_STORAGE_KEYS.ASSESSMENTS, updated);
  return norm;
}

// ── Assignments ─────────────────────────────────────────────────────────
export function getAssignments() {
  return getStorageItem(ACADEMIC_STORAGE_KEYS.ASSIGNMENTS, []);
}

export function saveAssignment(assignment) {
  const norm = normalizeAssignment(assignment);
  const existing = getAssignments();
  const idx = existing.findIndex(a => String(a.id) === String(norm.id));
  let updated;
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = norm;
  } else {
    updated = [...existing, norm];
  }
  setStorageItem(ACADEMIC_STORAGE_KEYS.ASSIGNMENTS, updated);
  return norm;
}

// ── Flashcard Decks & Cards ─────────────────────────────────────────────
export function getFlashcardDecks() {
  return getStorageItem(ACADEMIC_STORAGE_KEYS.FLASHCARD_DECKS, []);
}

export function saveDeck(deck) {
  const norm = normalizeDeck(deck);
  const existing = getFlashcardDecks();
  const idx = existing.findIndex(d => String(d.id) === String(norm.id));
  let updated;
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = norm;
  } else {
    updated = [...existing, norm];
  }
  setStorageItem(ACADEMIC_STORAGE_KEYS.FLASHCARD_DECKS, updated);
  return norm;
}

export function getFlashcards() {
  return getStorageItem(ACADEMIC_STORAGE_KEYS.FLASHCARDS, []);
}

export function saveFlashcards(flashcards) {
  setStorageItem(ACADEMIC_STORAGE_KEYS.FLASHCARDS, flashcards);
}

export function saveFlashcard(card) {
  const norm = normalizeFlashcard(card);
  const existing = getFlashcards();
  const idx = existing.findIndex(c => String(c.id) === String(norm.id));
  let updated;
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = norm;
  } else {
    updated = [...existing, norm];
  }
  setStorageItem(ACADEMIC_STORAGE_KEYS.FLASHCARDS, updated);
  return norm;
}

export function getFlashcardReviews() {
  return getStorageItem(ACADEMIC_STORAGE_KEYS.FLASHCARD_REVIEWS, []);
}

export function logFlashcardReview(reviewRecord) {
  const existing = getFlashcardReviews();
  setStorageItem(ACADEMIC_STORAGE_KEYS.FLASHCARD_REVIEWS, [...existing, reviewRecord]);
}


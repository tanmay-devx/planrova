/**
 * shared/domain/academic/academic.validation.js
 * Unified validation suite for Planrova 2.0 Academic Entities.
 */

import { validateSemester, normalizeSemester } from './semester.schema.js';
import { validateCourse, normalizeCourse } from './course.schema.js';
import { validateTopic, normalizeTopic } from './syllabus.schema.js';
import { validateAssessment, normalizeAssessment } from './assessment.schema.js';
import { validateAssignment, normalizeAssignment } from './assignment.schema.js';
import { validateDeck, normalizeDeck, validateFlashcard, normalizeFlashcard } from './flashcard.schema.js';

export {
  validateSemester,
  normalizeSemester,
  validateCourse,
  normalizeCourse,
  validateTopic,
  normalizeTopic,
  validateAssessment,
  normalizeAssessment,
  validateAssignment,
  normalizeAssignment,
  validateDeck,
  normalizeDeck,
  validateFlashcard,
  normalizeFlashcard
};

/**
 * Validates any academic entity based on its entity type.
 */
export function validateAcademicEntity(entityType, entity) {
  switch (entityType) {
    case 'semester':
      return validateSemester(entity);
    case 'course':
      return validateCourse(entity);
    case 'topic':
    case 'syllabus_topic':
      return validateTopic(entity);
    case 'assessment':
      return validateAssessment(entity);
    case 'assignment':
      return validateAssignment(entity);
    case 'deck':
    case 'flashcard_deck':
      return validateDeck(entity);
    case 'flashcard':
      return validateFlashcard(entity);
    default:
      return { valid: false, errors: [`Unknown academic entity type: ${entityType}`] };
  }
}


/**
 * shared/domain/ai/ai.permissions.js
 * Permission Management and Domain Consent Checks for Planrova AI.
 *
 * Invariants:
 * 1. AI is disabled by default (opt-in).
 * 2. Sensitive domains (finance, wellbeing, notes) are excluded unless explicitly authorized.
 * 3. Revoking permission immediately excludes that domain's data from future prompts.
 */

import { AI_CONTEXT_CATEGORIES } from './ai.types.js';

export function isAIEnabled(permissions) {
  return Boolean(permissions && permissions.enabled);
}

export function hasDomainPermission(permissions, domainKey) {
  if (!isAIEnabled(permissions)) return false;
  if (!permissions.domains) return false;
  return Boolean(permissions.domains[domainKey]);
}

export function enableAI(permissions, { cloudConsent = false } = {}) {
  return {
    ...permissions,
    enabled: true,
    cloudConsent: Boolean(cloudConsent),
    updatedAt: new Date().toISOString()
  };
}

export function disableAI(permissions) {
  return {
    ...permissions,
    enabled: false,
    updatedAt: new Date().toISOString()
  };
}

export function updateDomainPermission(permissions, domainKey, isGranted) {
  if (!Object.values(AI_CONTEXT_CATEGORIES).includes(domainKey)) {
    throw new Error(`Invalid context category domain: ${domainKey}`);
  }

  return {
    ...permissions,
    domains: {
      ...permissions.domains,
      [domainKey]: Boolean(isGranted)
    },
    updatedAt: new Date().toISOString()
  };
}

export function explainDomainPrivacy(domainKey) {
  switch (domainKey) {
    case AI_CONTEXT_CATEGORIES.TASKS:
      return 'Includes titles, due dates, and priorities of active tasks. Excludes private descriptions.';
    case AI_CONTEXT_CATEGORIES.SCHEDULE:
      return 'Includes target day calendar events and availability blocks. Excludes other dates.';
    case AI_CONTEXT_CATEGORIES.ACADEMIC:
      return 'Includes enrolled course codes, syllabus completion %, and due flashcard counts. Excludes raw exam answers.';
    case AI_CONTEXT_CATEGORIES.NOTES:
      return 'Includes titles and short summaries of recently accessed notes. Sensitive contents are redacted.';
    case AI_CONTEXT_CATEGORIES.FINANCE:
      return 'Includes high-level budget categories, spending pace, and upcoming bills. Excludes account numbers and banking details.';
    case AI_CONTEXT_CATEGORIES.HABITS:
      return 'Includes active habit names, frequencies, and streaks. Excludes private notes.';
    case AI_CONTEXT_CATEGORIES.WELLBEING:
      return 'Includes hydration volume and routine steps. Excludes private personal check-in notes and emotional reflection entries.';
    case AI_CONTEXT_CATEGORIES.PREFERENCES:
      return 'Includes working hour preferences and sleep buffer windows.';
    default:
      return 'Standard application context.';
  }
}


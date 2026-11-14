/**
 * shared/domain/ai/ai.context.js
 * Privacy-First Context Engine & Data Minimization for Planrova AI.
 *
 * Invariants:
 * 1. Never sends the full user database to AI models.
 * 2. Only includes categories explicitly permitted by user permissions.
 * 3. Enforces strict data minimization (stripping account numbers, private journal notes, etc.).
 * 4. Limits total assembled context size to fit conservative token budgets.
 */

import { AI_CONTEXT_CATEGORIES } from './ai.types.js';
import { hasDomainPermission } from './ai.permissions.js';

export function assembleAIContext({
  permissions,
  userData = {},
  requestedCategories = [],
  targetDateStr = new Date().toISOString().slice(0, 10),
  maxCharacterLimit = 4000
} = {}) {
  const categoriesIncluded = [];
  const categoriesExcluded = [];
  const contextLines = [];

  // Determine which categories to check
  const allCategories = Object.values(AI_CONTEXT_CATEGORIES);
  const targetCategories = requestedCategories.length > 0
    ? requestedCategories.filter(c => allCategories.includes(c))
    : allCategories;

  contextLines.push(`[SYSTEM CONTEXT: Planrova Personal Life OS - Reference Date: ${targetDateStr}]`);

  for (const cat of targetCategories) {
    if (!hasDomainPermission(permissions, cat)) {
      categoriesExcluded.push(cat);
      continue;
    }

    categoriesIncluded.push(cat);
    const domainText = extractMinimizedDomainData(cat, userData, targetDateStr);
    if (domainText) {
      contextLines.push(`\n--- [CATEGORY: ${cat.toUpperCase()}] ---\n${domainText}`);
    }
  }

  let fullContext = contextLines.join('\n');

  // Enforce strict character budget limit
  if (fullContext.length > maxCharacterLimit) {
    fullContext = fullContext.slice(0, maxCharacterLimit) + '\n... [Context truncated for privacy and token limits]';
  }

  return {
    contextText: fullContext,
    categoriesIncluded,
    categoriesExcluded
  };
}

function extractMinimizedDomainData(category, userData, targetDateStr) {
  switch (category) {
    case AI_CONTEXT_CATEGORIES.TASKS: {
      const tasks = Array.isArray(userData.tasks) ? userData.tasks : [];
      const active = tasks.filter(t => !t.completed && !t.deleted);
      if (active.length === 0) return 'No pending tasks.';
      return active.slice(0, 10).map(t => 
        `- "${t.title}" (Priority: ${t.priority || 'medium'}, Due: ${t.dueDate || 'none'})`
      ).join('\n');
    }

    case AI_CONTEXT_CATEGORIES.SCHEDULE: {
      const events = Array.isArray(userData.calendarEvents) ? userData.calendarEvents : [];
      const todayEvents = events.filter(e => e.date === targetDateStr || (e.startTime && e.startTime.startsWith(targetDateStr)));
      if (todayEvents.length === 0) return 'No fixed commitments scheduled for today.';
      return todayEvents.slice(0, 8).map(e =>
        `- ${e.startTime || e.time || 'All Day'}: "${e.title}"`
      ).join('\n');
    }

    case AI_CONTEXT_CATEGORIES.ACADEMIC: {
      const courses = Array.isArray(userData.courses) ? userData.courses : [];
      const flashcards = Array.isArray(userData.flashcards) ? userData.flashcards : [];
      const dueCards = flashcards.filter(f => !f.deleted && (f.nextReviewDate ? f.nextReviewDate <= targetDateStr : true));

      const courseSummaries = courses.slice(0, 5).map(c => 
        `- ${c.name} (${c.courseCode || 'N/A'}, ${c.credits || 3} credits)`
      );

      return [
        `Enrolled Courses (${courses.length}):`,
        ...courseSummaries,
        `Flashcards Due for Leitner Spaced Review: ${dueCards.length} card(s)`
      ].join('\n');
    }

    case AI_CONTEXT_CATEGORIES.HABITS: {
      const habits = Array.isArray(userData.habits) ? userData.habits : [];
      const active = habits.filter(h => h.isActive !== false && !h.archived);
      if (active.length === 0) return 'No active habits.';
      return active.slice(0, 8).map(h =>
        `- ${h.name} (Frequency: ${h.frequency || 'daily'}, Streak: ${h.streak || 0} days)`
      ).join('\n');
    }

    case AI_CONTEXT_CATEGORIES.WELLBEING: {
      const hydrationLogs = Array.isArray(userData.hydrationLogs) ? userData.hydrationLogs : [];
      const todayLogs = hydrationLogs.filter(l => l.dateKey === targetDateStr);
      const totalMl = todayLogs.reduce((sum, l) => sum + (l.amountMl || 0), 0);
      const targetMl = userData.hydrationTargetMl || 2500;

      return `Daily Hydration: ${totalMl} ml logged of ${targetMl} ml target.\n(Note: Personal reflection check-in text is strictly excluded from AI context).`;
    }

    case AI_CONTEXT_CATEGORIES.FINANCE: {
      const budgets = Array.isArray(userData.budgets) ? userData.budgets : [];
      const recurring = Array.isArray(userData.recurringPayments) ? userData.recurringPayments : [];
      const upcoming = recurring.filter(r => r.isActive && r.nextDueDate && r.nextDueDate >= targetDateStr);

      const budgetLines = budgets.slice(0, 5).map(b =>
        `- Budget "${b.name || b.categoryId}": Status ${b.status || 'active'}`
      );

      const recurringLines = upcoming.slice(0, 5).map(r =>
        `- Upcoming bill "${r.title}": Due ${r.nextDueDate}`
      );

      return [
        'Budgets:',
        ...(budgetLines.length ? budgetLines : ['None configured']),
        'Upcoming Obligations:',
        ...(recurringLines.length ? recurringLines : ['No upcoming bills due'])
      ].join('\n');
    }

    case AI_CONTEXT_CATEGORIES.NOTES: {
      const notes = Array.isArray(userData.notes) ? userData.notes : [];
      const recent = notes.slice(0, 3);
      if (recent.length === 0) return 'No recent notes.';
      return recent.map(n => `- "${n.title || 'Untitled'}": ${(n.content || '').slice(0, 100)}...`).join('\n');
    }

    case AI_CONTEXT_CATEGORIES.PREFERENCES: {
      const prefs = userData.preferences || {};
      return `Working Hours: ${prefs.dayStartTime || '08:00'} - ${prefs.dayEndTime || '22:00'}, Sleep Buffer: ${prefs.sleepBufferHours || 8} hrs.`;
    }

    default:
      return '';
  }
}


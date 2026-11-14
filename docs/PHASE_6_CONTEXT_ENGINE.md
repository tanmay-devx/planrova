# Planrova 2.0 — Phase 6 Context Engine Specification

**Author:** Principal Software Architect & Data Engineer  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_CONTEXT_ENGINE.md`

---

## 1. Engine Objective

The Context Engine ([`shared/domain/ai/ai.context.js`](file:///home/tanmay/Videos/planrova/shared/domain/ai/ai.context.js)) is responsible for taking the user's local application state, filtering it against verified user permissions, and minimizing the records into a compact text payload for inference.

---

## 2. Selection & Filtering Algorithm

```
                  ┌──────────────────────────────────────────────┐
                  │           User State in IndexedDB            │
                  │  (Tasks, Events, Courses, Budgets, Habits)   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │      Category Permission Filter (8 Domains)  │
                  │        (hasDomainPermission(perms, cat))     │
                  └──────────────────────┬───────────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                 [ Permitted Domains ]           [ Denied Domains ]
                         │                               │
                         ▼                               ▼
               [ Domain Minimization ]          [ Completely Excluded ]
                         │
                         ▼
               [ Token Budget Limiter ]
             (Max 4,000 characters cutoff)
                         │
                         ▼
               [ Minimized Prompt Context ]
```

---

## 3. Minimization Rules by Domain

1. **Tasks**:
   - Only active tasks (`!completed && !deleted`).
   - Caps output at 10 items.
   - Extracts only `title`, `priority`, and `dueDate`.
2. **Schedule**:
   - Scoped strictly to `targetDateStr` (today).
   - Historical and future days are omitted.
   - Formatted as chronological start times and event titles.
3. **Academic**:
   - Course names, course codes, and credit values.
   - Count of due Leitner flashcards.
   - Detailed grades, past test scores, and professor notes are stripped.
4. **Finance**:
   - Status of category budgets (e.g. `healthy`, `approaching_limit`).
   - Upcoming bill titles and due dates.
   - Account numbers, card digits, opening balances, and individual transactions are **never** included.
5. **Wellbeing**:
   - Daily water intake volume vs target.
   - Routine names.
   - Personal check-in ratings (mood, energy, stress) and private journal notes are **strictly excluded**.


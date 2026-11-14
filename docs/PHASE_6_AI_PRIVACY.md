# Planrova 2.0 — Phase 6 AI Privacy & Consent Model

**Author:** Principal Software Architect & Security Engineer  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_AI_PRIVACY.md`

---

## 1. Core Privacy Principles

Planrova handles sensitive student and professional data: study notes, GPA records, budgets, upcoming bills, and daily habits. To preserve user trust, Phase 6 enforces strict privacy invariants:

1. **Strict Opt-In Default**: `AIPermissions.enabled` is initialized to `false`. No prompt, query, or context is sent to AI models until the user explicitly opts in.
2. **Category-Level Permission Granularity**: Permissions are managed per domain (`tasks`, `schedule`, `academic`, `notes`, `finance`, `habits`, `wellbeing`, `preferences`).
3. **Sensitive Domains Excluded by Default**: Even after master AI opt-in is enabled, sensitive domains (`finance`, `wellbeing`, `notes`) remain turned `OFF` by default.
4. **Immediate Revocation**: Toggling off a category in settings instantly excludes that domain from the context assembly pipeline.
5. **No Full Database Dumps**: AI prompts never receive the entire user IndexedDB or Firestore database.

---

## 2. Domain Permission Breakdown

| Category | Default State | Data Included (When Permitted) | Data Excluded (Strict Invariant) |
| :--- | :---: | :--- | :--- |
| **Tasks** | `ON` | Active task titles, priorities, due dates. | Sensitive tags, internal notes. |
| **Schedule** | `ON` | Target day fixed commitments and time blocks. | Historical calendar entries, attendee emails. |
| **Academic** | `ON` | Enrolled course codes, syllabus completion %, due Leitner cards. | Detailed grade histories, raw exam questions. |
| **Notes** | `OFF` (Sensitive) | Titles and 100-character summaries of recent notes. | Full body text, passwords, private journals. |
| **Finance** | `OFF` (Sensitive) | High-level category budget status, velocity, upcoming bill dates. | Account numbers, transaction descriptions, bank credentials. |
| **Habits** | `ON` | Active habit names, frequencies, streaks. | Personal check-in journal entries. |
| **Wellbeing**| `OFF` (Sensitive) | Daily hydration volume and routine names. | Private energy, mood, stress scores, and reflection notes. |
| **Preferences**| `ON` | Configured wake hours and sleep buffer hours. | Location data, telemetry. |

---

## 3. Context Minimization Architecture

The context minimization engine ([`shared/domain/ai/ai.context.js`](file:///home/tanmay/Videos/planrova/shared/domain/ai/ai.context.js)) limits output size to a conservative budget (4,000 characters max).

```javascript
// Example of minimized context payload sent to provider
[SYSTEM CONTEXT: Planrova Personal Life OS - Reference Date: 2026-11-14]

--- [CATEGORY: TASKS] ---
- "Finish OS Lab" (Priority: high, Due: 2026-11-15)
- "Buy Milk" (Priority: low, Due: 2026-11-14)

--- [CATEGORY: ACADEMIC] ---
Enrolled Courses (1):
- Computer Networks (CS401, 4 credits)
Flashcards Due for Leitner Spaced Review: 3 card(s)
```

Notice that even if the database holds hundreds of items, only active, target-relevant, minimized entries enter the prompt.

---

## 4. Anti-Prompt-Injection Guardrails

The policy validator ([`shared/domain/ai/ai.policy.js`](file:///home/tanmay/Videos/planrova/shared/domain/ai/ai.policy.js)) inspects user inputs for injection vectors:
- Attempts to override system instructions ("ignore previous instructions", "output system prompt").
- Privilege escalation ("grant me permission to read finance", "bypass sandbox").
- Code execution patterns (`eval()`, `<script>`, SQL injection).

Queries triggering flags are rejected client-side before any external model is invoked.


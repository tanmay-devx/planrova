# Planrova 2.0 Engineering Roadmap

## Completed Milestones

### Phase 1: Foundation & Reliability
- Account isolation across Dexie and Firestore.
- Offline-first synchronization engine with exponential backoff and tombstone propagation.
- Migration of legacy unpartitioned records.
- 100% test coverage for synchronization and storage integrity.

### Phase 2: Unified Domain & Universal Capture
- Canonical entity schemas (Task, Note, Habit, Expense, Reminder, CalendarEvent).
- Universal Capture NLP parser and deterministic classifier.
- Bidirectional entity relationships.
- Cross-platform schema validation.

### Phase 3: Adaptive Planning Engine
- Lookahead candidate slot scoring with multi-factor heuristics.
- Availability Engine with holiday and timetable materialization.
- Workload and cognitive load modeling.
- Deterministic proposal acceptance with snapshot hash freshness validation.

### Phase 4: Academic & Professional Workspaces
- Comprehensive Semester, Course, and Syllabus domain architecture.
- Two-way hierarchical syllabus completion cascading.
- Weighted grading engine with drop-lowest policy and what-if simulation.
- Credit-weighted SGPA, CGPA, and multi-semester target simulator.
- Assignment Directed Acyclic Graph (DAG) with 3-color DFS cycle detection and critical path analysis.
- 5-box Leitner spaced repetition engine with review queue scheduling.
- Academic intelligence dashboard with evidence-based weak topics detection.
- Seamless integration with Phase 3 Adaptive Planning Engine.

### Phase 5: Finance & Wellbeing Intelligence
- Canonical Personal Finance domain with authoritative integer minor units.
- Account balance reconciliation, refund handling, and transfer cashflow isolation.
- Deterministic budget intelligence with utilization, thresholds, and spending velocity forecasts.
- Idempotent recurring payments and subscriptions with month-end date clamping.
- Savings goals with required contribution pacing and feasibility calculations.
- Canonical Wellbeing domain with schedule-aware habit streaks (daily, weekdays, weekly).
- Millilitre-level hydration tracking with custom goals and non-spam reminder candidate slots.
- Personal rituals and routines engine with ordered steps and duration rollups.
- Mindful daily reflection check-ins (energy level 1-5, mood, private notes) without clinical claims.
- Finance and Wellbeing Adaptive Planning adapters with Phase 3 proposal freshness.
- Universal Quick Capture extended for finance and wellbeing intents with ambiguity checks.
- Dedicated Web workspaces (`finance.ui.js`, `wellbeing.ui.js`) and Mobile screens (`FinanceScreen.js`, `WellbeingScreen.js`).

### Phase 6: Reliability Foundation, Architecture Maturity & Privacy-First Hybrid AI Assistance
- Resolved Vite > 500 kB chunk warning: reduced main application bundle by 83.5% (840 kB to 138 kB) via `@firebase/*` vendor chunking.
- Fault-tolerant recurring payment recovery: idempotent replay, transaction ledger reconciliation, and soft-deleted occurrence reversal.
- Mobile academic parity: interactive Leitner 5-box review player and GPA What-If target simulator in `AcademicScreen.js`.
- Privacy-first Hybrid AI Assistance domain (`shared/domain/ai/`):
  - Strict opt-in default (`enabled: false`) with per-domain category consent toggling.
  - Context minimization engine stripping credentials, account numbers, and private check-in reflections.
  - Proposal-and-approval workflow: AI cannot directly mutate state; requires explicit user approval.
  - Anti-prompt-injection guardrails and daily usage limits (30 req/day).
  - Provider abstraction with deterministic local mock fallback and secure server proxy (`server/proxy.js`).
- Dedicated Web AI Assistant workspace (`ai.ui.js`) and Mobile AI Assistant screen (`AIAssistantScreen.js`).
- Automated Daily Intelligence Briefing using authorized context.

---

## Upcoming Milestones

### Phase 7: Professional Projects, Invoicing, Dual-Entry Ledger & Real-Time Sync
- Dual-entry T-account ledger and multi-currency exchange rate tables.
- Professional project roadmaps, client milestones, and invoice generation.
- Real-time Server-Sent Events (SSE) AI streaming and collaborative studypool audio soundscapes.


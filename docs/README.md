# Planrova 2.0 — Engineering & Architecture Documentation

Welcome to the canonical documentation for **Planrova 2.0**, an AI-powered, local-first Personal Life Operating System engineered for students, educators, and professionals.

> **Core Philosophy:** *Capture anything once. Organize it intelligently. Manage your entire life from one system.*

---

## 1. Documentation Index

The documentation is organized into clear, authoritative pillars. Redundant historical baselines and fragmented notes have been consolidated into these canonical specifications:

### Core System Specifications
- [`docs/ARCHITECTURE.md`](file:///home/tanmay/Videos/planrova/docs/ARCHITECTURE.md)  
  High-level architecture, hybrid local-first data flow, three-tier state caching (L1/L2/L3), Rollup code-splitting, and cross-platform boundaries (Web, Mobile, Backend Proxy).
- [`docs/PRODUCT.md`](file:///home/tanmay/Videos/planrova/docs/PRODUCT.md)  
  Product vision, target user personas, core design principles, and comprehensive feature inventory across all 6 domains.
- [`docs/ROADMAP.md`](file:///home/tanmay/Videos/planrova/docs/ROADMAP.md)  
  Milestones completed (Phases 1 through 6) and upcoming architectural objectives (Phase 7+).
- [`docs/TECHNICAL_DEBT.md`](file:///home/tanmay/Videos/planrova/docs/TECHNICAL_DEBT.md)  
  Active technical debt log, container/environment constraints, performance realities, and target refactorings.
- [`docs/SECURITY.md`](file:///home/tanmay/Videos/planrova/docs/SECURITY.md)  
  End-to-end security architecture: Firebase Bearer token verification, server-side quotas, Firestore rules, anti-prompt injection, and AI context privacy.

---

### Domain Specifications & Engines
- [`docs/DOMAIN_MODELS.md`](file:///home/tanmay/Videos/planrova/docs/DOMAIN_MODELS.md)  
  Canonical schemas (Task, CalendarEvent, Habit, Note, Expense, Reminder), entity relationship graph, and the **Universal Quick Capture NLP Engine** (`capture.classifier.js`, `capture.parser.js`).
- [`docs/SCHEDULING_ENGINE.md`](file:///home/tanmay/Videos/planrova/docs/SCHEDULING_ENGINE.md)  
  The Phase 3 Adaptive Planning Engine: availability materialization, candidate slot scoring, flexible capacity utilization, conflict detection, split-task handling, and proposal freshness hashing.
- [`docs/ACADEMIC_DOMAIN.md`](file:///home/tanmay/Videos/planrova/docs/ACADEMIC_DOMAIN.md)  
  Phase 4 Academic Intelligence: Semesters, Courses, 2-way hierarchical Syllabus Tree, Weighted Grading with drop-lowest & what-if simulator, SGPA/CGPA calculations, 3-color DFS Assignment DAG critical path, and 5-box Leitner spaced repetition player.
- [`docs/FINANCE_DOMAIN.md`](file:///home/tanmay/Videos/planrova/docs/FINANCE_DOMAIN.md)  
  Phase 5 Personal Finance: Integer minor-unit accounting, account reconciliation, budget utilization, recurring subscriptions with month-end date clamping & idempotent replay, and savings goal pacing.
- [`docs/WELLBEING_DOMAIN.md`](file:///home/tanmay/Videos/planrova/docs/WELLBEING_DOMAIN.md)  
  Phase 5 Wellbeing Intelligence: Habit streaks across daily/weekday/weekly cadences, millilitre-level hydration tracking with candidate reminder slots, structured rituals & routines, and mindful emotional check-ins.
- [`docs/AI_ASSISTANT.md`](file:///home/tanmay/Videos/planrova/docs/AI_ASSISTANT.md)  
  Phase 6 Hybrid AI Assistant: Platform-independent domain (`shared/domain/ai/`), provider abstraction (`MockAIProvider` vs `BackendAIProxyProvider`), context minimization, proposal-and-approval workflow, and Daily Intelligence Briefing.

---

### Release Verification & Quality Engineering
- [`docs/RELEASE_AUDIT_PHASE_6.md`](file:///home/tanmay/Videos/planrova/docs/RELEASE_AUDIT_PHASE_6.md)  
  The independent final engineering audit report for Phase 6 (`READY WITH DOCUMENTED LIMITATIONS`).
- [`docs/TEST_MATRIX.md`](file:///home/tanmay/Videos/planrova/docs/TEST_MATRIX.md)  
  The master verification test matrix: 46 test suites, **331 tests passed (100% pass rate)**.


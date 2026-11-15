# Planrova 2.0 — Engineering & Architecture Documentation

Welcome to the canonical documentation for **Planrova 2.0**, an AI-powered, local-first Personal Life Operating System engineered for students, educators, and professionals.

> **Core Philosophy:** *Capture anything once. Organize it intelligently. Manage your entire life from one system.*

---

## 1. Documentation Index

The documentation is organized into clear, authoritative pillars:

### Core System Specifications
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)  
  High-level architecture, hybrid local-first data flow, three-tier state caching (L1/L2/L3), Rollup code-splitting, and cross-platform boundaries (Web, Mobile, Backend Proxy).
- [`docs/PRODUCT.md`](./PRODUCT.md)  
  Product vision, target user personas, core design principles, and comprehensive feature inventory across all 6 domains.
- [`docs/ROADMAP.md`](./ROADMAP.md)  
  Milestones completed and upcoming architectural objectives.
- [`docs/SECURITY.md`](./SECURITY.md)  
  End-to-end security architecture: Firebase Bearer token verification, server-side quotas, Firestore rules, anti-prompt injection, and AI context privacy.

---

### Domain Specifications & Engines
- [`docs/DOMAIN_MODELS.md`](./DOMAIN_MODELS.md)  
  Canonical schemas (Task, CalendarEvent, Habit, Note, Expense, Reminder), entity relationship graph, and the **Universal Quick Capture NLP Engine** (`capture.classifier.js`, `capture.parser.js`).
- [`docs/SCHEDULING_ENGINE.md`](./SCHEDULING_ENGINE.md)  
  The Adaptive Planning Engine: availability materialization, candidate slot scoring, flexible capacity utilization, conflict detection, split-task handling, and proposal freshness hashing.
- [`docs/ACADEMIC_DOMAIN.md`](./ACADEMIC_DOMAIN.md)  
  Academic Intelligence: Semesters, Courses, 2-way hierarchical Syllabus Tree, Weighted Grading with drop-lowest & what-if simulator, SGPA/CGPA calculations, 3-color DFS Assignment DAG critical path, and 5-box Leitner spaced repetition player.
- [`docs/FINANCE_DOMAIN.md`](./FINANCE_DOMAIN.md)  
  Personal Finance: Integer minor-unit accounting, account reconciliation, budget utilization, recurring subscriptions with month-end date clamping & idempotent replay, and savings goal pacing.
- [`docs/WELLBEING_DOMAIN.md`](./WELLBEING_DOMAIN.md)  
  Wellbeing Intelligence: Habit streaks across daily/weekday/weekly cadences, millilitre-level hydration tracking with candidate reminder slots, structured rituals & routines, and mindful emotional check-ins.
- [`docs/AI_ASSISTANT.md`](./AI_ASSISTANT.md)  
  Hybrid AI Assistant: Platform-independent domain (`shared/domain/ai/`), provider abstraction (`MockAIProvider` vs `BackendAIProxyProvider`), context minimization, proposal-and-approval workflow, and Daily Intelligence Briefing.

---

### Deployment & Quality Engineering
- [`docs/ANDROID_RELEASE_READINESS.md`](./ANDROID_RELEASE_READINESS.md)  
  Android release readiness, direct standalone APK download link, EAS build configuration, and technical verification for background native alarms (working while device is locked and app is swiped from recents).
- [`docs/TESTING.md`](./TESTING.md)  
  The master verification test guide: 58 test suites, **475 tests passed (100% pass rate)**, execution instructions, and domain coverage breakdown.

# Planrova 2.0 — Product Specification & Vision

**Document:** `docs/PRODUCT.md`  
**Date:** 2026-11-14  
**Target:** Planrova 2.0 Life Operating System

---

## 1. Product Vision

**Planrova** is an AI-powered, local-first Personal Life Operating System engineered for students, working professionals, and self-directed learners.

Modern productivity is fractured across disconnected single-purpose tools: calendar apps, todo lists, Pomodoro timers, habit trackers, budget spreadsheets, and note-taking systems. This fragmentation introduces cognitive friction, context switching, and abandoned routines.

Planrova unifies these workflows into a cohesive, private, offline-first operating system under one guiding principle:

> **"Capture anything once. Organize it intelligently. Manage your entire life from one system."**

---

## 2. Target Audience & Personas

### 2.1 University & College Students
- **Context:** Managing fluctuating class schedules, assignments, midterm/final exams, syllabus completion, flashcards, hydration, and pocket money.
- **Pain Points:** Missed morning lectures due to easy alarm dismissal; manual friction digitizing paper syllabi; fragmented tools for GPA calculation and exam prep.
- **Key Value:** Native wake-up mission alarms, multimodal timetable/note scanning, 5-box Leitner spaced repetition, credit-weighted GPA target simulations, and zero-latency offline access in lecture halls.

### 2.2 Working Professionals & Self-Directed Learners
- **Context:** Juggling skill acquisition, certification prep, freelance client deliverables, personal budgets, and wellness routines.
- **Pain Points:** Bloated enterprise project tools requiring heavy configuration; cloud-only tools that fail during travel or underground commutes.
- **Key Value:** Rapid natural language capture (English & Hindi), local-first privacy, integrated Pomodoro sessions with soundscapes, adaptive schedule proposals, and privacy-first AI assistance.

---

## 3. Product Principles

1. **Local-First, Always Usable:**
   Every core interaction—reading schedules, creating tasks, logging expenses, taking notes—must complete in less than 16ms against local memory and IndexedDB. Network connectivity is an enhancement for synchronization, never a blocker.
2. **Zero Cognitive Friction:**
   Entering tasks or logging activities must require minimal clicks. Universal Quick Capture translates intent into organized schedule items automatically.
3. **Gamified Consistency, Not Guilt:**
   Progress is driven by positive momentum loops (XP, leveling, Focus Coins, garden growth, and daily grades) rather than punitive streaks that discourage users after a single missed day.
4. **Absolute User Privacy & Data Ownership:**
   Personal notes, financial logs, and study schedules belong exclusively to the user. Cloud storage is partitioned per user with strict cryptographic and rule-based authorization. AI keys remain isolated on the server.
5. **Cross-Platform Continuity:**
   Seamless interoperability between desktop web (for deep planning, review, and library management) and Android mobile (for on-the-go quick capture, exact hardware alarms, and sensor-based wake-up challenges).

---

## 4. Comprehensive Feature Inventory Across Domains

### 4.1 Tasks, Calendar & Daily Planning
- **Intelligent Weekly Grid:** Two-column weekly layout (Mon/Wed/Fri vs Tue/Thu/Sat/Sun) with ruled lines, drag-and-drop ordering, and time sorting.
- **Monthly Calendar View:** Full month date grid with deadline indicators and instant day detail panel.
- **Notes & Markdown Editor:** Block slash-commands (`/h1`, `/ul`, `/code`, `/divider`), inline formatting toolbar, and pinned note previews.
- **Pomodoro Focus & Virtual Forest:** 25/5 intervals, ambient audio scenes (lofi, rain, sitar, cafe), tree growth visualizer, and focus stats.

### 4.2 Universal Quick Capture System
- Single-tap floating capture button on every screen + global `Ctrl+Q` keyboard shortcut on Web + center primary action tab on Mobile.
- Zero-latency natural language parser in pure JavaScript (<5ms).
- English and Hindi / Hinglish keyword support (`kal`, `parso`, `subah`, `shaam`, `₹`, `spent`, `deadline`).
- Rule-based intent classifier with live confidence scoring and manual override pills.

### 4.3 Phase 3: Adaptive Planning Engine
- **Availability Engine:** Materializes fixed commitments (lectures, timetable recurring entries, calendar events, reserved breaks) across the planning horizon.
- **Candidate Slot Suitability Scoring:** Multi-factor heuristic scoring (preferred focus match, contiguity, buffer proximity, earliness, fragmentation penalty).
- **Flexible Capacity Utilization:** Measures workload against true flexible capacity ($\text{Available Minutes} - \text{Fixed} - \text{Breaks}$).
- **Split-Task Persistence:** Decomposes long tasks into sequential schedule blocks across days.
- **Snapshot Freshness & Hashing:** Verifies input state freshness before proposal acceptance.

### 4.4 Phase 4: Academic & Course Intelligence
- **Course Workspaces:** Manage active semesters, enrolled courses, credits, and syllabus topics.
- **Two-Way Hierarchical Syllabus Tree:** Automatic completion cascading between parent modules and subtopics.
- **Weighted Grading Engine:** Precision gradebook calculations with drop-lowest policy and what-if assessment target simulators.
- **GPA Calculator & Multi-Semester Target Simulator:** Credit-weighted SGPA and CGPA projections across US 4.0, 10-Point, and Percentage scales.
- **Assignment Dependency DAG:** 3-color DFS cycle detection, Kahn's topological sort, and critical path analysis for term deliverables.
- **Intelligent Spaced Repetition (Leitner 5-Box):** Deterministic review intervals (1, 2, 4, 7, 14 days) linked directly to course flashcard decks.

### 4.5 Phase 5: Personal Finance Intelligence
- **Authoritative Integer Minor Units:** All monetary values stored as integers (e.g. Paise or Cents) to eliminate floating-point arithmetic drift.
- **Account Balance Reconciliation:** Dynamic reconciliation of cash, bank, and digital wallet pools from opening balances and transactions.
- **Budget Intelligence:** Spending category utilization, warning thresholds, and end-of-month velocity projections.
- **Recurring Subscriptions:** Calendar-clamped recurrence rules, idempotent replay execution, and ledger reconciliation.
- **Savings Goals:** Target pacing, required monthly/weekly contribution calculations, and feasibility analysis.

### 4.6 Phase 5: Personal Wellbeing Intelligence
- **Habit Streak Engine:** Schedule-aware streaks supporting daily, weekdays-only, weekly, and custom day frequencies without false penalties.
- **Millilitre Hydration Tracking:** Visual progress ring, beverage logging (water, coffee, tea, juice), and non-spam reminder candidate slots.
- **Rituals & Routine Engine:** Ordered multi-step routines (Morning Momentum, Evening Wind Down, Study Prep) with duration rollups.
- **Mindful Check-Ins:** Private daily reflections (energy 1-5, mood, notes) without clinical claims.

### 4.7 Phase 6: Privacy-First Hybrid AI Assistant
- **Opt-In Privacy Model:** AI disabled by default; granular category toggles (Tasks, Schedule, Academic, Notes, Finance, Habits, Wellbeing, Preferences).
- **Strict Data Minimization:** Context engine strips account numbers, transaction amounts, and emotional reflection notes.
- **Anti-Prompt-Injection Scanner:** Heuristic detection and client-side rejection of override attempts.
- **Proposal-and-Approval Workflow:** AI cannot directly mutate state; actionable suggestions emit `AIActionProposal` cards requiring user approval.
- **Daily Intelligence Briefing:** Automated daily overview summarizing authorized deadlines, schedule blocks, and habits.
- **Provider Abstraction:** Offline deterministic `MockAIProvider` with seamless fallback from authenticated server proxy (`BackendAIProxyProvider`).

### 4.8 Mobile Companion & Hardware Missions
- **Android Native Alarms:** Unkillable exact alarms scheduled via `AlarmManager.setExactAndAllowWhileIdle` and foreground services.
- **Sensor Dismiss Missions:** Accelerometer step counting, math problems, shake detection, and typing tests to force cognitive wake-up.
- **Multimodal Vision OCR:** Camera scanning of physical timetables, syllabi, and whiteboard notes routed via secure proxy to Groq Vision LLM.

# Planrova 2.0 — Product Specification & Vision

## 1. Product Vision

**Planrova** is an AI-powered Personal Life Operating System engineered for students, working professionals, and self-directed learners. 

Modern productivity is fractured across disconnected single-purpose tools: calendar apps, todo lists, Pomodoro timers, habit apps, budget spreadsheets, and note-taking systems. This fragmentation introduces high context-switching friction, cognitive fatigue, and abandoned routines.

Planrova resolves this by uniting structured daily planning, habits, focus rituals, personal finance, academic timetables, and note capture into a single, cohesive, local-first operating system. Powered by hybrid on-device and cloud AI, Planrova automates routine scheduling and transcription while gamifying daily momentum through an evolving vitality core.

---

## 2. Target Audience

### Primary: University and College Students
- **Context:** Managing fluctuating class schedules, assignment deadlines, exam preparation, hydration, and pocket money.
- **Pain Points:** Missed morning lectures due to easy alarm dismissal; manual friction digitizing paper syllabi and whiteboard notes; inconsistent study habits.
- **Key Value:** Native wake-up mission alarms, multimodal timetable/note scanning, habit tracking with campus-friendly cues, and zero-latency offline access.

### Secondary: Self-Directed Learners & Early Professionals
- **Context:** Juggling skill acquisition, certification prep, freelance deadlines, and wellness routines.
- **Pain Points:** Bloated project management tools requiring heavy setup; cloud-only tools failing during travel or commutes.
- **Key Value:** Rapid natural language capture (English & Hindi), local-first privacy, integrated Pomodoro sessions with soundscapes, and clear progress analytics.

---

## 3. Product Principles

1. **Local-First, Always Usable:**
   Every core interaction—reading schedules, creating tasks, logging expenses, taking notes—must complete in less than 16ms against local memory and IndexedDB. Network connectivity is an enhancement for synchronization, never a blocker.

2. **Zero Cognitive Friction:**
   Entering tasks or logging activities must require minimal clicks. Multimodal capture (voice, camera OCR, natural language text) translates intent into organized schedule items automatically.

3. **Gamified Consistency, Not Guilt:**
   Progress is driven by positive momentum loops (XP, leveling, Focus Coins, garden growth, and daily grades) rather than punitive streaks that discourage users after a single missed day.

4. **Absolute User Privacy & Data Ownership:**
   Personal notes, financial logs, and study schedules belong exclusively to the user. Cloud storage is partitioned per user with strict cryptographic and rule-based authorization. AI keys remain isolated on the server.

5. **Cross-Platform Continuity:**
   Seamless interoperability between desktop web (for deep planning, review, and library management) and Android mobile (for on-the-go quick capture, exact hardware alarms, and sensor-based wake-up challenges).

---

## 4. Existing Features Inventory (Phase 1 Baseline)

- **Intelligent Weekly Grid:** Two-column weekly layout (Mon/Wed/Fri vs Tue/Thu/Sat/Sun) with ruled lines, drag-and-drop ordering, and time sorting.
- **Monthly Calendar View:** Full month date grid with deadline indicators and instant day detail panel.
- **Habit Tracker & Heatmap:** Daily checkboxes, fire/streak counters, visual completion heatmaps, and automatic daily habit-to-task injection.
- **Pomodoro Focus & Virtual Forest:** 25/5 Pomodoro intervals, ambient audio scenes (lofi, rain, sitar, cafe), tree growth visualizer, and focus stats.
- **Hydration Tracker:** Visual wellness ring, hourly interval reminders, coffee diuretic deduction, and weekly beverage chart.
- **Student Budget Tracker:** Monthly fund limit, integer minor unit expense sums, spending category distribution, and end-of-month recommendations.
- **Notes & Markdown Editor:** Notion-inspired block slash-commands (`/h1`, `/ul`, `/code`, `/divider`), inline formatting toolbar, and pinned note previews.
- **Brain Dump & Quick Capture:** Unstructured thought inbox with one-click NLP task conversion.
- **Natural Language Parsing:** English and Hindi keywords (`kal`, `parso`, `subah`, `shaam`), relative dates (`tomorrow`, `in 3 hours`), and multi-task splitting (`and`, `then`).
- **Focus Store & Gamification:** Focus Coins earned from tasks/habits, unlocking virtual tree seeds (oak, sakura, maple, pine, palm), level progression, and Focus Core stages.
- **Android Native Missions:** Exact alarm scheduling (`AlarmManager.setExactAndAllowWhileIdle`), ForegroundService ringing, and sensor-based dismiss challenges (math, steps, typing, shake).
- **Multimodal Vision OCR Proxy:** Server-side proxy routing timetable and whiteboard photos through Groq Vision API to structured Markdown without exposing API keys.

---

## 5. Future Product Direction (Planrova 2.0 Roadmap)

- **Phase 2 (Unified Domain & Capture):** Universal quick-capture tray, unified entity relationship graph, and shared mobile/web schema validation.
- **Phase 3 (Adaptive Planning):** AI auto-scheduling, cognitive workload balancing, and dynamic timetable conflict resolution.
- **Phase 4 (Academic Workspaces):** Multi-course syllabus tracking, GPA calculators, assignment dependency trees, and flashcard active recall.
- **Phase 5 (Finance & Wellbeing):** Multi-account budgeting, recurring subscriptions, sleep hygiene tracking, and stress metrics.
- **Phase 6 (Hybrid AI Assistance):** On-device small language models for offline parsing and cloud LLMs for synthesis and weekly academic reviews.


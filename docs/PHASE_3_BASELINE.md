# Planrova 2.0 — Phase 3 Baseline & Architectural Reconnaissance

**Date:** November 14, 2026  
**Phase:** 3 — Adaptive Planning Engine  
**Author:** Principal Software Architect & Scheduling Algorithm Engineer  
**Repository:** [github.com/tanmay-devx/planrova](https://github.com/tanmay-devx/planrova)  

---

## 1. Baseline System Health

### 1.1 Automated Test Suite
- **Framework:** Vitest v5.1.0 with jsdom environment
- **Status:** **PASS** (15 / 15 test suites passed, 85 / 85 tests passed, 0 failures, 0 skipped)
- **Duration:** 456ms
- **Test Files Passing:**
  - `tests/domain.test.js` (10 tests)
  - `tests/relationships.test.js` (4 tests)
  - `tests/habitMigration.test.js` (6 tests)
  - `tests/capture.test.js` (13 tests)
  - `tests/accountIsolation.test.js` (4 tests)
  - `tests/syncEngine.test.js` (6 tests)
  - `tests/validation.test.js` (12 tests)
  - `tests/date.test.js` (7 tests)
  - `tests/logger.test.js` (2 tests)
  - `tests/pwa.test.js` (3 tests)
  - `tests/migrations.test.js` (3 tests)
  - `tests/nlp.test.js` (8 tests)
  - `tests/proxy.test.js` (3 tests)
  - `tests/habitsSync.test.js` (2 tests)
  - `tests/budget.test.js` (2 tests)

### 1.2 Production Web Build
- **Tool:** Vite v8.0.13 / Rolldown
- **Status:** **PASS** (Build succeeded in 275ms)
- **Bundle Artifacts:**
  - `dist/index.html`: 123.03 kB
  - `dist/assets/index-BpleEUWF.css`: 81.48 kB
  - `dist/assets/index-Bn4TypZq.js`: 741.80 kB
- **Existing Build Warnings:**
  - `[INEFFECTIVE_DYNAMIC_IMPORT]` on shared singletons (`database.js`, `storage.js`, `firebase/auth`).
  - Chunk size warning (>500 kB uncompressed due to Firebase SDK and Lucide/SVG assets).

### 1.3 Git Status
- **Branch:** `master`
- **Working Tree:** Clean (all Phase 2 changes committed and pushed to origin/master).

---

## 2. Audit of Existing Temporal & Scheduling Constructs

| Entity / Module | Relevant Fields | Current Scheduling Semantics | Limitations / Gaps |
| :--- | :--- | :--- | :--- |
| **Task** ([task.schema.js](file:///home/tanmay/Videos/planrova/shared/domain/entities/task.schema.js)) | `id`, `title`, `description`, `status`, `completed`, `priority`, `category`, `dueDate` / `date`, `startTime`, `endTime`, `estimatedMinutes`, `linkedNoteIds` | Tasks have optional `startTime`/`endTime` and `estimatedMinutes`. If unscheduled, `startTime` is `""`. | No concept of locked blocks; no earliest start constraint; no flag for splittable sessions; no validation against calendar overlaps. |
| **Calendar Event** ([calendar-event.schema.js](file:///home/tanmay/Videos/planrova/shared/domain/entities/calendar-event.schema.js)) | `id`, `title`, `description`, `date`, `startTime`, `endTime`, `allDay`, `category`, `location` | Non-flexible events (exams, meetings, lectures). Rendered in monthly view. | Independent of daily ruled timetable grid; no conflict detection when task overlaps calendar event. |
| **Timetable (College/Recurring)** (`timetable` in Dexie/Firestore) | `{ Monday: [], Tuesday: [], ... }` containing `{ subject, startTime, endTime, room }` | Recurring weekly college class schedule. | Rendered primarily in mobile `ScheduleScreen.js`; not factored into daily available time on Web. |
| **Reminders / Alarms** ([reminder.schema.js](file:///home/tanmay/Videos/planrova/shared/domain/entities/reminder.schema.js)) | `id`, `title`, `triggerTime`, `targetEntityId`, `targetEntityType`, `triggered` | Point-in-time notification triggers. | Notification triggers only; does not reserve schedule blocks or calculate preparation buffers. |
| **Date Utilities** ([date.js](file:///home/tanmay/Videos/planrova/src/utils/date.js)) | `parseLocalDate`, `formatDate`, `formatTime`, `getStartOfWeek`, `getWeekDays` | Timezone-safe local date parsing avoiding UTC midnight shifts. | Lacks time interval math (slot intersection, gap finding, minute duration conversion, overlap checks). |
| **Storage & Sync** ([storage.js](file:///home/tanmay/Videos/planrova/src/utils/storage.js), [syncEngine.js](file:///home/tanmay/Videos/planrova/src/db/syncEngine.js)) | `kv_store` in Dexie, user-scoped records `user_id:key`, background sync to Firestore | Local-first, in-memory synchronous cache with asynchronous IndexedDB and Cloud Firestore persistence. | Needs a new collection/key for `scheduling_proposals` and `user_availability` respecting user scoping and sync tombstones. |

---

## 3. Core Architectural Gaps Identified

1. **No User Availability Model:** System assumes the user is theoretically available 24 hours a day or relies on an implicit "All Day" flag.
2. **No Conflict Detection:** Users can place 3 tasks at 10:00 AM without warning. Fixed lectures and exams do not prevent overlapping task placement.
3. **No Realistic Workload Metric:** Users lack visibility into whether a day contains 3 hours or 14 hours of work.
4. **No Deterministic Scheduling Algorithm:** The application relies on 100% manual placement via edit modal or drag-and-drop.
5. **No Preparation or Buffer Logic:** No automated buffer recommendation before major exams or deadlines.
6. **No Proposal-Based Adaptive Rescheduling:** When a user misses a task or falls behind, there is no system to generate an alternative proposal with user approval.

---

## 4. Phase 3 Proposed Architecture Blueprint

To ensure complete platform independence (Web Vanilla JS, Mobile React Native, and potential Headless CLI/CI), the planning engine will reside entirely in `shared/domain/scheduling/`:

```
shared/domain/scheduling/
├── scheduling.types.js        # Enumerations, constants, weights, thresholds
├── scheduling.utils.js        # Pure time arithmetic (minutes <-> HH:MM, intervals, overlaps)
├── scheduling.validation.js   # Availability, Block, and Proposal schema validators
├── availability.engine.js     # Availability slot generator (subtracts fixed commitments & breaks)
├── conflict.engine.js         # Hard & soft conflict detector (overlaps, deadlines, overload)
├── scheduling.scoring.js      # Deterministic slot scoring formula (urgency, priority, buffers)
├── scheduling.engine.js       # Core algorithm (fixed-first, candidate scoring, slot allocation)
├── workload.engine.js         # Capacity & fatigue model (Light, Balanced, Heavy, Overloaded)
├── buffer.engine.js           # Smart prep & transition buffer generator
├── rescheduling.engine.js     # Proposal generation for missed tasks and changed commitments
└── index.js                   # Unified export
```

### Key Design Invariants:
1. **Zero External Heavy Dependencies:** No Moment.js, no Chrono, no LLM API calls for scheduling. Pure, deterministic JavaScript running in $<10\text{ ms}$.
2. **Separation of Proposal from Confirmed Schedule:** Generated plans are stored as **Draft Proposals** until explicitly accepted by the user.
3. **Fixed Commitment Immutability:** Fixed commitments (lectures, exams, appointments) and user-locked blocks can **never** be moved automatically.
4. **Offline-First & User-Scoped:** Proposals and availability settings are stored in local storage and Dexie under active `user_id`, synchronizing cleanly with Firestore.


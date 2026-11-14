# Planrova 2.0 — Phase 2 Baseline Inspection & Architecture Report

**Inspection Date:** 2026-11-14  
**Auditor / Role:** Senior Staff Software Engineer, Product Architect & Full-Stack Engineer  
**Repository State:** `master` (Clean working tree, commit: post-Phase 1.1 hardening)  
**Baseline Test Status:** 11 test suites passing (52/52 tests)  
**Baseline Production Build Status:** Vite 8.0.13 production build successful (378ms)  

---

## 1. Existing Architecture Overview

Planrova is a hybrid local-first personal life operating system comprising:
1. **Web Client:** Vanilla JavaScript (ES6 modules), Vite build pipeline, Dexie.js (IndexedDB v2 with user scoping), Service Worker PWA (`public/sw.js`), Firebase Authentication, and Cloud Firestore.
2. **Mobile Client:** React Native on Expo SDK 54, Firebase Authentication, Cloud Firestore (via `useFirestoreData` hook), and native Kotlin Android modules (`AlarmModule.kt`, `AlarmScheduler.kt`, `BootReceiver.kt`, `AlarmService.kt`).
3. **Backend Proxy:** Lightweight Node.js vision OCR proxy (`server/proxy.js`) forwarding multimodal requests to Groq Vision API while strictly protecting credentials, enforcing 15MB request caps, and applying 20 req/min sliding-window IP rate limiting.

### 1.1 Data Persistence & Tenant Isolation
- **IndexedDB (`PlanoryLocalDB`, v2):**
  - Table: `kv_store: 'id, sync_status, updated_at, user_id, retry_count, key'`
  - Primary Key: Scoped format `${userId}:${itemKey}` (e.g. `usr_123:tasks`).
  - Account switching is isolated via `clearMemoryCache()`, `setCurrentUserId()`, and user-scoped sync queries.
- **Firestore Document Model:**
  - Tenant path: `/users/{userId}/appData/{key}`
  - Synchronized collection keys: `tasks`, `notes`, `user_habits`, `habit_logs`, `budget` / `expenses`, `hydration_logs`, `gamification`, `brain_dump`.
  - Social / Collaborative: `/users_directory/{userId}`, `/studypool_rooms/{roomId}`, `/studypool_users/{userId}`.

---

## 2. Existing Entity Inventory & Data Flow

| Entity Key | Schema Format (Web) | Schema Format (Mobile) | Read/Write Locations | Discrepancies & Risks |
| :--- | :--- | :--- | :--- | :--- |
| **`tasks`** | Array of `{ id, title, desc, date, startTime, endTime, category, priority, completed }` | Array of `{ id, title, desc, date, startTime, endTime, category, priority, completed, time }` | Web: `tasks.js`, `monthly-cal.js`, `brain-dump.js`, `notes.js`. Mobile: `DashboardScreen.js`, `ScheduleScreen.js`, `TabNavigator.js`. | Missing canonical schema; status values are boolean `completed` instead of stateful enum (`todo`, `in_progress`, `completed`, `cancelled`). |
| **`notes`** | Array of `{ id, date, title, content, text, subject, pinned, color, attachments, linkedTasks }` | Array of `{ id, subject, title, text, date }` | Web: `notes.js`, `command-palette.js`. Mobile: `NotesScreen.js`, `TabNavigator.js`. | Web indexes by `date` while mobile uses `id`; mobile lacks rich content and attachment arrays. Web has early `@mention` linked task markers. |
| **`user_habits`** | Array of `{ id, name, streak, fire, logs }` + separate `habit_logs: { [id]: [] }` | Array of `{ id, name, fire, logs: [] }` | Web: `habits.js`, `tasks.js`. Mobile: `HabitsScreen.js`, `DashboardScreen.js`, `HomeScreen.js`. | Phase 1.1 provided transitional compatibility (`streak ?? fire`). Phase 2 requires full migration to canonical schema where `completionDates` is the single source of truth. |
| **`expenses` / `budget`** | Web stores in `budget`: array of minor-unit expenses `{ id, desc, amount, category, date }` + budget limits | Mobile stores in `expenses`: array of `{ id, amount, desc, category, date }` | Web: `budget.js`, `nlp.js`. Mobile: `BudgetScreen.js`, `TabNavigator.js`. | Storage key naming difference (`budget` on web holds `{ expenses: [...] }` vs mobile `expenses` array). Requires unified adapter. |
| **`brain_dump`** | Array of raw strings or `{ id, text, date }` | Array of `{ id, text, date }` | Web: `brain-dump.js`. Mobile: `CaptureScreen.js`. | Unstructured capture buffer; lacks entity classification. |
| **`hydration_logs`**| Array of `{ date, glasses, ml, targetMl }` | Array of `{ date, ml, targetMl }` | Web: `hydration.js`. Mobile: `HydrationScreen.js`. | Minor property naming divergence (`glasses` vs direct `ml`). |

---

## 3. Existing Capture Experience

### 3.1 Web Capture Touchpoints
- **Sidebar Brain Dump:** Textarea in left sidebar (`#brain-dump-input`), saving to `brain_dump` array. Drag-and-drop onto timetable or click "Convert to Task" using `parseNaturalLanguageTask`.
- **Command Palette (`Ctrl+K`):** Search overlay filtering actions, notes, and tasks.
- **Voice Input:** Web SpeechRecognition listening for keywords (`water`, `expense`, `timer`, task) and calling `parseNaturalLanguageTask`.
- **Day Notes Drawer (`Ctrl+N`):** Modal editor for date-based notes with basic `@mention` task links.

### 3.2 Mobile Capture Touchpoints
- **`CaptureScreen.js`:** Single text input writing exclusively to `brain_dump`.
- **Floating Action Button in `TabNavigator.js`:** Opens `QuickAddModal` with manual tabs for Task, Expense, and Note. Lacks natural language parsing or automatic entity classification.

### 3.3 Natural Language Parser (`src/utils/nlp.js`)
- `parseNaturalLanguageTask(text)` splits multi-item inputs on `and`, `then`, `also`, `plus`, `,`.
- Handles relative dates (`today`, `tomorrow`, `tonight`, `next week`, `in X days`).
- Handles Hindi date/time terms (`kal`, `parso`, `subah`, `shaam`, `baje`, `somvar`...`ravivar`).
- Extracts time ranges (`from 5 to 7pm`, `between 2 and 4pm`).
- Extracts water logging (`log 500ml water`) and expenses (`spent 150 rupees on food`).
- **Limitation:** Currently returns `{ action: 'water' | 'expense' | 'timer' }` or a raw task object, without confidence scores, entity classification metadata, or support for Habits, Reminders, Notes, and Calendar events.

---

## 4. Current Test Baseline & Production Build

### Vitest Test Suite Execution:
```
$ npm test

 RUN  v5.1.0 /home/tanmay/Videos/planrova

 ✓ tests/date.test.js (7 tests)
 ✓ tests/budget.test.js (2 tests)
 ✓ tests/validation.test.js (12 tests)
 ✓ tests/logger.test.js (2 tests)
 ✓ tests/pwa.test.js (3 tests)
 ✓ tests/migrations.test.js (3 tests)
 ✓ tests/proxy.test.js (3 tests)
 ✓ tests/nlp.test.js (8 tests)
 ✓ tests/habitsSync.test.js (2 tests)
 ✓ tests/syncEngine.test.js (6 tests)
 ✓ tests/accountIsolation.test.js (4 tests)

 Test Files  11 passed (11)
      Tests  52 passed (52)
   Duration  379ms
```

### Production Build:
```
$ npm run build
vite v8.0.13 building client environment for production...
✓ 79 modules transformed.
dist/index.html                 121.25 kB │ gzip:  22.61 kB
dist/assets/index-DQHFdKIs.css   81.02 kB │ gzip:  14.08 kB
dist/assets/index-Cu6h4u_4.js   709.12 kB │ gzip: 211.65 kB
✓ built in 378ms
```

---

## 5. Identified Architectural Risks

1. **Habit Data Loss Risk:** Transitional dual-writing (`streak` + `fire` + `logs` + `habit_logs`) risks date-ordering corruption or diverging streak counts unless unified into a canonical model where `completionDates` array is the sole source of truth.
2. **Note Identification Collision:** Web notes use `n.date` as primary identifier, while mobile uses `n.id`. Canonical notes must support both unique `id` and associated `date`.
3. **Capture UI Overcomplication:** If capture introduces complex forms or high-latency processing, user adoption drops. Capture must execute synchronously local-first (<50ms).
4. **Note-Task Divergence:** Bi-directional relationships (`note.linkedTaskIds` and `task.linkedNoteIds`) must remain synchronized when either item is deleted or updated offline.

---

## 6. Phase 2 Implementation Roadmap

### Stage 1: Domain Foundation (`shared/domain/`)
- Create canonical schemas and validators for: `Task`, `Note`, `Habit`, `Expense`, `Reminder`, `CalendarEvent`.
- Define normalization, serialization, and status transition rules.
- Add comprehensive domain unit tests in `tests/domain.test.js`.

### Stage 2: Habit Canonical Schema Migration
- Implement canonical habit model with `completionDates: string[]` and deterministic streak calculator.
- Implement migration adapter converting legacy `streak`, `fire`, `logs`, and `habit_logs` without data loss.
- Update `src/modules/habits.js` and mobile habits screen to use canonical representation.
- Add migration unit tests in `tests/habitMigration.test.js`.

### Stage 3: Universal Quick Capture Engine
- Build classifier and entity extractor extending `src/utils/nlp.js` into `shared/domain/capture/`.
- Support 7 entity types: Task, Reminder, Note, Expense, Habit, Calendar Event, Brain Dump fallback.
- Support confidence calculation, edit-before-save, and deterministic local parsing.
- Add unit tests in `tests/capture.test.js`.

### Stage 4: Universal Quick Capture Interfaces
- Web: Floating capture button, keyboard shortcut (`Ctrl+Q`), dashboard quick-input bar, and Brain Dump integration.
- Mobile: Universal Quick Capture modal in `mobile/src/navigation/TabNavigator.js` and `mobile/src/screens/CaptureScreen.js`.

### Stage 5: Note-Task Relationship System
- Implement bidirectional link contract (`entity-links.js`).
- Add task creation from notes, task referencing in notes, and safe deletion cascades.
- Add relationship tests in `tests/relationships.test.js`.

### Stage 6: Security Hardening, Verification & Documentation
- Patch outstanding Firestore room ownership and message authorship rules.
- Run complete test suite and production build.
- Author all required Phase 2 documentation.


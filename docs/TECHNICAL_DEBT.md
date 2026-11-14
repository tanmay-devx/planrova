# Planrova 2.0 — Technical Debt Log & Risk Register

This document tracks identified architectural issues, code smells, performance bottlenecks, and reliability risks across the Planrova ecosystem.

---

## 1. High-Priority Technical Debt

### TD-001: Monolithic Screen and Module Files
- **Severity:** High
- **Impact:** `mobile/src/screens/AlarmScreen.js` is 3,539 lines long, containing alarms, sleep tracking, mission challenges, and audio player bindings in a single file. Similarly, `src/modules/notes.js` is over 800 lines. This impairs maintainability, testability, and code review velocity.
- **Proposed Solution:** Refactor screens into sub-components and custom hooks:
  - Extract mission challenges into `components/missions/{MathMission, StepMission, TypingMission}.js`.
  - Extract audio playback into `hooks/useAlarmAudio.js`.
  - Extract sleep tracking into `screens/SleepTrackerTab.js`.
- **Dependencies:** React Native, Expo Audio
- **Estimated Effort:** 3–4 engineer-days
- **Scheduled Phase:** Phase 3 / Phase 4

---

## 2. Medium-Priority Technical Debt

### TD-002: Ineffective Dynamic Imports in Vite Web Build
- **Severity:** Medium
- **Impact:** Modules like `database.js`, `storage.js`, and `firebase/auth` are dynamically imported in some modules while statically imported in `main.js`, resulting in `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings during Vite compilation and preventing chunk code-splitting.
- **Proposed Solution:** Standardize on static imports for shared singleton services (`database.js`, `storage.js`) and reserve dynamic `import()` exclusively for lazy-loaded route views (`studypool.js`, `monthly-cal.js`).
- **Dependencies:** Vite configuration
- **Estimated Effort:** 1 engineer-day
- **Scheduled Phase:** Phase 3

### TD-004: Lack of Android SDK in Headless CI/Local Development
- **Severity:** Medium
- **Impact:** `expo run:android` and native Gradle compilation cannot execute on machines without the Android SDK, emulator, and `ANDROID_HOME` configured.
- **Proposed Solution:** Implement GitHub Actions workflow with Android SDK setup (`android-actions/setup-android`) and automated EAS Build triggers for Android artifact generation.
- **Dependencies:** GitHub Actions, EAS CLI
- **Estimated Effort:** 1.5 engineer-days
- **Scheduled Phase:** Phase 3 / Phase 7

### TD-005: Server SQLite DB Prototype Leftover
- **Severity:** Low
- **Impact:** `server/index.js` and `server/db.js` use `better-sqlite3` and `express`, while production deployments on Render use `server/proxy.js`. These leftover files cause confusion regarding the true backend architecture.
- **Proposed Solution:** Archive or document `server/index.js` and `server/db.js` as an experimental offline server prototype, or remove them from the active proxy folder.
- **Dependencies:** None
- **Estimated Effort:** 0.5 engineer-day
- **Scheduled Phase:** Phase 3

### TD-006: Hardcoded Firebase Config in Source Code
- **Severity:** Medium
- **Impact:** Firebase Web SDK configuration (`apiKey`, `projectId`) is committed in `src/db/firebase.js` and `mobile/src/firebase.js`. While Firebase client keys are inherently public and protected by Firestore Security Rules, best practice requires extracting them into environment variables (`VITE_FIREBASE_*` and `EXPO_PUBLIC_FIREBASE_*`).
- **Proposed Solution:** Migrate configuration values to `.env` files with fallback to existing values.
- **Dependencies:** Vite env, Expo env
- **Estimated Effort:** 1 engineer-day
- **Scheduled Phase:** Phase 3

---

## 3. Debt Resolved in Phase 3

| Debt ID | Title | Resolution |
| :--- | :--- | :--- |
| **RESOLVED-P3-01** | Split-Task Competing Sources of Truth | Established canonical `Task` entity as sole owner of `scheduledSessions` array with dual-writing to `startTime`/`endTime` for backward compatibility. |
| **RESOLVED-P3-02** | Stale Schedule Proposals Acceptance | Implemented deep multi-entity `validateProposalFreshness` validating tasks, calendar events, locked blocks, and availability immediately prior to write. |
| **RESOLVED-P3-03** | Ambiguous Workload Utilization Formula | Established mathematically sound flexible capacity formula: $\max(0, \text{Total Working} - \text{Fixed} - \text{Breaks})$ with non-overlapping classification thresholds. |
| **RESOLVED-P3-04** | Chronologically Incomparable Deadlines | Formulated multi-day chronological minute scale `(dayDelta * 1440) + deadlineMinutes` with date-only deadlines resolving to working day end. |
| **RESOLVED-P3-05** | Cross-Midnight Interval Truncation | Implemented `splitCrossMidnightInterval` to partition events spanning midnight into distinct per-date intervals. |
| **RESOLVED-P3-06** | Retroactive Past Task Allocation | Enforced elapsed time locking in adaptive rescheduling, ensuring future tasks cannot be placed in the past. |

---

## 4. Debt Resolved in Phase 2

| Debt ID | Title | Resolution |
| :--- | :--- | :--- |
| **RESOLVED-P2-01** | Schema Mismatch in Habit Logging (Web vs Mobile) | Unified on canonical `completionDates` with deterministic streak algorithm, dual-writing `streak`, `fire`, and `logs` for backwards compatibility. |
| **RESOLVED-P2-02** | Lack of Bidirectional Note-Task Integrity | Implemented `shared/domain/relationships/entity-links.js` with symmetric linking (`linkedTaskIds` & `linkedNoteIds`) and soft-deletion cascade protection. |
| **RESOLVED-P2-03** | Fragmented Quick Capture Experiences | Built Universal Quick Capture engine (<5ms local-first classifier + temporal parser) with Web modal/FAB/shortcut and Mobile `QuickCaptureModal`. |
| **RESOLVED-P2-04** | Firestore Study Room Privilege Escalation | Hardened `firestore.rules` to prevent non-hosts from altering room ownership (`createdBy`, `hostId`) and forbid altering message `uid` during updates. |
| **RESOLVED-P2-05** | Lack of Shared Canonical Domain Contracts | Created `shared/domain/` entity schemas and normalizers (`Task`, `Note`, `Habit`, `Expense`, `Reminder`, `CalendarEvent`) with 100% test coverage. |

---

## 4. Debt Resolved in Phase 1 (Reference)

| Debt ID | Title | Resolution |
| :--- | :--- | :--- |
| **RESOLVED-01** | Account switching cross-contamination in Dexie | Scoped IndexedDB records by `user_id` and cleared memory cache on logout. |
| **RESOLVED-02** | Deletion resurrection during conflict resolution | Implemented soft-deletion tombstones in collection merges. |
| **RESOLVED-03** | PWA Service Worker 404 crash on install | Fixed asset manifest in `sw.js` to reference valid static assets. |
| **RESOLVED-04** | Floating-point imprecision in budget calculations | Introduced integer minor units (`paise`/`cents`) for all monetary math. |
| **RESOLVED-05** | Timezone date offset when parsing YYYY-MM-DD | Created `parseLocalDate` in `date.js` avoiding UTC midnight shifts. |
| **RESOLVED-06** | Notes lookup type error in tasks column | Resolved object vs array mismatch in `renderGrid()` note previews. |
| **RESOLVED-07** | Lack of test infrastructure | Introduced Vitest test runner with 43 automated unit and integration tests. |
| **RESOLVED-08** | Unused dependencies and security vulnerabilities | Removed unused `puppeteer` and `@dnd-kit/*` packages, clearing high/critical vulnerabilities. |
| **RESOLVED-09** | Missing Firestore Security Rules | Created strict `firestore.rules` and `firebase.json` enforcing per-user isolation. |
| **RESOLVED-10** | Unprotected OCR Proxy Endpoints | Added in-memory sliding window rate limiting and payload validation to `proxy.js`. |

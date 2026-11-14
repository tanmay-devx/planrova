# Planrova 2.0 — Technical Debt Log & Risk Register

This document tracks identified architectural issues, code smells, performance bottlenecks, and reliability risks across the Planrova ecosystem.

---

## 1. High-Priority Technical Debt

### TD-001: Monolithic Screen and Module Files
- **Severity:** High
- **Impact:** `mobile/src/screens/AlarmScreen.js` is 3,539 lines long, containing alarms, sleep tracking, mission challenges, and audio player bindings in a single file. Similarly, `src/modules/notes.js` is over 1,000 lines. This severely impairs maintainability, testability, and code review velocity.
- **Proposed Solution:** Refactor screens into sub-components and custom hooks:
  - Extract mission challenges into `components/missions/{MathMission, StepMission, TypingMission}.js`.
  - Extract audio playback into `hooks/useAlarmAudio.js`.
  - Extract sleep tracking into `screens/SleepTrackerTab.js`.
- **Dependencies:** React Native, Expo Audio
- **Estimated Effort:** 3–4 engineer-days

### TD-002: Ineffective Dynamic Imports in Vite Web Build
- **Severity:** Medium
- **Impact:** Modules like `database.js`, `storage.js`, and `firebase/auth` are dynamically imported in some modules while statically imported in `main.js`, resulting in `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings during Vite compilation and preventing chunk code-splitting.
- **Proposed Solution:** Standardize on static imports for shared singleton services (`database.js`, `storage.js`) and reserve dynamic `import()` exclusively for lazy-loaded route views (`studypool.js`, `monthly-cal.js`).
- **Dependencies:** Vite configuration
- **Estimated Effort:** 1 engineer-day

### TD-003: Schema Mismatch in Habit Logging (Web vs Mobile)
- **Severity:** High
- **Impact:** Web planner tracks habit completion in a separate `habit_logs` key with `streak` counter, whereas the mobile React Native client tracks completion inside each habit object (`habit.logs = []`) with `fire` counter. This causes inconsistent sync representations.
- **Proposed Solution:** Unify habit representation across both platforms in Phase 2 using the schema established in `src/db/validation.js` (`streak`, `icon`, `logs[]`).
- **Dependencies:** Mobile `HabitsScreen.js`, Web `habits.js`
- **Estimated Effort:** 2 engineer-days

---

## 2. Medium-Priority Technical Debt

### TD-004: Lack of Android SDK in Headless CI/Local Development
- **Severity:** Medium
- **Impact:** `expo run:android` and native Gradle compilation cannot execute on machines without the Android SDK, emulator, and `ANDROID_HOME` configured.
- **Proposed Solution:** Implement GitHub Actions workflow with Android SDK setup (`android-actions/setup-android`) and automated EAS Build triggers for Android artifact generation.
- **Dependencies:** GitHub Actions, EAS CLI
- **Estimated Effort:** 1.5 engineer-days

### TD-005: Server SQLite DB Prototype Leftover
- **Severity:** Low
- **Impact:** `server/index.js` and `server/db.js` use `better-sqlite3` and `express`, while production deployments on Render use `server/proxy.js`. These leftover files cause confusion regarding the true backend architecture.
- **Proposed Solution:** Archive or document `server/index.js` and `server/db.js` as an experimental offline server prototype, or remove them from the active proxy folder.
- **Dependencies:** None
- **Estimated Effort:** 0.5 engineer-day

### TD-006: Hardcoded Firebase Config in Source Code
- **Severity:** Medium
- **Impact:** Firebase Web SDK configuration (`apiKey`, `projectId`) is committed in `src/db/firebase.js` and `mobile/src/firebase.js`. While Firebase client keys are inherently public and protected by Firestore Security Rules, best practice requires extracting them into environment variables (`VITE_FIREBASE_*` and `EXPO_PUBLIC_FIREBASE_*`).
- **Proposed Solution:** Migrate configuration values to `.env` files with fallback to existing values.
- **Dependencies:** Vite env, Expo env
- **Estimated Effort:** 1 engineer-day

---

## 3. Debt Resolved in Phase 1 (Reference)

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


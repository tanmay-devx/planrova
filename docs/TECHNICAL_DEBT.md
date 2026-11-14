# Planrova 2.0 — Technical Debt & Architecture Audit Log

## 1. Overview
As part of our commitment to transparent and zero-technical-debt engineering, this document logs all identified constraints, trade-offs, and future refactoring targets arising from the Phase 4 implementation and audit.

---

## 2. Identified Items & Mitigations

### 2.1 Bundler Chunk Warnings & Dynamic Imports
- **Issue**: Vite emits warnings during production build:
  1. `dist/assets/index-*.js` exceeds 500 kB (~813 kB raw, ~242 kB gzipped) due to Firebase v12 SDK, date utilities, and vendor libraries.
  2. `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings for modules (e.g. `src/db/database.js`, `src/utils/storage.js`, `src/modules/tasks.js`) that are imported statically in `main.js` as well as dynamically in individual modules.
- **Current State**: Application builds cleanly and rapidly (~370ms) without runtime issues. `academic.ui.js` is successfully code-split into its own 40.7 kB chunk.
- **Future Action**: In Phase 5, consolidate module entry points and implement granular rollup manual chunks for Firebase sub-libraries (`@firebase/auth`, `@firebase/firestore`).

### 2.2 Cross-Platform UX Parity
- **Observation**:
  - *Web Platform*: Implements 100% of Academic capabilities including interactive 3D Leitner flip card study player with keyboard bindings (`Space`, `1-4`), full syllabus tree node completion toggles, and modal What-If GPA Target Simulator.
  - *Mobile Platform*: Implements core dashboard metrics, current SGPA display, upcoming exam countdowns, syllabus progress bars, and course creation in `AcademicScreen.js`.
- **Mitigation & Future Action**: The interactive 3D flashcard card-flip animations and multi-semester what-if target sliders will be ported to native React Native Reanimated components during Phase 5.

### 2.3 DAG Assignment Critical Path Complexity
- **Issue**: `computeCriticalPath` computes longest path using dynamic programming on DAG topological order. This is $O(V + E)$ and runs in sub-millisecond time for standard student courses ($<50$ assignments).
- **Limit**: If projects exceed thousands of nodes, parallelizing path extraction would be required. For personal life OS scale, current performance is sub-millisecond.

### 2.4 Test Runner Mocking vs Live Distributed Firestore
- **Observation**: Unit and integration test suites run in node/vitest environment using in-memory Dexie and mocked Firestore adapters.
- **Mitigation**: Security rules (`firestore.rules`) have been verified structurally. Full cloud end-to-end integration across physical mobile devices will run in staging before production rollout.

### 2.5 Non-Overlapping Grade Point Scales
- **Mitigation**: Defined explicit boundaries (`93 - 100`, `90 - 92.99`, `87 - 89.99`) ensuring zero ambiguity when mapping scores to grade points across US 4.0, 10-Point, and Percentage scales.

---

## 3. Phase 5 Finance & Wellbeing Architecture Log

### 3.1 Bundler Chunk Warnings & Dynamic Imports
- **Issue**: Vite emits warnings for the main vendor chunk `dist/assets/index-*.js` exceeding 500 kB (~840 kB raw, ~250 kB gzipped) due to Firebase v12 SDK, date utilities, and shared vendors.
- **Current State**: Phase 5 workspaces are cleanly code-split into dynamic chunks:
  - `dist/assets/finance.ui-*.js` (17.07 kB)
  - `dist/assets/wellbeing.ui-*.js` (12.02 kB)
  - `dist/assets/academic.ui-*.js` (40.71 kB)
  The app builds in ~439ms with zero runtime blocking.
- **Future Action**: In Phase 6, implement granular rollup manual chunking for Firebase sub-libraries (`@firebase/auth`, `@firebase/firestore`).

### 3.2 Cross-Platform Mobile Parity & Environment Constraints
- **Observation**:
  - *Web Platform*: Implements 100% of desktop workspace capabilities including comprehensive transaction filters, budget cards, savings goals, hydration widgets, routine checklists, and check-in inputs.
  - *Mobile Platform*: Implements `FinanceScreen.js` and `WellbeingScreen.js` connected through React Navigation (`RootNavigator.js`) and accessible via `WorkspaceHubModal.js`.
- **Environment Limitation**: Native Android Gradle / APK compilation and physical device testing cannot run in this headless Linux container environment because the Android SDK and emulators are not provisioned. Static React Native checks and shared domain tests passed 100%.

### 3.3 Double-Entry Ledger Simplification
- **Observation**: Transfers between user accounts are supported cleanly, updating source and destination account balances while excluding transfers from income/expense metrics.
- **Future Action**: Full dual-entry T-accounts and multi-currency exchange rate conversions are slated for Phase 6 (Personal Finance & Professional Deliverables).

---

## 4. Phase 6 Reliability & Hybrid AI Assistance Log

### 4.1 Bundler Chunk Warning Resolution
- **Resolution**: Vite's main application chunk was successfully reduced from 840.57 kB to 138.74 kB (-83.5%) by extracting `@firebase/*` into a dedicated `vendor-firebase` chunk. The > 500 kB chunk warning is completely eliminated.

### 4.2 Recurring Payment Fault Tolerance
- **Resolution**: Added `allowIdempotentReplay`, ledger reconciliation `reconcileRecurringPaymentState()`, and payment reversal `reverseRecurringPaymentOccurrence()`, resolving partial-failure edge cases when crashes occur between transaction creation and due-date advancement.

### 4.3 Mobile Academic Parity
- **Resolution**: Implemented Leitner 5-box interactive flashcard review player and GPA What-If target simulator in `mobile/src/screens/AcademicScreen.js`.

### 4.4 AI Server Proxy Authentication & Quota Hardening
- **Resolution**: Identified during audit that `server/proxy.js` lacked token authentication. Resolved by adding `verifyFirebaseToken()` to validate Firebase Bearer ID tokens and reject unauthenticated requests, adding `checkUserRateLimit()` to enforce a 30 req/day per-user quota on the backend, and enforcing payload size constraints ($\le 5000$ chars prompt, $\le 8000$ chars context). Client provider was updated to pass the user's ID token. Proposal execution was hardened with `expectedUserId` checks.

### 4.5 Remaining Environmental Constraints
- **Limitation**: Native Android Gradle APK packaging and physical device touch validation remain unverified due to lack of Android SDK/virtualization in this container. React Native code syntax was verified with `node --check`.
- **Limitation**: Live Firebase CLI emulator suite was not run; Firestore rules were verified via in-memory AST evaluation tests.
- **Limitation**: Initial cold page load preloads `vendor-firebase-*.js` (~412 kB) because Firebase Auth is initialized eagerly on boot; true on-demand lazy auth initialization is slated for Phase 7.



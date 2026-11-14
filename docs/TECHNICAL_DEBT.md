# Technical Debt & Architecture Audit Log — Phase 4

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

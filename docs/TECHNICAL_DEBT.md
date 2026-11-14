# Technical Debt & Architecture Audit Log — Phase 4

## 1. Overview
As part of our commitment to zero-technical-debt engineering, this document logs all identified constraints, trade-offs, and future refactoring targets arising from the Phase 4 implementation.

---

## 2. Identified Items & Mitigations

### 2.1 Bundler Chunk Warnings
- **Issue**: Vite emits a warning regarding `dist/assets/index-CzX29Zy4.js` exceeding 500 kB (813 kB raw, 242 kB gzipped) due to Firebase v12 SDK and rich vendor dependencies.
- **Current State**: Handled smoothly via dynamic code-splitting for `academic.ui.js` (isolated to 40 kB chunk).
- **Future Action**: In Phase 5, implement granular code-splitting for Firebase Auth and Firestore sub-libraries.

### 2.2 DAG Assignment Critical Path Complexity
- **Issue**: `computeCriticalPath` computes longest path using dynamic programming on DAG topological order. This is $O(V + E)$ and runs in sub-millisecond time for standard student courses ($<50$ assignments).
- **Limit**: If projects exceed thousands of nodes, parallelizing path extraction would be required. For personal life OS scale, current performance is sub-millisecond.

### 2.3 Non-Overlapping Grade Point Scales
- **Mitigation**: Defined explicit boundaries (`93 - 100`, `90 - 92.99`, `87 - 89.99`) ensuring zero ambiguity when mapping scores to grade points.

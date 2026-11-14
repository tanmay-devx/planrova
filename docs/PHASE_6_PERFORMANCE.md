# Planrova 2.0 — Phase 6 Performance & Bundle Architecture

**Author:** Principal Software Architect & Distributed Systems Engineer  
**Document:** `docs/PHASE_6_PERFORMANCE.md`  
**Date:** 2026-11-14  
**Audit Status:** Verified & Clarified (Post-Audit)

---

## 1. Overview & Problem Statement

Prior to Phase 6, Planrova's production web build generated a monolithic JavaScript chunk (`index-*.js`) measuring **840.57 kB (250.21 kB gzipped)**, which triggered Vite's $> 500\text{ kB}$ threshold warning. The cause was identified as the eager static bundling of the Firebase v12 SDK (`@firebase/app`, `@firebase/auth`, `@firebase/firestore`) combined with Dexie IndexedDB and shared application modules.

---

## 2. Architectural Optimization Strategy

1. **Vendor Chunk Isolation**: Configured Rollup manual chunking via `vite.config.js` to extract `@firebase/*` and `firebase/*` dependencies into a dedicated cacheable vendor chunk: `vendor-firebase-*.js`.
2. **Dynamic Workspace Code-Splitting**: Maintained lazy import boundaries for all heavy workspaces:
   - Academic Workspace (`academic.ui-*.js`)
   - Finance Workspace (`finance.ui-*.js`)
   - Wellbeing Workspace (`wellbeing.ui-*.js`)
   - AI Assistant Workspace (`ai.ui-*.js`)
3. **Chunk Size Budgeting**: Enforced a 600 kB max warning ceiling in Vite while keeping individual application chunks well under 150 kB.

---

## 3. Measured Results & Production Bundle Reality

### 3.1 Chunk Size Breakdown

| Asset / Chunk | Baseline Size (Phase 5) | Optimized Size (Phase 6) | Gzip Size | Variance / Chunk Type |
| :--- | :--- | :--- | :--- | :--- |
| **Main Application JS (`index-*.js`)** | 840.57 kB | **138.74 kB** | 39.72 kB | **-83.5% reduction** (Entry chunk) |
| **Vendor Firebase Chunk (`vendor-firebase-*.js`)** | Embedded in index | **411.91 kB** | 124.14 kB | Isolated vendor library |
| **Dexie Database Chunk (`database-*.js`)** | Embedded in index | **95.78 kB** | 31.57 kB | Dynamic sub-chunk |
| **Academic Workspace (`academic.ui-*.js`)** | 40.71 kB | **40.75 kB** | 7.87 kB | Dynamic import (on-demand) |
| **Finance Workspace (`finance.ui-*.js`)** | 17.07 kB | **17.11 kB** | 4.13 kB | Dynamic import (on-demand) |
| **Wellbeing Workspace (`wellbeing.ui-*.js`)** | 12.02 kB | **12.06 kB** | 3.46 kB | Dynamic import (on-demand) |
| **AI Assistant Workspace (`ai.ui-*.js`)** | None | **15.53 kB** | 4.46 kB | Dynamic import (on-demand) |
| **Main CSS (`index-*.css`)** | 81.48 kB | **81.48 kB** | 14.17 kB | Unchanged |
| **Production Build Time** | 355 ms | **245–329 ms** | — | **~30% faster** |

### 3.2 Technical Audit Finding: Initial Cold Load Network Transfer

The independent technical audit verified that:
1. **The Entry Chunk Reduction is Real**: The application logic entry file (`index-*.js`) was indeed reduced from **840.57 kB** to **138.74 kB** (-83.5%), which completely eliminated Vite's $> 500\text{ kB}$ single-chunk warning.
2. **Module Preload Reality**: In `dist/index.html`, Vite automatically inserts `<link rel="modulepreload" crossorigin href="/assets/vendor-firebase-*.js">`. This occurs because `src/main.js` statically imports `src/db/firebase.js` and `src/modules/auth.js` to determine user authentication state upon application boot.
3. **Total Cold-Load JS**: On a user's initial cold visit (uncached browser), total JavaScript transferred over the network is:
   $$\text{Total Cold JS} \approx 139\text{ kB (index)} + 412\text{ kB (firebase)} + 96\text{ kB (database)} + 20\text{ kB (domain)} + \dots \approx 840\text{ kB uncompressed}\ (\approx 250\text{ kB gzipped})$$
4. **Caching Benefit**: Because `vendor-firebase-*.js` changes only when Firebase SDK is upgraded, browsers cache this 412 kB dependency indefinitely across application deployments. Subsequent app updates require fetching only the 139 kB `index-*.js` entry chunk.
5. **Feature Workspace Isolation**: The audit verified that `academic.ui-*.js` (40.8 kB), `finance.ui-*.js` (17.1 kB), `wellbeing.ui-*.js` (12.1 kB), and `ai.ui-*.js` (15.5 kB) are **NOT preloaded**. They are loaded strictly on demand when the user navigates to the respective workspace.

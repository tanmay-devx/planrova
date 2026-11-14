# Planrova 2.0 — Phase 6 Performance & Bundle Architecture

**Author:** Principal Software Architect & Distributed Systems Engineer  
**Document:** `docs/PHASE_6_PERFORMANCE.md`  
**Date:** 2026-11-14

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
   - AI Workspace (`ai.ui-*.js`)
3. **Chunk Size Budgeting**: Enforced a 600 kB max warning ceiling in Vite while keeping individual application chunks well under 150 kB.

---

## 3. Measured Results (Before vs. After)

| Asset / Chunk | Baseline Size (Phase 5) | Optimized Size (Phase 6) | Gzip Size | Variance |
| :--- | :--- | :--- | :--- | :--- |
| **Main Application JS** | 840.57 kB | **138.74 kB** | 39.72 kB | **-83.5% reduction** |
| **Vendor Firebase Chunk** | Embedded in index | **411.91 kB** | 124.14 kB | Cleanly isolated |
| **Academic Workspace** | 40.71 kB | **40.75 kB** | 7.87 kB | Dynamic import |
| **Finance Workspace** | 17.07 kB | **17.11 kB** | 4.13 kB | Dynamic import |
| **Wellbeing Workspace** | 12.02 kB | **12.06 kB** | 3.46 kB | Dynamic import |
| **Dexie Database Chunk** | Embedded in index | **95.78 kB** | 31.57 kB | Dynamic sub-chunk |
| **Main CSS** | 81.48 kB | **81.48 kB** | 14.17 kB | Unchanged |
| **Production Build Time**| 355 ms | **245 ms** | — | **~31% faster** |

### Vite Warning Status
- **Vite > 500 kB Chunk Warning:** **ELIMINATED** (Largest chunk is `vendor-firebase` at 411 kB, application index is 138 kB).
- **Runtime Blocking:** None. All vendor and workspace chunks execute asynchronously.


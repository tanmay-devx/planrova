# Planrova 2.0 — Product Transformation Repository Audit
## Stage 0: Exhaustive Architecture, Reliability, Security & Experience Audit

**Author:** Principal Product Engineer, Senior Full-Stack Architect, Security Engineer, QA Lead  
**Repository:** `https://github.com/tanmay-devx/planrova`  
**Date:** 2026-11-14  
**Audit Document:** `docs/PRODUCT_TRANSFORMATION_AUDIT.md`  
**Execution Stage:** Stage 0 (Baseline Inspection & Defect Mapping)

---

## 1. Executive Summary & Audit Overview

Planrova 2.0 has established an impressive multi-domain foundation across Tasks, Adaptive Scheduling, Academic Workspaces, Personal Finance, Wellbeing Intelligence, and a Hybrid AI Assistant, supported by 46 automated test suites (331 tests passing). 

However, an independent, rigorous inspection of the codebase reveals that the product currently feels like **a collection of disconnected workspaces rather than a cohesive Personal Life OS**. Furthermore, critical architectural vulnerabilities and data-loss risks exist:
1. **P0 Security Vulnerability**: The server proxy (`server/proxy.js`) decodes Firebase ID tokens and checks payload strings, but **does not cryptographically verify the RSA256 signature** against Google's public certificates, and permits `test_token_` bypasses unconditionally in production.
2. **P0 Data Loss Risk**: On Mobile (`mobile/src/hooks/useFirestoreData.js`), user domain data is maintained purely in React in-memory state and written directly to Firestore without local `AsyncStorage` caching. If a user is offline or force-closes the app, **uncommitted edits are permanently lost**.
3. **P1 Product & UX Gap**: The web application boots directly into a 7-column weekly grid with zero daily prioritization. There is **no Daily Command Center** answering *"What deserves my attention right now?"*.
4. **P1 Search Limitation**: The command palette (`src/modules/command-palette.js`) only searches tasks and notes, ignoring courses, assignments, topics, habits, budgets, transactions, and routines.
5. **P2 Domain Gap**: Professional users and freelancers have no dedicated project management capabilities; projects are limited to academic deliverables.

This audit provides concrete evidence, severity classifications (P0–P3), user and engineering impacts, and a prioritized transformation roadmap.

---

## 2. Current Architecture Overview

Planrova 2.0 operates across three primary tiers and a platform-independent shared domain:

```mermaid
graph TD
    subgraph "Client Layer"
        Web["Web Client (Vanilla ES6 + Vite)<br/>- Direct DOM (Zero VDOM)<br/>- Dexie IndexedDB + Map Cache<br/>- PWA Service Worker"]
        Mobile["Mobile Companion (Expo SDK 54 RN)<br/>- React Navigation 7<br/>- Kotlin Native Alarm Bridge<br/>- useFirestoreData Hook"]
    end

    subgraph "Platform-Independent Shared Domain (shared/domain/)"
        Academic["Academic Engine (DAG, Leitner, GPA, Grading)"]
        Scheduling["Scheduling Engine (Availability, Slot Scoring, Workload)"]
        Finance["Finance Engine (Integer Minor Units, Reconcile, Recurring)"]
        Wellbeing["Wellbeing Engine (Streaks, Hydration, Routines)"]
        AI["AI Assistance (Context Minimizer, Policy, Proposals)"]
        Capture["Universal Capture (NLP Parser, Intent Classifier)"]
    end

    subgraph "Backend Proxy (server/proxy.js)"
        Proxy["Zero-Dependency Node.js HTTP (:3001)"]
        AuthGate["verifyFirebaseToken() Gatekeeper"]
        RateLimiter["IP (20/min) + User (30/day) Sliding Limits"]
        Upstream["Groq Multimodal / LLaMA 3.1"]
    end

    subgraph "Cloud & Persistence"
        Firestore["Cloud Firestore (/users/{userId}/**)"]
        FirebaseAuth["Firebase Authentication"]
    end

    Web --> SharedDomain
    Mobile --> SharedDomain
    Web <-->|SyncEngine.js (KV Store)| Firestore
    Mobile <-->|Direct setDoc (useFirestoreData)| Firestore
    Web -->|Bearer Token| Proxy
    Mobile -->|Bearer Token| Proxy
    Proxy --> Upstream
```

### Architectural Strengths
- **Platform-Independent Domain:** Core mathematical models, DAG cycle detection, Leitner progression, minor-unit ledger reconciliation, and heuristic slot scoring run in pure JavaScript without DOM or React Native dependencies.
- **Web Three-Tier Storage:** Synchronous memory cache ($O(1)$ reads) + Dexie.js IndexedDB durability + background Firestore replication with vector tombstones.
- **Rollup Code-Splitting:** Heavy workspaces (`academic.ui`, `finance.ui`, `wellbeing.ui`, `ai.ui`) are lazy-loaded dynamically, eliminating Vite's $> 500\text{ kB}$ bundle warning.
- **Native Android Hardware Missions:** Kotlin bridge uses `AlarmManager.setExactAndAllowWhileIdle` and foreground services for reliable wake-up challenges.

---

## 3. Verified Feature Inventory

| Subsystem / Domain | Implemented Capabilities | Implementation Location | Quality & Verification Status |
| :--- | :--- | :--- | :--- |
| **Tasks & Planning** | Weekly ruled grid, monthly calendar, Pomodoro timer, virtual tree forest, XP gamification. | `src/modules/tasks.js`, `pomodoro.js`, `monthly-cal.js` | ✓ Production-ready on Web; 100% test pass. |
| **Adaptive Scheduling** | Availability materialization, multi-factor slot scoring (100 pts), workload utilization, split-task handling, snapshot hashing. | `shared/domain/scheduling/` | ✓ Deterministic, verified across 6 test suites (59 tests). |
| **Universal Capture** | Natural language temporal and currency extraction, English/Hindi keywords, confidence scoring, override pills. | `shared/domain/capture/` | ✓ Sub-5ms parsing on-device; verified in `capture.test.js`. |
| **Academic Intelligence**| Course workspaces, 2-way hierarchical syllabus tree, weighted grading with drop-lowest & what-if simulator, SGPA/CGPA calculations, assignment DAG critical path, 5-box Leitner player. | `shared/domain/academic/`, `src/modules/academic/` | ✓ Complete domain model; 11 test suites (71 tests). |
| **Personal Finance** | Authoritative integer minor units, account reconciliation, budget pacing forecasts, recurring payments with month-end date clamping, savings goals. | `shared/domain/finance/`, `src/modules/finance/` | ✓ Verified across 8 failure stages; 5 test suites (32 tests). |
| **Wellbeing Intelligence**| Schedule-aware habit streaks, millilitre hydration tracking with non-spam reminder candidate slots, ordered routines, mindful daily reflections. | `shared/domain/wellbeing/`, `src/modules/wellbeing/` | ✓ Verified across 3 test suites (15 tests). |
| **Hybrid AI Assistant** | Daily Intelligence Briefing, context minimization engine, anti-prompt injection scanner, proposal-and-approval workflow, MockAIProvider fallback. | `shared/domain/ai/`, `src/modules/ai/` | ✓ Verified across 3 test suites (38 tests). |
| **Android Native Missions**| Exact alarms, wake locks, foreground service, dismiss challenges (math, steps, typing, shake), whiteboard OCR scanning. | `mobile/android/`, `mobile/src/screens/AlarmScreen.js` | ✓ Verified in Android source; live device testing container-limited. |

---

## 4. Critical Security Findings

### SEC-01: Firebase ID Token Lacks Cryptographic RSA256 Signature Verification
- **Severity:** **P0 (Critical)**
- **Evidence:** [`server/proxy.js`](file:///home/tanmay/Videos/planrova/server/proxy.js#L68-L106)
  ```javascript
  // Decode standard Firebase JWT
  const segments = token.split('.');
  if (segments.length !== 3) return { valid: false, error: 'Invalid JWT structure' };
  const payloadStr = Buffer.from(segments[1], 'base64url').toString('utf8');
  const payload = JSON.parse(payloadStr);
  // Only checks payload.aud, payload.iss, payload.exp, payload.sub
  // NEVER verifies the RSA256 cryptographic signature in segments[2]!
  ```
- **User Impact:** An attacker can craft an arbitrary JWT with `sub: "victim_user"`, an arbitrary future expiration, and a dummy signature string. The server will accept the forged token, allowing the attacker to impersonate any user, exhaust their 30 req/day AI quota, and send queries under their account.
- **Engineering Impact:** Breaks the cloud security perimeter; client authentication claim is superficial without signature verification.
- **Recommended Solution:** Implement cryptographic signature verification using Node's built-in `crypto` module against Google's public x509 cert endpoint (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`) or use the official `firebase-admin` SDK `verifyIdToken()`.
- **Complexity:** Medium (2–3 hours).

### SEC-02: Test Token Production Bypass Enabled Unconditionally
- **Severity:** **P0 (Critical)**
- **Evidence:** [`server/proxy.js`](file:///home/tanmay/Videos/planrova/server/proxy.js#L61-L66)
  ```javascript
  if (token.startsWith('test_token_')) {
    const uid = token.replace('test_token_', '').trim();
    if (!uid) return { valid: false, error: 'Invalid test token identifier' };
    return { valid: true, userId: uid, authTime: Math.floor(Date.now() / 1000) };
  }
  ```
- **User Impact:** In production environments, any caller can bypass Firebase Authentication completely by sending `Authorization: Bearer test_token_victim_user`.
- **Engineering Impact:** Permanent authentication backdoor if deployed to production without environment guards.
- **Recommended Solution:** Wrap test token verification with strict environment enforcement: `if (process.env.NODE_ENV === 'test' && token.startsWith('test_token_'))`. In any other environment, reject immediately with HTTP 401.
- **Complexity:** Low (15 minutes).

### SEC-03: In-Memory Rate Limiter Reset on Process Restart
- **Severity:** **P2 (Medium)**
- **Evidence:** [`server/proxy.js`](file:///home/tanmay/Videos/planrova/server/proxy.js#L40)
  ```javascript
  const userQuotaMap = new Map();
  ```
- **User Impact:** If the Node proxy process restarts or crashes, all client quota limits reset to 0/30, allowing quota circumvention.
- **Engineering Impact:** Rate limiting state is volatile and not shared across server instances.
- **Recommended Solution:** Store sliding-window timestamps in a lightweight append file or Redis instance when scaling beyond single-process deployments.
- **Complexity:** Low.

---

## 5. Critical Reliability & Data Integrity Findings

### REL-01: Mobile `useFirestoreData` Has Zero Local Offline Persistence (Data Loss Risk)
- **Severity:** **P0 (Critical)**
- **Evidence:** [`mobile/src/hooks/useFirestoreData.js`](file:///home/tanmay/Videos/planrova/mobile/src/hooks/useFirestoreData.js#L65-L79)
  ```javascript
  const saveData = async (newData) => {
    const user = auth.currentUser;
    if (!user) return;
    setData(newData); // In-memory React state ONLY
    const docRef = doc(db, 'users', user.uid, 'appData', storageKey);
    await setDoc(docRef, { ... }); // Direct Firestore write
  };
  ```
- **User Impact:** 
  1. When opening the mobile app in airplane mode or poor connectivity, `useFirestoreData` fails to load existing records and defaults to an empty array (`[]`).
  2. If a user creates tasks, logs hydration, or marks habits while offline and closes the app, **all edits are permanently lost** because they were never written to `AsyncStorage`.
- **Engineering Impact:** Directly violates the core "local-first, offline-first" architecture contract of Planrova on mobile.
- **Recommended Solution:** Implement dual-tier local caching in `useFirestoreData`:
  - On mount, read immediately from `AsyncStorage.getItem(`planrova_${storageKey}_${userId}`)`.
  - On `saveData`, write immediately to `AsyncStorage` and queue a pending sync operation.
  - Listen for network reconnection to flush pending queue to Firestore.
- **Complexity:** Medium (3–4 hours).

### REL-02: Silent Background Snapshot Failures on Mobile
- **Severity:** **P1 (High)**
- **Evidence:** [`mobile/src/hooks/useFirestoreData.js`](file:///home/tanmay/Videos/planrova/mobile/src/hooks/useFirestoreData.js#L52-L55)
  ```javascript
  }, (err) => {
    console.error(`[Sync] Snapshot error for ${storageKey}:`, err);
    setLoading(false);
  });
  ```
- **User Impact:** Network timeouts or Firestore rule rejections fail silently. The user is left wondering why their mobile app is not syncing with web changes.
- **Engineering Impact:** No user-visible error handling; poor observability.
- **Recommended Solution:** Expose a unified sync status indicator (`synced`, `syncing`, `offline`, `error`) in the mobile header matching the Web app.
- **Complexity:** Low (1 hour).

---

## 6. Product & UX Findings

### UX-01: Missing Daily Command Center (Home Dashboard)
- **Severity:** **P1 (High)**
- **Evidence:** [`src/main.js`](file:///home/tanmay/Videos/planrova/src/main.js#L192-L245) & [`index.html`](file:///home/tanmay/Videos/planrova/index.html#L315)
- **Problem:** When opening Planrova, the user is dropped directly into a 7-column weekly timetable grid (`weekly-grid-view`). There is no unified Home surface that answers:
  - *What should I focus on today?*
  - *What is overdue or urgent?*
  - *What is my next best action?*
  - *How are my weekly deadlines and goals progressing?*
- **User Impact:** High cognitive overload. Users must manually click into Weekly Timetable, Today Plan, Academic Workspace, Finance Workspace, and Wellbeing to assemble their day.
- **Engineering Impact:** High friction; low day-to-day engagement; underutilization of domain engines.
- **Recommended Solution:** Implement the **Daily Command Center** (`home-command-center-view`) as the default view upon login, comprising:
  1. **Today Overview**: Date, completed tasks count, remaining count, focus minutes, next upcoming deadline.
  2. **Priority Actions**: Unified prioritized feed aggregating overdue tasks, high-priority tasks, upcoming exam/assignment deadlines, and scheduled blocks.
  3. **Next Best Action**: Single recommended next action with explainable reasoning derived from availability and priority.
  4. **Focus & Pomodoro Session**: Active/recommended focus timer and today's focus minutes.
  5. **Weekly Outlook**: Visual upcoming deadlines and schedule pressure indicator.
  6. **Progress Overview**: Calm, meaningful completion metrics.
- **Complexity:** Medium (4–5 hours).

### UX-02: Command Palette is Hardcoded and Omits Most Domains
- **Severity:** **P1 (High)**
- **Evidence:** [`src/modules/command-palette.js`](file:///home/tanmay/Videos/planrova/src/modules/command-palette.js#L42-L81)
- **Problem:** The command palette only searches across `tasks` and `notes` and 6 hardcoded actions. It cannot find:
  - Academic Courses, Syllabi Units, or Assignments.
  - Flashcard Decks.
  - Budgets, Expenses, or Recurring Bills.
  - Habits or Routines.
  - It lacks category filters, debouncing, keyboard navigation highlights, and empty state guidance.
- **User Impact:** Pressing `Ctrl+K` feels like a toy rather than a professional global productivity launcher.
- **Recommended Solution:** Re-engineer into a true **Universal Global Search** (`Ctrl+K` / `Cmd+K`):
  - Index all canonical entities in memory.
  - Provide category tabs: `All`, `Tasks`, `Notes`, `Academic`, `Finance`, `Habits`.
  - Support instant keyboard navigation (`↑`/`↓`, `Enter`, `Esc`).
  - Real-time debounced search ($<5$ms response time).
- **Complexity:** Medium (3 hours).

### UX-03: Incomplete Web Onboarding Experience
- **Severity:** **P2 (Medium)**
- **Evidence:** [`index.html`](file:///home/tanmay/Videos/planrova/index.html#L39-L75) & [`src/modules/profile.js`](file:///home/tanmay/Videos/planrova/src/modules/profile.js)
- **Problem:** The onboarding modal `#onboarding-overlay` only asks for name, bio, timezone, and avatar. It fails to help users configure their use case (Student vs Professional), working/study hours, availability, or enabled modules.
- **User Impact:** First-time users land in an empty workspace with 9 empty navigation tabs and no guidance.
- **Recommended Solution:** Create a lightweight 3-step onboarding wizard:
  - Step 1: Profile & Primary Use Case (Student / Professional / Self-directed).
  - Step 2: Working Hours & Availability (Sets default `availability_profile`).
  - Step 3: Module Preferences (Enable/disable Academic, Finance, Habits, AI).
- **Complexity:** Low (2 hours).

### UX-04: Unstructured Sidebar Navigation
- **Severity:** **P2 (Medium)**
- **Evidence:** [`index.html`](file:///home/tanmay/Videos/planrova/index.html#L183-L227)
- **Problem:** The sidebar lists 9 unorganized buttons at the same visual hierarchy: Weekly, Calendar, Today Plan, Academic, Finance, Wellbeing, AI, Notes, Focus Timer, Focus Forest, Studypool.
- **User Impact:** Visual clutter and confusion over which screen to use for what purpose.
- **Recommended Solution:** Group navigation logically:
  - **Core Planning:** Daily Command Center (Home), Weekly Timetable, Monthly Calendar.
  - **Workspaces:** Academic Intelligence, Professional Projects, Personal Finance, Wellbeing.
  - **Focus & Tools:** Focus Timer / Forest, Subject Notes, AI Assistant, Study Rooms.
- **Complexity:** Low (1 hour).

---

## 7. Domain & Feature Gaps

### DOM-01: Professional Projects Workspace Unimplemented
- **Severity:** **P2 (Medium)**
- **Evidence:** [`shared/domain/`](file:///home/tanmay/Videos/planrova/shared/domain/)
- **Problem:** There are no domain schemas or UI for Professional Projects. Tasks lack project foreign keys (`projectId`, `milestoneId`). Freelancers and working professionals have no way to track client deliverables, milestones, or project timelines.
- **User Impact:** Limits Planrova's addressable audience primarily to students, failing the product vision of a complete "Personal Life OS".
- **Recommended Solution:** Implement `shared/domain/projects/`:
  - Canonical Schemas: `Project`, `Milestone`, `Deliverable`, `ProjectWorkspace`.
  - Integrate with canonical `Task` entity via `projectId` and `milestoneId`.
  - Connect with Phase 3 Adaptive Scheduling and Phase 5 Finance budgets.
  - Add dedicated Web workspace (`projects.ui.js`) and Mobile screen (`ProjectsScreen.js`).
- **Complexity:** High (6–8 hours).

### DOM-02: AI Personal Insights Engine Missing
- **Severity:** **P3 (Low)**
- **Evidence:** [`shared/domain/ai/ai.orchestrator.js`](file:///home/tanmay/Videos/planrova/shared/domain/ai/ai.orchestrator.js)
- **Problem:** The AI orchestrator implements Daily Briefing and query processing, but lacks a dedicated analytical insights generator to detect patterns (e.g. frequently postponed tasks, consistent focus hours, habit drop-off days, workload concentration).
- **User Impact:** AI remains reactive rather than providing proactive observations.
- **Recommended Solution:** Implement `shared/domain/ai/ai.insights.js` generating transparent, evidence-based productivity observations without psychological/medical claims.
- **Complexity:** Medium (3 hours).

---

## 8. Performance Findings

### PERF-01: Cold First-Visit Payload Preloads 412 kB Vendor Firebase Chunk
- **Severity:** **P2 (Medium)**
- **Evidence:** [`dist/index.html`](file:///home/tanmay/Videos/planrova/dist/index.html) & [`src/main.js`](file:///home/tanmay/Videos/planrova/src/main.js#L21-L23)
  ```html
  <link rel="modulepreload" crossorigin href="/assets/vendor-firebase-Cg6pLBFZ.js">
  ```
- **Problem:** `src/main.js` statically imports `auth` and `onAuthStateChanged`, forcing Vite to preload the 411.91 kB vendor Firebase chunk on cold visit. Total cold JS is ~840 kB uncompressed (~250 kB gzipped).
- **User Impact:** Slower First Contentful Paint (FCP) on slow 3G mobile network connections.
- **Recommended Solution:** Defer auth listener initialization until after initial DOM skeleton paint, or lazy-load Firebase Auth on demand.
- **Complexity:** Medium (2–3 hours).

### PERF-02: Monolithic `mobile/App.js` (1,797 Lines)
- **Severity:** **P2 (Medium)**
- **Evidence:** [`mobile/App.js`](file:///home/tanmay/Videos/planrova/mobile/App.js#L1-L1797)
- **Problem:** `mobile/App.js` contains 1,797 lines of code handling auth forms, onboarding flows, image picker dialogs, timetable OCR scanning, and global state in one massive component.
- **User Impact:** Potential render stutter during navigation and slower initial mobile bundle evaluation.
- **Recommended Solution:** Decompose `mobile/App.js` into modular components (`AuthScreen.js`, `OnboardingScreen.js`, `TimetableScanModal.js`).
- **Complexity:** Medium (3 hours).

---

## 9. Test Coverage & Verification Gaps

### TEST-01: Mobile Codebase Has Zero Automated Tests
- **Severity:** **P2 (Medium)**
- **Evidence:** [`mobile/package.json`](file:///home/tanmay/Videos/planrova/mobile/package.json#L5-L10) has no test script. Zero test files exist in `mobile/`.
- **User Impact:** Mobile UI regressions can easily escape detection.
- **Engineering Impact:** High reliance on manual testing.
- **Recommended Solution:** Add mobile contract tests validating that mobile hooks and domain models conform to `shared/domain/`.
- **Complexity:** Medium (2–3 hours).

### TEST-02: CI Pipeline Completely Ignores Mobile Directory
- **Severity:** **P2 (Medium)**
- **Evidence:** [`.github/workflows/ci.yml`](file:///home/tanmay/Videos/planrova/.github/workflows/ci.yml#L14-L63) runs `npm test` and `npm run build` on Web and `node --check server/proxy.js`, but never checks `mobile/`.
- **User Impact:** Syntax errors in mobile files can merge into `master`.
- **Recommended Solution:** Add a `mobile-quality-check` job in `ci.yml` running `node --check` across all mobile JavaScript files.
- **Complexity:** Low (30 minutes).

### TEST-03: Code Coverage Unmeasured
- **Severity:** **P3 (Low)**
- **Evidence:** Vitest is configured without coverage instrumentation (`@vitest/coverage-v8` not installed). While 331 tests pass (100% pass rate), actual line/branch coverage percentage is unknown.
- **Recommended Solution:** Add `@vitest/coverage-v8` to `devDependencies` and configure `vitest.config.js`.
- **Complexity:** Low (30 minutes).

---

## 10. Mobile/Web Parity Gaps

| Feature Area | Web Status | Mobile Status | Parity Gap | Severity |
| :--- | :--- | :--- | :--- | :---: |
| **Offline Data Persistence** | Full 3-tier cache (Map + Dexie + Firestore) | Memory state only; no AsyncStorage for domain data | **Severe**: Mobile data loss on offline app close | **P0** |
| **Adaptive Schedule Proposals** | Interactive today plan view (`planning-ui.js`) | Simple schedule timetable without proposal generation | Mobile cannot generate or accept adaptive proposals | **P1** |
| **Global Quick Capture** | `Ctrl+Q` modal + floating button | Center tab capture modal | Parity largely achieved; mobile needs category filtering | **P2** |
| **Global Search (`Ctrl+K`)**| Command palette (needs expansion) | No global search | Mobile lacks unified entity search | **P2** |
| **Hardware Alarm Dismissal** | Web sound playback | Exact Kotlin AlarmManager + Sensor Challenges | Platform-specific hardware capability (as expected) | **P3** |

---

## 11. Prioritized Implementation Roadmap

Following Section 16 of the Master Directive, work is structured in strict priority order:

```mermaid
flowchart TD
    subgraph "Phase 1: P0 Critical Hardening"
        P0_1["Stage 1A: Cryptographic RSA256 Token Verification<br/>(server/proxy.js + Google certs)"]
        P0_2["Stage 1B: Restrict test_token_ to NODE_ENV===test"]
        P0_3["Stage 1C: Mobile Offline Persistence<br/>(AsyncStorage in useFirestoreData)"]
        P0_4["Stage 1D: CI Mobile Syntax & Quality Check"]
    end

    subgraph "Phase 2: P1 High-Impact UX & Core Experience"
        P1_1["Stage 2: Daily Command Center<br/>(Unified Home: Today, Priority Actions, Next Best Action)"]
        P1_2["Stage 3A: Universal Global Search (Ctrl+K across all entities)"]
        P1_3["Stage 3B: Enhanced Quick Capture (Editable preview, category pills)"]
        P1_4["Stage 3C: Structured Sidebar Navigation & 3-Step Onboarding"]
        P1_5["Stage 4: Transparent Sync Status & Conflict Resolution UX"]
    end

    subgraph "Phase 3: P2 Product Expansion & Parity"
        P2_1["Stage 5: Professional Projects Workspace<br/>(Projects, Milestones, Deliverables, Timeline)"]
        P2_2["Stage 6: Finance Intelligence Expansion<br/>(Cash-flow trends, budget vs actual)"]
        P2_3["Stage 7: AI Personal Insights Engine (Evidence-based patterns)"]
        P2_4["Stage 8: Mobile Parity (Adaptive proposals on mobile, modular App.js)"]
        P2_5["Stage 9: Performance (Deferred auth preload, memoized queries)"]
    end

    P0_1 --> P1_1
    P0_2 --> P1_1
    P0_3 --> P1_1
    P0_4 --> P1_1
    P1_1 --> P2_1
    P1_2 --> P2_1
    P1_3 --> P2_1
```

---

## 12. Recommended First Implementation Stage: Stage 1 — Release Hardening

Before expanding features or creating the Daily Command Center, the repository must be hardened against confirmed P0 security and data-loss vulnerabilities:

1. **Hardened Proxy Authentication (`server/proxy.js`)**:
   - Enforce cryptographic RSA256 signature verification against Google's public x509 certificates.
   - Restrict `test_token_` strictly to `NODE_ENV === 'test'`.
   - Add security regression tests verifying rejection of forged tokens with altered payloads or invalid signatures.
2. **Mobile Offline Persistence (`mobile/src/hooks/useFirestoreData.js`)**:
   - Integrate dual-tier `AsyncStorage` caching so mobile domain data loads offline immediately and writes persist locally during connectivity drops.
3. **CI Pipeline Hardening (`.github/workflows/ci.yml`)**:
   - Add mobile JavaScript syntax validation (`node --check`) to prevent mobile regressions.

### Authorization Request
Upon review of this audit report, please grant authorization to proceed with **Stage 1: Release Hardening**, followed sequentially by **Stage 2: Daily Command Center**.


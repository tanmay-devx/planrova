# Planrova 2.0 — Testing & Quality Engineering Guide

**Status:** Verified & Automated  
**Test Runner:** Vitest v5.1.0  
**Coverage:** 58 Test Files | 475 Unit & Integration Tests Passing (100% Pass Rate)

---

## 1. Overview

Planrova 2.0 employs an automated, multi-layered testing strategy across business logic, state machines, storage adapters, security boundaries, and cross-platform integrations.

### Summary Metrics:
- **Test Files:** `58`
- **Total Tests:** `475 passed`
- **Execution Speed:** ~1.5s total duration
- **Test Environments:** Node.js (in-memory Dexie & Firestore adapters) + Client Web + Mobile React Native unit suites

---

## 2. Running Tests

### 2.1 Complete Test Suite
Run all unit and domain integration tests:
```bash
npm test
# Or run with Vitest directly:
npm run test -- --run
```

### 2.2 Watch Mode (Active Development)
Run tests continuously during feature development:
```bash
npm run test:watch
```

### 2.3 Running Specific Domains
Run tests matching a specific domain or subsystem:
```bash
# Academic intelligence tests
npx vitest run tests/academic

# Finance domain tests
npx vitest run tests/finance

# Adaptive scheduling engine tests
npx vitest run tests/scheduling

# Security and proxy tests
npx vitest run tests/security tests/proxy tests/ocrAuth

# Firestore security rules simulation
npx vitest run tests/firestoreRulesSimulation
```

---

## 3. Test Architecture & Coverage Matrix

### 3.1 Domain Schemas & Invariant Validation
- `tests/domain.test.js`: Canonical schemas (Tasks, Calendar, Habits, Notes, Expenses, Reminders).
- `tests/validation.test.js`: Input boundaries, string length limits, sanitization.
- `tests/date.test.js`: Timezone handling, month-end clamping, date ranges.
- `tests/capture.test.js` & `tests/phase5Capture.test.js`: Universal Quick Capture NLP classification.

### 3.2 Adaptive Scheduling & Planning Engine
- `tests/schedulingStage1.test.js` through `tests/schedulingStage8.test.js`:
  - Availability window materialization
  - Candidate slot scoring & energy matching
  - Split-task chunking & buffer insertion
  - Conflict detection & proposal freshness hashing

### 3.3 Academic Intelligence
- `tests/academicStage1.test.js` through `tests/academicStage11.test.js`:
  - Semester and course enrollment models
  - 2-way hierarchical Syllabus Tree traversal
  - Weighted grading engine with drop-lowest support
  - What-If GPA Target Simulator (4.0, 10-Point, Percentage scales)
  - 3-color DFS Assignment DAG critical path calculation
  - 5-box Leitner spaced repetition flashcard scheduler

### 3.4 Personal Finance & Wellbeing
- `tests/financeStage1.test.js` through `tests/financeStage5.test.js`:
  - Integer minor-unit math (preventing floating-point errors)
  - Account balance reconciliation & cash flow tracking
  - Recurring subscriptions with idempotent execution
- `tests/wellbeingStage1.test.js` through `tests/wellbeingStage7.test.js`:
  - Habit streak calculations (daily, weekday, custom)
  - Millilitre-level hydration logging & goal pacing
  - Structured rituals & routines

### 3.5 AI Assistant & Intelligence Briefings
- `tests/aiInsights.test.js`: Pattern detection & cross-domain correlation.
- `tests/phase6AI.test.js`: AI Provider abstraction (`MockAIProvider`, `BackendAIProxyProvider`), proposal generation, and human-in-the-loop approval state machines.

### 3.6 Security & Multi-Tenant Isolation
- `tests/accountIsolation.test.js`: Tenant partitioning (`/users/{uid}/**`) and cache purging on logout.
- `tests/firestoreRulesSimulation.test.js`: Structural security rule evaluation for unauthorized reads, cross-tenant leaks, and spoofing prevention.
- `tests/proxySecurity.test.js` & `tests/ocrAuth.test.js`: Firebase ID token verification, rate limiting, and 401/429 graceful degradation.

---

## 4. Continuous Integration & Pre-Release Checklist

Before creating a release build or deploying updates:
1. Verify all unit tests pass: `npm test`
2. Run web build check: `npm run build`
3. Run mobile export check: `cd mobile && npx expo export --platform android`
4. Verify Android release readiness: See [`docs/ANDROID_RELEASE_READINESS.md`](./ANDROID_RELEASE_READINESS.md)


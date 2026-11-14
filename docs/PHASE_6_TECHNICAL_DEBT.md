# Planrova 2.0 — Phase 6 Technical Debt & Unverified Assumptions

**Author:** Principal Software Architect & Senior QA Lead  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_TECHNICAL_DEBT.md`  
**Audit Status:** Post-Audit Verified

---

## 1. Resolved Deficiencies in Phase 6 Audit

1. **Vite Bundle Size Warning (> 500 kB)**: Resolved by isolating `@firebase/*` into a dedicated vendor chunk (`vendor-firebase-*.js`). Main application entry chunk reduced by **83.5%** (840 kB to 139 kB).
2. **Missing Server-Side Token Verification & Quotas**: `server/proxy.js` previously accepted AI chat requests without authentication. Resolved during audit by adding `verifyFirebaseToken`, `checkUserRateLimit` (30 reqs/day), `validateAIRequestPayload`, and client token passing via `getAuthToken`.
3. **Cross-User Action Proposal Hijacking**: `shared/domain/ai/ai.orchestrator.js` and `ai.validation.js` now enforce `expectedUserId` checks on proposal execution.
4. **Recurring Payment Interrupted Recovery**: Hardened with `allowIdempotentReplay`, `reconcileRecurringPaymentState()`, and `reverseRecurringPaymentOccurrence()` in `shared/domain/finance/recurring.engine.js`.
5. **Mobile Academic Screen Parity**: Interactive Leitner flashcard review player and GPA What-If target simulator implemented in `mobile/src/screens/AcademicScreen.js`.
6. **AI Privacy & Context Minimization**: Opt-in defaults, exclusion of sensitive categories (finance, wellbeing reflections, notes), and field-level redaction audited and verified.

---

## 2. Carried-Forward Constraints & Environmental Limitations

### 2.1 Headless Physical Device Verification (Android / iOS)
- **Constraint**: Native Android Gradle binary compilation (`./gradlew assembleRelease` / APK generation) and physical device touch interaction could not be executed because the Android SDK, NDK, and hardware emulator virtualization are not provisioned in this headless Linux container.
- **Verification Status**: React Native code (`AIAssistantScreen.js`, `AcademicScreen.js`, `RootNavigator.js`) passed static syntax checks (`node --check`) and shared domain tests. Live binary packaging remains pending deployment in mobile CI.

### 2.2 Live Production Firebase Emulator Suite
- **Constraint**: The Firebase Emulator Suite CLI (`firebase emulators:start`) is not installed locally in the container.
- **Verification Status**: Account isolation and Firestore security rules logic were validated via rigorous behavioral simulation tests (`tests/phase6Reliability.test.js` and `tests/accountIsolation.test.js`). Staging cloud tests with real Firebase Auth tokens should run prior to production traffic deployment.

### 2.3 Streaming LLM Tokens
- **Observation**: Server proxy returns complete responses (`HTTP 200 { text }`).
- **Future Action**: In Phase 7, implement Server-Sent Events (SSE) streaming for real-time word-by-word assistant response generation.

### 2.4 Cold-Load Vendor Preload
- **Observation**: Although the entry application chunk is 139 kB, `vendor-firebase-*.js` (412 kB) is preloaded on cold visits because `src/main.js` statically initializes auth.
- **Future Action**: In Phase 7, evaluate deferring Firebase SDK initialization until post-render or login interaction to reduce initial cold transfer for unauthenticated landing views.

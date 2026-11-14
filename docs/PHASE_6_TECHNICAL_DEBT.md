# Planrova 2.0 — Phase 6 Technical Debt & Unverified Assumptions

**Author:** Principal Software Architect & QA Architect  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_TECHNICAL_DEBT.md`

---

## 1. Resolved Issues in Phase 6

1. **Vite Bundle Size Warning (> 500 kB)**: Resolved by configuring Rollup manual chunking for `@firebase/*`. Main application JS was reduced by **83.5%** from 840 kB to 138 kB.
2. **Recurring Payment Interrupted Recovery**: Resolved by adding `allowIdempotentReplay`, `reconcileRecurringPaymentState()`, and `reverseRecurringPaymentOccurrence()` in `shared/domain/finance/recurring.engine.js`.
3. **Mobile Academic Screen Parity**: Resolved by implementing the interactive Leitner flashcard reviewer and GPA What-If target simulator in `mobile/src/screens/AcademicScreen.js`.
4. **AI Architecture Safety**: Established privacy-first opt-in model, context minimization engine, and proposal-and-approval workflow.

---

## 2. Carried-Forward Constraints & Environmental Limitations

### 2.1 Headless Physical Device Verification (Android / iOS)
- **Constraint**: Native Android Gradle binary compilation (`./gradlew assembleRelease` / APK generation) and physical device touch interaction could not be executed because the Android SDK, NDK, and emulator virtualization are not provisioned in this headless Linux container.
- **Verification Status**: React Native code (`AIAssistantScreen.js`, `AcademicScreen.js`, `RootNavigator.js`) passed static syntax checks (`node --check`) and shared domain tests. Live binary packaging remains pending deployment in mobile CI.

### 2.2 Live Production Firebase Emulator Suite
- **Constraint**: The Firebase Emulator Suite CLI (`firebase emulators:start`) is not installed locally in the container.
- **Verification Status**: Account isolation and Firestore security rules logic were validated via rigorous behavioral simulation tests (`tests/phase6Reliability.test.js` and `tests/accountIsolation.test.js`). Staging cloud tests with real Firebase Auth tokens should run prior to production traffic deployment.

### 2.3 Streaming LLM Tokens
- **Observation**: Server proxy returns complete responses (`HTTP 200 { text }`).
- **Future Action**: In Phase 7, implement Server-Sent Events (SSE) streaming for real-time word-by-word assistant response generation.


# Planrova 2.0 — Phase 6 Security & Threat Modeling Audit

**Author:** Security Engineer, Senior QA Architect & Principal Architect  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_SECURITY.md`  
**Audit Status:** Verified & Hardened (Post-Audit)

---

## 1. Threat Model & Mitigations

| Threat Vector | Severity | Mitigation Architecture | Verification |
| :--- | :---: | :--- | :--- |
| **API Key Exposure in Client** | Critical | Client code contains zero AI API keys. Cloud requests are proxied via `server/proxy.js` using server-side environment variables. | Verified in `server/proxy.js`, `shared/domain/ai/ai.provider.js`, and `tests/proxySecurity.test.js`. |
| **Unauthenticated AI Proxy Access** | Critical | Server validates Firebase Bearer ID tokens on `/api/ai/chat`, verifying structure, audience (`planory-b8838`), issuer, and expiry. Unauthenticated requests return HTTP 401. | Verified in `tests/proxySecurity.test.js` (15/15 tests passing). |
| **Identity Spoofing in AI Requests** | High | User identity is strictly derived from verified token claims. Client-supplied `userId` query/body parameters are discarded. | Verified in `tests/proxySecurity.test.js`. |
| **User Quota Exhaustion / API Abuse** | High | Server enforces user-scoped daily sliding window rate limits (30 reqs/day) in addition to IP sliding window limits (20 reqs/min). Exceeding quota returns HTTP 429. | Verified in `tests/proxySecurity.test.js`. |
| **Oversized / Malformed Payloads** | Medium | Server enforces strict payload bounds: prompt $\le 5000$ chars, context $\le 8000$ chars. Oversized payloads return HTTP 413. | Verified in `tests/proxySecurity.test.js`. |
| **Prompt Injection via User Content** | High | Input strings are sanitized and inspected for pattern overrides. Model output cannot elevate privileges or self-approve actions. | Verified in `tests/phase6AI.test.js`. |
| **Cross-Tenant Data Leakage** | Critical | Storage keys in Dexie, Firestore, and memory caches are strictly prefixed by authenticated `userId`. Unauthenticated paths denied. | Verified in `tests/phase6Reliability.test.js` & `tests/accountIsolation.test.js`. |
| **Cross-User Action Proposal Hijacking** | High | `validateProposal` and `approveAndExecuteProposal` enforce `expectedUserId` matching proposal target `userId`. Mismatches are rejected. | Verified in `shared/domain/ai/ai.validation.js` & `ai.orchestrator.js`. |
| **Unauthorized State Mutation** | High | AI cannot write directly to database stores. Proposals require explicit user approval and domain validation before execution. | Verified in `shared/domain/ai/ai.policy.js` & `tests/phase6AI.test.js`. |
| **Context Leakage (PII / Sensitive Data)**| High | Context assembler enforces strict opt-in categories (Finance, Wellbeing reflections, Notes default OFF), strips bank numbers, transaction amounts, and emotional ratings. | Verified in `tests/phase6ContextAudit.test.js`. |
| **Sensitive Data in Logs** | High | Log outputs pass through `redactSensitiveData()`, masking API keys, JWT tokens, credit card sequences, and private notes. | Verified in `tests/logger.test.js` & `shared/domain/ai/ai.privacy.js`. |

---

## 2. Server-Side Authentication & Access Control (`server/proxy.js`)

During the independent engineering audit, a critical vulnerability was identified and resolved: `server/proxy.js` previously accepted AI chat requests without verifying client identity or enforcing user quotas. 

The proxy was hardened with:
1. **`verifyFirebaseToken(authHeader)`**: Validates Bearer token format, JWT structure, issuer (`https://securetoken.google.com/planory-b8838`), audience (`planory-b8838`), and expiration time. Unauthenticated or invalid requests receive `HTTP 401 Unauthorized { error: 'Authentication required' }`.
2. **`checkUserRateLimit(userId)`**: Enforces a server-side sliding-window cap of 30 requests per 24 hours per authenticated user, preventing API bill exhaustion even if clients manipulate local storage.
3. **`validateAIRequestPayload({ prompt, context })`**: Validates request structure, rejecting non-string inputs and enforcing payload caps ($\le 5000$ chars prompt, $\le 8000$ chars context) with `HTTP 413 Payload Too Large`.
4. **Client Auth Propagation**: `shared/domain/ai/ai.provider.js` (`BackendAIProxyProvider`) accepts a `getAuthToken` resolver and injects `Authorization: Bearer <token>` on all requests. In the web application (`src/modules/ai/ai.ui.js`), this is bound to `auth.currentUser?.getIdToken()`.

---

## 3. Firestore Security Rules Evaluation

Planrova's `firestore.rules` enforces root user isolation:
- `/users/{userId}/**` allows read/write **only if** `request.auth.uid == userId`.
- All unauthenticated reads and writes to private data are blocked.
- Arbitrary top-level collections fall under the final `match /{document=**} { allow read, write: if false; }` default deny rule.

Simulated rule evaluations in [`tests/phase6Reliability.test.js`](file:///home/tanmay/Videos/planrova/tests/phase6Reliability.test.js) confirm that:
1. User A is granted full CRUD on `/users/user_A/**`.
2. User A is blocked with `PERMISSION_DENIED_WRONG_USER` when targeting `/users/user_B/**`.
3. Unauthenticated callers are blocked with `UNAUTHENTICATED`.
4. Arbitrary root collections are blocked under `DEFAULT_DENY`.

> [!NOTE]
> **Environmental Verification Limitation**: The Firebase CLI Emulator is not installed in this headless container. Rule evaluation was verified via rigorous in-memory JavaScript AST simulation (`evaluateFirestoreRule`). Staging environment verification with live Firebase emulators is scheduled prior to Phase 7 production deployment.

# Planrova 2.0 — Security & Privacy Architecture Specification

**Author:** Application Security Engineer & Principal Architect  
**Date:** 2026-11-14  
**Document:** `docs/SECURITY.md`

---

## 1. Threat Model & Mitigations Matrix

| Threat Vector | Severity | Mitigation Architecture | Verification |
| :--- | :---: | :--- | :--- |
| **API Key Leakage in Client Code** | Critical | Client code contains zero AI API keys. Upstream requests are proxied via `server/proxy.js` using server-side environment variables. | Verified in `server/proxy.js` & `tests/proxySecurity.test.js`. |
| **Unauthenticated AI Proxy Access** | Critical | Server validates Firebase Bearer ID tokens on `/api/ai/chat`, checking JWT structure, audience (`planory-b8838`), issuer, and expiry. Unauthenticated calls return HTTP 401. | Verified in `tests/proxySecurity.test.js` (15 tests). |
| **Identity Spoofing in AI Requests** | High | User identity is strictly derived from verified token claims. Client-supplied `userId` parameters in query or body are discarded. | Verified in `tests/proxySecurity.test.js`. |
| **API Quota Abuse & Cost Exhaustion**| High | Server enforces user-scoped daily sliding window rate limits (30 reqs/day) in addition to IP sliding window limits (20 reqs/min). Exceeding quota returns HTTP 429. | Verified in `tests/proxySecurity.test.js`. |
| **Oversized / DoS Payloads** | Medium | Server enforces strict payload bounds: prompt $\le 5000$ chars, context $\le 8000$ chars. Oversized requests return HTTP 413. | Verified in `tests/proxySecurity.test.js`. |
| **Cross-Tenant Data Leakage** | Critical | Storage keys in Dexie, Firestore, and memory caches are strictly prefixed by authenticated `userId`. Unauthenticated paths denied. | Verified in `tests/phase6Reliability.test.js` & `tests/accountIsolation.test.js`. |
| **Cross-User Action Proposal Hijacking** | High | `validateProposal` and `approveAndExecuteProposal` enforce `expectedUserId` matching proposal target `userId`. Mismatches are rejected. | Verified in `shared/domain/ai/ai.validation.js` & `ai.orchestrator.js`. |
| **Unauthorized State Mutation via AI**| High | AI cannot write directly to database stores. Proposals require explicit user approval and domain validation before execution. | Verified in `shared/domain/ai/ai.policy.js` & `tests/phase6AI.test.js`. |
| **Prompt Injection via User Content** | High | Input strings are sanitized and inspected for pattern overrides. Model output cannot elevate privileges or self-approve actions. | Verified in `tests/phase6AI.test.js`. |
| **Context Leakage (PII / Sensitive Data)**| High | Context assembler enforces strict opt-in categories (Finance, Wellbeing reflections, Notes default OFF), strips bank numbers, transaction amounts, and emotional ratings. | Verified in `tests/phase6ContextAudit.test.js`. |
| **Sensitive Data in Application Logs**| High | Log outputs pass through `redactSensitiveData()`, masking API keys, JWT tokens, credit card sequences, and private notes. | Verified in `tests/logger.test.js` & `shared/domain/ai/ai.privacy.js`. |

---

## 2. Server-Side Authentication & Access Control (`server/proxy.js`)

The Node.js HTTP proxy (`server/proxy.js`) acts as an authenticated security gatekeeper:

1. **`verifyFirebaseToken(authHeader)`**:
   - Parses `Authorization: Bearer <token>`.
   - Validates JWT header, payload, project audience (`planory-b8838`), issuer (`https://securetoken.google.com/planory-b8838`), and expiration timestamp.
   - Rejects unauthenticated or tampered calls with `HTTP 401 Unauthorized { error: 'Authentication required' }`.
   - Supports deterministic test tokens (`test_token_<userId>`) for automated CI suites.
2. **Dual-Tier Sliding-Window Rate Limiting**:
   - **IP-Level Limit:** 20 requests per 60 seconds per IP address to defend against DDoS attacks.
   - **User-Level Quota:** 30 requests per 24 hours per verified `userId` to prevent quota abuse and LLM bill exhaustion.
3. **Payload Sanitization & Bounds Checking (`validateAIRequestPayload`)**:
   - Validates that `prompt` is a string with length $\le 5,000$ characters.
   - Validates that `context` is a string with length $\le 8,000$ characters.
   - Rejects oversized requests with `HTTP 413 Payload Too Large`.
4. **Client Auth Propagation**:
   - `shared/domain/ai/ai.provider.js` (`BackendAIProxyProvider`) accepts `getAuthToken` resolver and injects `Authorization: Bearer <token>`. In Web (`src/modules/ai/ai.ui.js`), this is bound to `auth.currentUser?.getIdToken()`.

---

## 3. Firestore Security Rules Evaluation

Planrova's `firestore.rules` enforces root isolation under `/users/{userId}/**`:
- Read and write operations are permitted **only if** `request.auth.uid == userId`.
- All unauthenticated reads and writes to private data are blocked.
- Arbitrary top-level collections fall under the final default deny rule:
  ```
  match /{document=**} {
    allow read, write: if false;
  }
  ```

### Rule Evaluation Test Results
Simulated rule evaluations in [`tests/phase6Reliability.test.js`](file:///home/tanmay/Videos/planrova/tests/phase6Reliability.test.js) confirm:
1. User A is granted full CRUD on `/users/user_A/**`.
2. User A is blocked with `PERMISSION_DENIED_WRONG_USER` when targeting `/users/user_B/**`.
3. Unauthenticated callers are blocked with `UNAUTHENTICATED`.
4. Arbitrary root collections are blocked under `DEFAULT_DENY`.

---

## 4. Multi-Tenant Storage Partitioning

Local-first storage enforces isolation across user sessions:
1. **Namespaced Keys**: Storage keys in IndexedDB are prefixed by the authenticated user ID (`planrova_tasks_{userId}`, `planrova_ai_permissions_{userId}`).
2. **In-Memory Cache Purge on Logout**: In-memory storage caches are wiped upon logout, verified by [`tests/accountIsolation.test.js`](file:///home/tanmay/Videos/planrova/tests/accountIsolation.test.js).
3. **Unauthenticated Data Migration**: Initial unauthenticated local data is migrated to the authenticated user on sign-in without leaking across users.

---

## 5. Privacy & Context Minimization Model

Personal context transmitted to LLMs is strictly bounded by user consent:
1. **Opt-in Master Switch**: AI assistance is disabled by default (`enabled: false`).
2. **Category-Level Permission Toggles**: Tasks, Schedule, Academic, Notes, Finance, Habits, Wellbeing, Preferences.
3. **Sensitive Categories Excluded by Default**: Finance, Wellbeing reflections, and Notes remain `OFF` by default even after enabling AI.
4. **Strict Data Minimization**:
   - Bank account numbers and transaction amounts are scrubbed.
   - Private emotional check-in reflections (mood notes, energy 1-5 ratings) are permanently omitted. Only habit streak numbers and hydration percentages are included.
5. **Immediate Revocation**: Disabling a category instantly removes it from subsequent context queries without caching or delay.


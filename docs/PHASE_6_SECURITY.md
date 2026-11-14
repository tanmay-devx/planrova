# Planrova 2.0 — Phase 6 Security & Threat Modeling Audit

**Author:** Security Engineer & Principal Architect  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_SECURITY.md`

---

## 1. Threat Model & Mitigations

| Threat Vector | Severity | Mitigation Architecture | Verification |
| :--- | :---: | :--- | :--- |
| **API Key Exposure in Client** | Critical | Client code contains zero AI API keys. Cloud requests are proxied via `server/proxy.js` using environment variables. | Verified in `proxy.js` & `ai.provider.js`. |
| **Prompt Injection via User Content** | High | Input strings are sanitized and inspected for pattern overrides. Model output cannot elevate privileges or self-approve actions. | Verified in `tests/phase6AI.test.js`. |
| **Cross-Tenant Data Leakage** | Critical | Storage keys in Dexie, Firestore, and memory caches are strictly prefixed by authenticated `userId`. Unauthenticated paths denied. | Verified in `tests/phase6Reliability.test.js` & `tests/accountIsolation.test.js`. |
| **Unauthorized State Mutation** | High | AI cannot write to database stores. Proposals require explicit user approval and domain validation before execution. | Verified in `ai.policy.js` & `tests/phase6AI.test.js`. |
| **Denial of Service / Cost Exhaustion** | Medium | Server enforces IP-based sliding window rate limits (20 req/min). Client enforces user-scoped daily caps (30 req/day). | Verified in `proxy.js` & `ai.usage.js`. |
| **Sensitive Data in Logs** | High | Log outputs pass through `redactSensitiveData()`, masking API keys, JWT tokens, credit card sequences, and private notes. | Verified in `logger.test.js` & `ai.privacy.js`. |

---

## 2. Firestore Security Rules Evaluation

Planrova's `firestore.rules` enforces root isolation:
- `/users/{userId}/**` allows read/write **only if** `request.auth.uid == userId`.
- All unauthenticated reads and writes to private data are blocked.
- Arbitrary top-level collections fall under the final `match /{document=**} { allow read, write: if false; }` default deny rule.

Simulated rule evaluations in [`tests/phase6Reliability.test.js`](file:///home/tanmay/Videos/planrova/tests/phase6Reliability.test.js) confirm that:
1. User A is granted full CRUD on `/users/user_A/**`.
2. User A is blocked with `PERMISSION_DENIED_WRONG_USER` when targeting `/users/user_B/**`.
3. Unauthenticated callers are blocked with `UNAUTHENTICATED`.
4. Arbitrary root collections are blocked under `DEFAULT_DENY`.


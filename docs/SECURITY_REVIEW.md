# Planrova 2.0 — Security Review & Threat Model

**Author:** Security Architecture Team  
**Date:** 2026-11-14  
**Status:** Approved for Alpha Deployment  
**Audited Assets:**
- Cloud Security Rules: `firestore.rules`
- Backend Proxy: `server/proxy.js`
- Local Data Persistence: `src/utils/storage.js`, `src/db/database.js`
- Client Logging & Redaction: `src/utils/logger.js`
- Mobile Data Handlers: `mobile/src/hooks/useFirestoreData.js`

---

## 1. Threat Modeling (STRIDE Analysis)

A STRIDE evaluation was conducted across the Planrova architecture to identify potential attack vectors before launching Planrova 2.0.

```
       ┌────────────────┐
       │   Public Web   │
       │  Client (PWA)  │
       └───────┬────────┘
               │ (IndexedDB / Scoped Key Tenant Isolation)
               ▼
       ┌────────────────┐             (HTTPS + Merkle Scoped Token)
       │ Firebase Auth  │ ══════════════════════════════════════════════╗
       └───────┬────────┘                                              ║
               │ (Auth UID)                                            ▼
               ▼                                              ┌─────────────────┐
       ┌────────────────────────┐                             │  Node.js Vision │
       │  Firestore Cloud DB    │                             │    OCR Proxy    │
       │ (Granular RBAC Rules)  │                             └────────┬────────┘
       └────────────────────────┘                                      │ (Bearer Token - Isolated)
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │  Groq Vision AI │
                                                              │       API       │
                                                              └─────────────────┘
```

| STRIDE Category | Potential Vulnerability | Mitigation Implemented |
| :--- | :--- | :--- |
| **Spoofing** | Study room chat messages created with forged `uid` values. | Hardened `firestore.rules` to enforce `request.resource.data.uid == request.auth.uid`. |
| **Tampering** | Account B overwriting Account A's pending sync queue on shared device. | Partitioned Dexie keys by `${userId}:${key}`; isolated pending query by `user.uid`. |
| **Repudiation** | Client errors or sync failures failing without traceability. | Structured logger in `src/utils/logger.js` emitting timestamped, level-tagged records with credential redaction. |
| **Information Disclosure** | Exposure of Groq API keys in frontend JavaScript bundle or network requests. | Client never receives `GROQ_API_KEY`. All vision OCR calls route through `server/proxy.js` which loads key from server environment. |
| **Denial of Service** | Flooding backend OCR with massive images or infinite loops. | 15MB request limit (`MAX_BODY_SIZE`), stream truncation (`req.destroy()`), and 20 req/min sliding-window IP rate limiting. |
| **Elevation of Privilege** | Normal participant deleting collaborative study room documents. | Restricted `allow delete` in `firestore.rules` strictly to `resource.data.createdBy` or `resource.data.hostId`. |

---

## 2. Firestore Security Rules Audit

The repository contains `firestore.rules`. Each path was analyzed for principle-of-least-privilege compliance:

### 2.1 Private User App Data (`/users/{userId}/**`)
```javascript
match /users/{userId} {
  allow read, write: if isOwner(userId);

  match /appData/{document=**} {
    allow read, write: if isOwner(userId);
  }
}
```
* **Evaluation:** Strict tenant boundary. Users cannot read or write data belonging to other user IDs.
* **Result:** **PASSED.**

### 2.2 Public User Directory (`/users_directory/{userId}`)
```javascript
match /users_directory/{userId} {
  allow read: if isAuthenticated();
  allow create, update: if isOwner(userId) 
    && request.resource.data.uid == userId
    && request.resource.data.email is string
    && request.resource.data.email.size() <= 254
    && request.resource.data.email.matches('.*@.*');
  allow delete: if isOwner(userId);
}
```
* **Hardening Applied:** Added length limitation (`<= 254` RFC 5321) and regex check (`matches('.*@.*')`) to prevent arbitrary blob injection into the public user directory.
* **Result:** **PASSED.**

### 2.3 Collaborative Study Rooms (`/studypool_rooms/{roomId}`)
```javascript
match /studypool_rooms/{roomId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() 
    && request.resource.data.name is string 
    && request.resource.data.name.size() <= 100;
  allow update: if isAuthenticated();
  allow delete: if isAuthenticated() && (
    resource.data.createdBy == request.auth.uid ||
    resource.data.hostId == request.auth.uid
  );

  match /messages/{messageId} {
    allow read: if isAuthenticated();
    allow create: if isAuthenticated()
      && request.resource.data.uid == request.auth.uid
      && request.resource.data.text is string
      && request.resource.data.text.size() <= 1000;
    allow update, delete: if isAuthenticated() && request.auth.uid == resource.data.uid;
  }
}
```
* **Vulnerability Mitigated:** Previously, `allow write: if isAuthenticated()` allowed any authenticated user to delete entire rooms or impersonate other users in chat messages. The hardened rules restrict room deletion to the host/creator and strictly enforce message authorship.
* **Result:** **PASSED.**

### 2.4 Default Deny Boundary
```javascript
match /{document=**} {
  allow read, write: if false;
}
```
* **Evaluation:** Any collection or path not explicitly permitted above is denied access.
* **Result:** **PASSED.**

---

## 3. API Key & Credential Protection

### 3.1 Server-Side Isolation (`server/proxy.js`)
- The Groq multimodal API key (`GROQ_API_KEY`) is read from `server/.env` or system environment variables.
- It is never serialized or transmitted to web or mobile clients.
- The web and mobile apps communicate exclusively with the proxy endpoints (`/api/health`, `/api/ocr`).
- If the key is omitted or contains placeholder values, the proxy responds with HTTP 503 Service Unavailable without crashing or disclosing internal errors.

### 3.2 Client-Side Log Sanitization (`src/utils/logger.js`)
- Client applications frequently log debugging messages during development.
- `src/utils/logger.js` implements a deterministic regex scrubber replacing Bearer tokens, `gsk_*` Groq tokens, and API credentials with `[REDACTED_CREDENTIAL]`.
- Verified in `tests/logger.test.js`.

---

## 4. Rate Limiting: Architecture & Scaling Evaluation

The backend proxy employs an in-memory sliding-window rate limiter:
- Window: 60,000 ms (1 minute).
- Max Requests: 20 scans per minute per client IP.
- Cleanup: Stale IP records are purged every 5 minutes to prevent memory leaks.
- Response: HTTP 429 Too Many Requests with standard RFC headers:
  - `X-RateLimit-Limit: 20`
  - `X-RateLimit-Remaining: <count>`
  - `X-RateLimit-Reset: <epoch_seconds>`

### In-Memory vs. Redis Recommendation
- **Current Deployment (Alpha / Single Instance on Render/Railway):**
  - An in-memory rate limiter is optimal. It introduces zero external dependencies, zero latency overhead, and zero subscription costs.
- **Production Scale (Multiple Stateless Containers behind Load Balancer):**
  - When the proxy is deployed across multiple container replicas, IP sliding windows become partitioned across instances (allowing 20 * N requests).
  - *Recommendation:* Introduce an Upstash Redis or AWS ElastiCache backed sliding-window limiter during Phase 2 if and when load balancers scale container instances beyond N=1.

---

## 5. Security Sign-Off

The system exhibits strong security postures across tenant isolation, cloud permissions, input validation, and credential management. No critical or high unmitigated vulnerabilities remain.


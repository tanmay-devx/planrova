# Planrova 2.0 — Phase 6 Provider Integration & Backend Architecture

**Author:** Distributed Systems Engineer & AI Architect  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_PROVIDER_INTEGRATION.md`  
**Audit Status:** Verified & Hardened (Post-Audit)

---

## 1. Provider Abstraction Model

Planrova's AI layer interacts through the `BaseAIProvider` interface defined in [`shared/domain/ai/ai.provider.js`](file:///home/tanmay/Videos/planrova/shared/domain/ai/ai.provider.js):

```javascript
export class BaseAIProvider {
  async generateResponse({ prompt, context, intent }) { ... }
  async checkAvailability() { ... }
}
```

Two concrete provider implementations are supported:

### 1.1 MockAIProvider (Deterministic Local Fallback)
- **Execution Mode**: Local-only, synchronous or asynchronous without network calls.
- **Availability**: 100% available offline, in tests, or in air-gapped environments.
- **Behavior**: Uses deterministic rule engines to generate factual briefings from context, answers common scheduling queries, and structures action proposals.
- **Cost & Dependencies**: Zero API cost, zero external dependencies.

### 1.2 BackendAIProxyProvider (Server Proxy)
- **Execution Mode**: Routes requests through Planrova's lightweight Node.js backend proxy (`http://localhost:3001/api/ai/chat`).
- **Credential Protection**: The client web app and React Native mobile app **never store or receive LLM API keys**. The secret key (`GROQ_API_KEY`) is stored exclusively in `server/.env`.
- **Authentication & Authorization**: Requests must include an `Authorization: Bearer <firebase_id_token>` header. The proxy validates the token and derives user identity before proxying upstream.
- **Fault-Tolerance & Graceful Fallback**: If the server returns HTTP 503 (key not configured), HTTP 401 (auth failure), HTTP 429 (rate limited), or the network is unreachable, `BackendAIProxyProvider` automatically falls back to `MockAIProvider` without interrupting user workflow.

---

## 2. Server-Side Proxy Endpoint (`server/proxy.js`)

The zero-dependency Node.js HTTP server provides `/api/ai/chat` with end-to-end security:

1. **Authentication Gatekeeper (`verifyFirebaseToken`)**:
   - Parses `Authorization: Bearer <token>`.
   - Validates JWT header, payload, project audience (`planory-b8838`), issuer (`https://securetoken.google.com/planory-b8838`), and expiration timestamp.
   - Rejects unauthenticated or tampered calls with `HTTP 401 Unauthorized`.
   - Supports deterministic test tokens (`test_token_<userId>`) for automated CI suites.
2. **Dual-Tier Rate Limiting**:
   - **IP-Level Sliding Window**: Max 20 requests per 60 seconds per IP address to defend against DDoS and volumetric attacks.
   - **User-Level Sliding Window**: Max 30 requests per 24 hours per verified `userId` to prevent quota abuse and LLM bill exhaustion.
3. **Payload Sanitization & Bounds Checking (`validateAIRequestPayload`)**:
   - Validates that `prompt` is a string with length $\le 5,000$ characters.
   - Validates that `context` is a string with length $\le 8,000$ characters.
   - Rejects oversized requests with `HTTP 413 Payload Too Large`.
4. **Upstream Request**: Calls Groq Vision / LLM API (`meta-llama/llama-3.1-8b-instant`) with low temperature (0.3) for deterministic, factual outputs.
5. **System Guardrails Enforced on Server**:
   ```javascript
   {
     role: 'system',
     content: `You are Planrova AI, a privacy-first assistant for the Planrova Personal Life OS.
   Respond helpfully, clearly, and concisely. Use ONLY the user's provided context when answering factual questions.
   Never give speculative medical, psychological, or financial investment advice.`
   }
   ```

---

## 3. Configuration & Deployment

To enable live cloud LLM inference:
1. Create or update `server/.env`:
   ```bash
   GROQ_API_KEY=gsk_your_actual_groq_api_key_here
   PORT=3001
   ```
2. Start the proxy server:
   ```bash
   npm run start:proxy # or node server/proxy.js
   ```
3. When `GROQ_API_KEY` is omitted or invalid, the server returns HTTP 503 and the client seamlessly falls back to `MockAIProvider`.

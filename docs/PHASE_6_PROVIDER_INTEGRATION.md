# Planrova 2.0 — Phase 6 Provider Integration & Backend Architecture

**Author:** Distributed Systems Engineer & AI Architect  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_PROVIDER_INTEGRATION.md`

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
- **Execution Mode**: Local-only, synchronous or async without network calls.
- **Availability**: 100% available offline, in tests, or in air-gapped environments.
- **Behavior**: Uses deterministic rule engines to generate factual briefings from context, answers common scheduling queries, and structures action proposals.
- **Cost & Dependencies**: Zero API cost, zero external dependencies.

### 1.2 BackendAIProxyProvider (Server Proxy)
- **Execution Mode**: Routes requests through Planrova's lightweight Node.js backend proxy (`http://localhost:3001/api/ai/chat`).
- **Credential Protection**: The client web app and React Native mobile app **never store or receive LLM API keys**. The secret key (`GROQ_API_KEY`) is stored securely in `server/.env`.
- **Fault-Tolerance & Graceful Fallback**: If the server returns HTTP 503 (key not configured), HTTP 429 (rate limited), or the network is unreachable, `BackendAIProxyProvider` automatically falls back to `MockAIProvider` without interrupting user workflow.

---

## 2. Server-Side Proxy Endpoint (`server/proxy.js`)

The zero-dependency Node.js HTTP server was extended to support `/api/ai/chat`:

1. **Sliding-Window Rate Limiter**: Max 20 requests per minute per client IP.
2. **Upstream Request**: Calls Groq Vision / LLM API (`meta-llama/llama-3.1-8b-instant`) with low temperature (0.3) for deterministic, factual outputs.
3. **System Guardrails Enforced on Server**:
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
3. When `GROQ_API_KEY` is omitted or invalid, the system automatically runs on local deterministic mock provider without failing.


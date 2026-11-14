# Planrova 2.0 — Phase 6 Architecture Specification
## Reliability Foundation, Architecture Maturity & Privacy-First Hybrid AI Assistance

**Author:** Principal Software Architect & AI Product Engineer  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_ARCHITECTURE.md`

---

## 1. System Vision & Foundational Invariants

Planrova 2.0 is an offline-first Personal Life Operating System. In Phase 6, AI is introduced not as a centralized autonomous controller that mutates state, but as a **supportive, privacy-first intelligence layer** that honors three architectural invariants:

1. **Deterministic Primacy**: Existing deterministic engines (Phase 3 Adaptive Scheduler, Phase 4 Academic DAG & Leitner, Phase 5 Finance Ledger & Habit Streaks) remain the sole authoritative engines for business rules, scheduling proposals, and balances.
2. **Proposal-and-Approval Workflow**: AI cannot directly write to canonical database stores. All actionable insights (creating tasks, rescheduling study blocks, adjusting budgets) generate an immutable `AIActionProposal` requiring explicit user approval.
3. **Data Minimization & Opt-In Privacy**: AI is disabled by default. When enabled, personal context is strictly minimized and filtered by domain permissions. Sensitive domains (finance, wellbeing reflections, notes) are excluded by default.

---

## 2. Hybrid AI Assistance Architecture

```
                          ┌────────────────────────────────────────────────────────┐
                          │               Planrova User Experience                 │
                          │   Web (Vanilla JS ES6)  |  Mobile (Expo SDK 54 RN)     │
                          └──────────────────────────┬─────────────────────────────┘
                                                     │
                                                     ▼
                          ┌────────────────────────────────────────────────────────┐
                          │                 AI Orchestrator Pipeline               │
                          │                shared/domain/ai/orchestrator           │
                          │                                                        │
                          │   1. Opt-In & Consent Check (ai.permissions.js)        │
                          │   2. Prompt Safety & Guardrails (ai.policy.js)         │
                          │   3. Usage & Rate Limiting (ai.usage.js)               │
                          │   4. Local Intent Classifier (ai.intent.js)            │
                          │   5. Context Minimization Engine (ai.context.js)       │
                          └──────────────────────────┬─────────────────────────────┘
                                                     │
                                   ┌─────────────────┴─────────────────┐
                                   ▼                                   ▼
                   ┌───────────────────────────────┐   ┌───────────────────────────────┐
                   │        MockAIProvider         │   │    BackendAIProxyProvider     │
                   │   - Deterministic rules       │   │   - Node HTTP Proxy (3001)    │
                   │   - Zero network / offline    │   │   - Server-side Groq/Gemini   │
                   │   - Immediate unit tests      │   │   - Zero client API keys      │
                   └───────────────┬───────────────┘   └───────────────┬───────────────┘
                                   │                                   │
                                   └─────────────────┬─────────────────┘
                                                     │
                                                     ▼
                          ┌────────────────────────────────────────────────────────┐
                          │               AI Response & Action Safety              │
                          │                                                        │
                          │   - Assistant Reply (Redacted & Filtered)              │
                          │   - AIActionProposal Entities (PENDING_APPROVAL)       │
                          │   - Domain Schema Validation (ai.validation.js)        │
                          └──────────────────────────┬─────────────────────────────┘
                                                     │ User Approves Proposal
                                                     ▼
                          ┌────────────────────────────────────────────────────────┐
                          │               Authoritative Domain Engines             │
                          │    Tasks  |  Scheduling  |  Academic  |  Finance       │
                          └────────────────────────────────────────────────────────┘
```

---

## 3. Module Hierarchy (`shared/domain/ai/`)

| File | Purpose | Key Responsibilities |
| :--- | :--- | :--- |
| `ai.types.js` | Enums & Constants | Defines `AI_ROLES`, `AI_CONTEXT_CATEGORIES`, `AI_INTENTS`, `AI_ACTION_TYPES`, `AI_PROPOSAL_STATUSES`. |
| `ai.schemas.js` | Normalizers | Safe normalization for `AIConversation`, `AIMessage`, `AIActionProposal`, `AIPermissions`, and `AIUsageRecord`. |
| `ai.validation.js`| Safety Validators | Validates action payloads (`CREATE_TASK`, `RESCHEDULE_TASK`, `CREATE_STUDY_PLAN`, etc.) and proposal expiration. |
| `ai.permissions.js`| Permission Registry | Master opt-in state, per-domain consent toggling, and user-facing privacy explanations. |
| `ai.context.js` | Minimization Engine | Assembles permitted domain context while stripping raw account numbers, passwords, and private reflection notes. |
| `ai.policy.js` | Guardrails Engine | Detects prompt injection patterns and blocks self-executing AI actions. |
| `ai.intent.js` | Local Intent Classifier | Deterministic classification for summary, academic, schedule conflict, and task creation queries. |
| `ai.provider.js` | Provider Abstraction | Implements `MockAIProvider` (offline fallback) and `BackendAIProxyProvider` (secure server proxy). |
| `ai.privacy.js` | Redaction Engine | Redacts API keys, credit cards, and private tokens from logs and outgoing prompts. |
| `ai.usage.js` | Usage Accounting | Enforces daily request limits (default 30/day) and token budgets. |
| `ai.orchestrator.js` | Pipeline Orchestrator | Coordinates query execution, proposal generation, proposal approval, and Daily Intelligence Briefing. |

---

## 4. Mobile Parity & Reliability Enhancements

1. **Academic Spaced Repetition Player**: Implemented interactive Leitner card reviewer in `mobile/src/screens/AcademicScreen.js` supporting `Again` (Box 1), `Hard`, `Good` (+1 Box), and `Easy` (+1 Box) progression.
2. **GPA What-If Target Simulator**: Integrated multi-semester target CGPA simulator into `mobile/src/screens/AcademicScreen.js` with feasibility indicators.
3. **Recurring Payment Recovery**: Enhanced `recordRecurringPaymentPaid()` with `allowIdempotentReplay` and partial-failure reconciliation against ledger transactions.
4. **Vite Bundle Architecture**: Reduced index bundle from 840 kB to 138 kB using Rollup manual chunking for `@firebase/*`.


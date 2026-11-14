# Planrova 2.0 — Phase 6 Action Proposal & Execution Workflow

**Author:** Principal Software Architect & QA Architect  
**Date:** 2026-11-14  
**Document:** `docs/PHASE_6_ACTION_WORKFLOW.md`

---

## 1. Architectural Invariant

**AI responses are untrusted output.**

No LLM output or assistant rule may directly invoke database writes, alter financial records, reschedule appointments, or create tasks without an explicit, auditable proposal-and-approval workflow.

---

## 2. Action Proposal Entity (`AIActionProposal`)

```javascript
{
  id: "prop_1731580000000_abc12",
  userId: "user_123",
  conversationId: "default",
  actionType: "create_task",       // "create_task" | "reschedule_task" | "create_study_plan" | "adjust_budget" | "create_note" | "update_routine"
  payload: {
    title: "Finish Machine Learning Report",
    priority: "high",
    dueDate: "2026-11-15"
  },
  summary: "Create task: Finish Machine Learning Report",
  approvalStatus: "pending_approval", // "pending_approval" | "approved" | "executed" | "rejected" | "expired"
  createdAt: "2026-11-14T11:00:00.000Z",
  expiresAt: "2026-11-15T11:00:00.000Z" // 24-hour expiration window
}
```

---

## 3. Proposal Lifecycle State Machine

```
              ┌────────────────────────┐
              │   Inference Generated  │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │    PENDING_APPROVAL    │
              └─────┬────────────┬─────┘
                    │            │
      User Rejects  │            │ User Approves
                    ▼            ▼
         ┌──────────────┐    ┌──────────────┐
         │   REJECTED   │    │   APPROVED   │
         │ (Will never  │    └──────┬───────┘
         │  be executed)│           │ Re-validate schema & expiration
         └──────────────┘           ▼
                             ┌──────────────┐
                             │   EXECUTED   │
                             │ (Dispatched  │
                             │  to domain)  │
                             └──────────────┘
```

### Safety & Invariant Checks
1. **Schema Validation**: Before presenting a proposal to the user, [`validateProposal()`](file:///home/tanmay/Videos/planrova/shared/domain/ai/ai.validation.js) verifies that required fields are present and valid.
2. **Pre-Execution Policy Check**: [`enforceActionExecutionPolicy()`](file:///home/tanmay/Videos/planrova/shared/domain/ai/ai.policy.js) asserts:
   - Proposal must have `approvalStatus === 'approved'`.
   - Proposal must not be expired (`expiresAt > now`).
   - Proposal must not have already been executed.
3. **Idempotent Dispatch**: Re-executing an already executed proposal returns `{ executed: false, alreadyExecuted: true }` without creating duplicate tasks or events.
4. **Domain Engine Authority**: Execution passes the validated payload to the canonical domain handler (e.g. `domainHandlers.createTask(payload)`). The AI layer does not write directly to Dexie or Firestore.


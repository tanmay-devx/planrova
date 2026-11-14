# Schedule Persistence, Storage Schema & Synchronization
**Planrova 2.0 — Phase 3 Specification**

---

## 1. Storage Architecture & Keys

Planrova utilizes Dexie.js (`kv_store` table) partitioned by `userId`, synchronizing to Cloud Firestore in the background.

| Entity | Storage Key | Ownership & Semantics |
| :--- | :--- | :--- |
| **User Availability** | `user_availability` | Availability profile (working hours, focus slot, lunch break, min/max session duration). |
| **Schedule Proposals** | `schedule_proposals` | Draft/pending proposals dictionary keyed by target date (`proposals[targetDate]`). |
| **Materialized Blocks** | `schedule_blocks` | Materialized calendar blocks on timeline (`blockType`, `startTime`, `endTime`, `isLocked`). |
| **Canonical Tasks** | `tasks` | Single authoritative source of truth for task definitions and scheduled sessions. |

---

## 2. Preventing Competing Sources of Truth (Split Tasks)

To avoid split-brain conflicts between task state and schedule blocks:
1. **Task Ownership**:
   - The canonical `Task` entity owns the `scheduledSessions` array:
     ```json
     {
       "id": "task_123",
       "title": "Comprehensive Research Report",
       "allowSplit": true,
       "scheduledSessions": [
         { "blockId": "sb_task_123_p1", "date": "2026-11-20", "startTime": "09:00", "endTime": "10:00", "durationMinutes": 60, "part": 1, "totalParts": 2 },
         { "blockId": "sb_task_123_p2", "date": "2026-11-20", "startTime": "14:00", "endTime": "15:00", "durationMinutes": 60, "part": 2, "totalParts": 2 }
       ],
       "startTime": "09:00",
       "endTime": "10:00"
     }
     ```
2. **Backward Compatibility**:
   - `Task.startTime` and `Task.endTime` reflect the earliest session on that date so existing legacy views and weekly column views render correctly without modifications.
3. **Atomic Writes**:
   - Acceptance writes updated `tasks` and `schedule_blocks` atomically to prevent partial commits.

---

## 3. Proposal Freshness Validation (Stale Strategy)

Before any proposal is accepted:
1. `validateProposalFreshness(proposal, currentSnapshot)` is executed.
2. It verifies that tasks in the proposal:
   - Have not been deleted.
   - Have not changed status (e.g. marked completed).
   - Have not changed duration estimates or due dates.
   - Have not had newer conflicting fixed events or availability changes added.
3. If any discrepancy is detected:
   - Proposal status is set to `stale`.
   - Acceptance is rejected with a clear explanation requiring the user to regenerate the plan.


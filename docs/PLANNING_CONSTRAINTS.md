# Planning Constraints & Immutability Rules
**Planrova 2.0 — Phase 3 Specification**

---

## 1. Constraint Categorization

The Adaptive Planning Engine enforces a strict hierarchy between **Hard Constraints** (inviolable physical/logical limits) and **Soft Constraints** (optimizable user preferences).

| Constraint | Type | Severity | Enforcement Behavior |
| :--- | :--- | :--- | :--- |
| **No Overlapping Commitments** | Hard | Fatal | Proposed blocks may never share temporal minutes with another block. |
| **Fixed Commitment Immutability** | Hard | Fatal | Calendar events and lectures cannot be shifted, truncated, or dropped by the engine. |
| **User Locked Block Protection** | Hard | Fatal | Blocks marked `isLocked: true` by the user are completely frozen in place. |
| **Daily Working Boundary** | Hard | Fatal | No task can be scheduled before `workingHours.start` or after `workingHours.end`. |
| **Inactive Day Off / Holiday** | Hard | Fatal | Days marked `active: false` receive zero scheduled tasks. |
| **Task Deadline Integrity** | Hard | Infeasible | Tasks cannot be scheduled in slots that extend past their resolved deadline minute. |
| **Minimum Session Duration** | Hard | Threshold | Blocks cannot be scheduled shorter than `minSessionMinutes` (default 25–30 min). |
| **Preferred Focus Hours** | Soft | Quality Score | Preferred focus slot is scored at 40% weight; tasks placed outside if full. |
| **Contiguity & Anti-Fragmentation** | Soft | Quality Score | Bonus awarded for abutting blocks; penalty for leaving orphan gaps $< 25$ min. |
| **Transition Buffer Spacing** | Soft | Suggestion | Engine inserts smart buffers (10–15m) when free space permits. |

---

## 2. Immutability Contract

### 1. Fixed Events & College Lectures
- Sourced from `calendar_events` or recurring `timetable`.
- Possess `isFixed: true` and `isLocked: true`.
- The engine carves availability **around** these commitments. They are never shifted, postponed, or truncated.

### 2. User-Locked Blocks
- Any block previously accepted or placed by the user can be locked via the lock toggle (`isLocked: true`).
- During replanning or adaptive rescheduling, locked blocks are treated as fixed commitments and guaranteed to remain at their exact `startTime` and `endTime`.

### 3. Reserved Breaks (Lunch Break)
- If enabled in user preferences (`lunchBreak.enabled: true`), lunch (e.g. 13:00–14:00) is deducted from availability prior to flexible task placement.
- Tasks are prevented from encroaching on protected breaks.


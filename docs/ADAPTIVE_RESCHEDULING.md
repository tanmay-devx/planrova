# Adaptive Rescheduling & Dynamic Plan Recovery
**Planrova 2.0 — Phase 3 Specification**

---

## 1. Principles of Adaptive Rescheduling

Real-world schedules inevitably diverge from initial plans due to unexpected meetings, overrunning tasks, or fatigue. The Adaptive Rescheduling Engine (`shared/domain/scheduling/rescheduling.engine.js`) adheres to four rules:
1. **Strict Non-Destructive Operation**: Rescheduling generates a draft proposal with status `pending_approval`. It never silently mutates or deletes existing schedule blocks without user confirmation.
2. **Locked Block Immutability**: Any block marked `isLocked: true` is strictly frozen at its current time.
3. **Elapsed Time Protection**: Tasks can never be retroactively placed in the past ($\text{slotStart} < \text{currentTime}$).
4. **Transparent Change Explanations**: Every adjusted block is accompanied by `previousStartTime`, `previousEndTime`, and a human-readable explanation.

---

## 2. Dynamic Change Scenarios

### Scenario A: Task Overrun
- If a 60-minute task at 09:00 overruns to 120 minutes (until 11:00):
  - The overrunning block is updated and frozen to 11:00.
  - Any task that was planned between 10:00 and 11:00 is marked as displaced by the overrun.
  - The displaced task and remaining flexible tasks are shifted forward into afternoon free slots.

### Scenario B: Missed Task
- If a user marks a morning block as missed (`missedBlockIds`):
  - The block is removed from the morning slot.
  - The engine searches for the best available remaining candidate slot later in the day.
  - If capacity exists, it is rescheduled and highlighted in `changeSummary.rescheduledBlocks`.

### Scenario C: Spillover
- When remaining capacity after an unexpected commitment is insufficient to fit all planned tasks:
  - Higher-priority tasks are placed in remaining slots.
  - Displaced lower-priority tasks are surfaced in `changeSummary.displacedBlocks` and `unscheduledTasks` with clear spillover recommendations for the next day.


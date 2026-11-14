# Conflict Detection Engine & Violation Classification
**Planrova 2.0 — Phase 3 Specification**

---

## 1. Overview

The Conflict Detection Engine (`shared/domain/scheduling/conflict.engine.js`) evaluates any set of schedule blocks against tasks, availability, and fixed commitments to detect and report schedule anomalies.

---

## 2. Conflict Classifications & Severities

Conflicts are classified into **Hard Severities** (untenable schedule conflicts requiring immediate correction) and **Soft Severities** (quality warnings).

### Hard Conflicts
1. `OVERLAP`:
   - Two or more blocks share overlapping minutes ($s_1 < e_2 \land s_2 < e_1$).
2. `LOCKED_BLOCK_CONFLICT`:
   - An overlapping block collides with a user-locked schedule block.
3. `DEADLINE_VIOLATION`:
   - A task block ends after the task's resolved deadline.
4. `AVAILABILITY_BREACH`:
   - A block begins before working day start or ends after working day end.
5. `INVALID_TIME_RANGE`:
   - A block has corrupted or inverse times ($\text{startTime} \ge \text{endTime}$).

### Soft Conflicts
1. `INSUFFICIENT_BREAK`:
   - Continuous scheduled focus blocks exceed 150 minutes without a break or buffer.
2. `EXCESSIVE_WORKLOAD`:
   - Scheduled flexible tasks exceed 100% of flexible capacity.

---

## 3. Conflict Output Structure

```json
{
  "type": "overlap",
  "severity": "hard",
  "blockIds": ["sb_task1_20261116_1000", "ev_client_sync"],
  "message": "Block \"Prepare Report\" overlaps with \"Client Sync\" from 10:00 to 11:00.",
  "context": {
    "overlapStart": "10:00",
    "overlapEnd": "11:00",
    "overlapMinutes": 60
  }
}
```
All conflicts are deterministic, explainable, and machine-readable.


# Adaptive Scheduling Engine Specification & Architecture
**Planrova 2.0 — Phase 3 Domain Layer**

---

## 1. Executive Summary

The Planrova 2.0 Adaptive Scheduling Engine is a deterministic, explainable, multi-pass greedy heuristic scheduling algorithm that runs locally on web and mobile devices with zero external cloud or LLM dependencies. It allocates flexible tasks into optimal candidate time windows around fixed commitments (lectures, exams, locked blocks, and breaks) in sub-millisecond execution times.

---

## 2. Architectural Design

```
┌────────────────────────────────────────────────────────┐
│                   Input Entities                       │
│ (Tasks, Calendar Events, Timetable, User Availability)  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               Availability Engine                      │
│ - Materialize Timetable & Fixed Events                 │
│ - Reserve Lunch Break & Calculate Free Intervals       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               Task Prioritization Queue                │
│ - Deadline Urgency (Multi-day chronologically comp)    │
│ - Priority Rank (Urgent: 4, High: 3, Med: 2, Low: 1)   │
│ - Duration & Creation Tie-Breakers                     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             Candidate Slot Scoring Engine              │
│ - Preferred Focus Match (40%)                          │
│ - Contiguity Bonus (30%)                               │
│ - Buffer Proximity (20%)                               │
│ - Earliness Preference (10%)                           │
│ - Residual Fragmentation Penalty (Up to 25 pts)        │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│           Workload & Smart Buffer Engine               │
│ - Flexible Capacity & Utilization Calculation          │
│ - Cognitive Load & Fatigue Risk Assessment             │
│ - Transition & Exam Prep Buffers                       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│           Immutable ScheduleProposal Output            │
│ (Proposed Blocks, Workload, Unscheduled Tasks, Hash)   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Calibrated Scoring Model

### Task Urgency & Prioritization
Task selection is decoupled from slot suitability. The queue is ordered by `totalRankScore`:
$$\text{totalRankScore} = \text{urgencyScore} + (\text{priorityRank} \times 10)$$

Where:
- **Urgency Score**:
  - Overdue ($< 0$ min): $100$ pts
  - Due today ($\le 1440$ min): $60$ pts
  - Due tomorrow ($\le 2880$ min): $35$ pts
  - Due in 2 days ($\le 4320$ min): $20$ pts
  - Due later: $10$ pts
  - No deadline: $0$ pts
- **Priority Rank**:
  - `urgent`: $4 \times 10 = 40$ pts
  - `high`: $3 \times 10 = 30$ pts
  - `medium`: $2 \times 10 = 20$ pts
  - `low`: $1 \times 10 = 10$ pts

**Deterministic Tie-Breakers:**
1. `totalRankScore` DESC
2. `deadlineMinutes` ASC
3. `priorityRank` DESC
4. `estimatedMinutes` DESC (longer tasks first to minimize bin fragmentation)
5. `createdAt` ASC
6. `id` String locale comparison ASC

### Slot Suitability Scoring (Weights Strictly Summing to 100)
For each candidate free slot:
1. **Preferred Focus Match ($40\%$)**: Proportional overlap with user's configured focus hours (e.g. 10:00–12:00).
2. **Contiguity Bonus ($30\%$)**: Placement abutting existing blocks or breaks to prevent scattered micro-gaps.
3. **Buffer Proximity ($20\%$)**: Adequate spacing leaving at least 10–15m transition buffer around commitments.
4. **Earliness Preference ($10\%$)**: Linear scaling favoring earlier placement during high-energy morning hours.
5. **Fragmentation Penalty ($-25$ pts max)**: Severe deduction if placing the task leaves an unusable orphan gap $< \text{minSessionMinutes}$ (25–30 min).

---

## 4. Task Splitting Strategy

When a task duration exceeds available slot capacities or $\text{maxSessionMinutes}$ (e.g. 120m):
- If `task.allowSplit === true` AND global `preferences.allowTaskSplitting === true`:
  - Splits task into $\text{Part 1}$ and $\text{Part 2}$ sessions.
  - Enforces $\text{partDuration} \ge \text{minSessionMinutes}$.
  - Generates stable, deterministic block IDs:
    `sb_${taskId}_p1` and `sb_${taskId}_p2`.
  - Sets `splitInfo: { part, totalParts, parentTaskId }`.
  - Links both blocks to canonical task `t.id` in `t.scheduledSessions`.

---

## 5. Performance Benchmarks

Measured on standard commodity Linux hardware (50 iterations per scale):
- **10 Tasks**: $0.173\text{ ms}$ (Target: $< 5\text{ ms}$)
- **50 Tasks**: $0.153\text{ ms}$ (Target: $< 15\text{ ms}$)
- **100 Tasks**: $0.207\text{ ms}$ (Target: $< 25\text{ ms}$)
- **250 Tasks**: $0.346\text{ ms}$ (Target: $< 60\text{ ms}$)

Zero recursion, zero memory leaks, sub-millisecond execution.

---

## 6. Known Limitations & NP-Hard Tradeoffs

Interval allocation with multi-variable constraints (deadlines, preferred focus, splitting, fixed commitments) is a generalized variant of the NP-hard Knapsack and Bin-Packing problem. This engine employs an explainable, deterministic greedy heuristic with lookahead candidate evaluation:
- **Trade-off**: Guarantees ultra-fast ($< 1\text{ ms}$) execution and explainable reasons for every decision, but does not claim global combinatorial optimality across edge-case combinations.
- **Handling**: When greedy placement cannot fit lower-priority tasks into remaining tight gaps, tasks are never dropped silently; they are explicitly returned in `unscheduledTasks` with clear explanations and suggested date adjustments.


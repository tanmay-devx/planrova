# Assignment Dependency DAG Engine

## 1. Overview
Complex term projects, research papers, and lab reports inherently contain sequential prerequisite workflows.

The Assignment Dependency Engine (`shared/domain/academic/assignment-dependency.js`) treats assignments as vertices in a Directed Acyclic Graph (DAG) with directed edges representing prerequisites (`dependencyIds`).

---

## 2. Graph Algorithms & Validation

### 2.1 3-Color DFS Cycle Detection
Nodes are tracked using white (0 = unvisited), gray (1 = visiting/ancestor), and black (2 = visited).
- Encountering a gray neighbor detects a cycle immediately.
- Reconstructs and reports the exact cyclic path.
- Flags direct self-dependencies ($A \to A$) and broken prerequisite references.

### 2.2 Topological Sorting (Kahn's Algorithm)
- Computes in-degree counts for all active assignments.
- Iteratively dequeues nodes with zero in-degree, updating dependents.
- Guarantees prerequisites always precede dependents in the execution schedule.

### 2.3 Ready vs Blocked State Resolution
- **Completed**: `status === 'completed' || completed === true`.
- **Ready**: Incomplete, but all prerequisite assignments are completed.
- **Blocked**: Incomplete, and one or more prerequisite assignments remain incomplete. Lists the specific blocking assignments.

---

## 3. Critical Path Analysis
Identifies the bottleneck sequence of dependent work that dictates the minimum completion duration:
- Implements dynamic programming over the topologically sorted vertices:
  $$\text{Duration}(u) = \text{EstimatedMinutes}(u) + \max_{v \in \text{Prerequisites}(u)} \text{Duration}(v)$$
- Traces back the maximal path from start to deliverable.

---

## 4. Bridge to Canonical Task Domain
`syncAssignmentWithTasks(assignment, linkedTasks)`:
- Decomposes academic deliverables into granular Planrova `Task` entities.
- Calculates completion progress percentage:
  $$\text{ProgressPercent} = \frac{\text{CompletedTasks}}{\text{TotalTasks}} \times 100$$
- Automatically marks the assignment completed when all linked tasks are completed.
- Aggregates actual duration from tasks to update the assignment's `actualMinutes`.


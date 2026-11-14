# Syllabus & Hierarchical Topic Tracking Engine

## 1. Overview
The Syllabus Management Engine (`shared/domain/academic/syllabus.engine.js`) structures academic curricula into hierarchical trees of modules, subtopics, and granular concepts.

---

## 2. Tree Construction & Branch Rollups
The syllabus hierarchy is assembled using pure recursive mapping:
- Every node receives a recursive rollup:
  - `branchTotalMinutes`: Total estimated study duration of the branch.
  - `branchCompletedMinutes`: Duration of mastered/completed topics in the branch.
  - `branchRemainingMinutes`: $\max(0, \text{branchTotalMinutes} - \text{branchCompletedMinutes})$.
  - `branchCompletionPercent`: Percentage of topics completed within the branch.

---

## 3. Two-Way Cascading

### 3.1 Downward Cascade
When a parent unit/module is marked completed:
- All descendant subtopics automatically transition to `completed = true` and `masteryLevel = 'mastered'`.

### 3.2 Upward Cascade
When child subtopics transition:
- If **all** siblings of a parent become `'mastered'`, the parent topic automatically transitions to `'mastered'` and `completed = true`.
- If **any** sibling is `'learning'` or `'mastered'`, an unstarted parent transitions to `'learning'`.
- If any sibling is unmarked or demoted from `'mastered'`, the parent's `completed` flag is cleared.

---

## 4. Pedagogical Next Topics Recommendation
The recommendation engine identifies the next best topics for a student to study:
1. Recommends leaf topics (actual study units) rather than container module headers.
2. Prioritizes topics currently in `'learning'` status before `'unstarted'`.
3. Maintains curricular sequence by sorting on parent module order and topic order:
   $$\text{GlobalSequence} = (\text{ParentOrder} \times 1000) + \text{TopicOrder}$$


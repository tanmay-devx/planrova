# Course Workspaces & Performance Metrics

## 1. Concept & Scope
A Course Workspace is a dedicated academic cockpit that aggregates everything pertaining to an active or past course: syllabus progress, weighted grades, deliverables, deadlines, and lecture schedules.

Implementation: `shared/domain/academic/course.engine.js`.

---

## 2. Key Aggregations & Formulas

### 2.1 Course Syllabus Progress
Progress across the syllabus combines completed count and mastery weights:
$$\text{SyllabusCompletionPercent} = \frac{\text{Completed Topics}}{\text{Total Topics}} \times 100$$
$$\text{MasteryScore} = \frac{100 \times N_{\text{mastered}} + 50 \times N_{\text{learning}} + 0 \times N_{\text{unstarted}}}{\text{Total Topics}}$$

### 2.2 Weighted Course Standing
Pending assessments are not penalized as zero scores. The current standing reflects the score earned out of the completed weight:
$$\text{CurrentScorePercent} = \frac{\sum_{i \in \text{Graded}} \left( \frac{\text{obtainedMarks}_i}{\text{totalMarks}_i} \times \text{weight}_i \right)}{\sum_{i \in \text{Graded}} \text{weight}_i} \times 100$$

### 2.3 Projected Grade Bounds
- **Projected Minimum Score** (Worst case: 0% on all pending deliverables):
  $$\text{MinScore} = \sum_{i \in \text{Graded}} \left( \frac{\text{obtainedMarks}_i}{\text{totalMarks}_i} \times \text{weight}_i \right)$$
- **Projected Maximum Score** (Best case: 100% on all pending deliverables):
  $$\text{MaxScore} = \text{MinScore} + \text{RemainingWeight}$$

---

## 3. Semester Aggregation Summary
`computeSemesterSummary({ semester, courses, topics, assessments, assignments })` rolls up:
1. Total active enrolled credits.
2. Graded credits vs unearned credits.
3. Credit-weighted current SGPA:
   $$\text{SGPA} = \frac{\sum_k \left( \text{Credits}_k \times \text{GradePoints}_k \right)}{\sum_k \text{Credits}_k}$$
4. Credit-weighted overall syllabus progress across all courses.
5. Total pending and overdue assignments.
6. Total estimated study minutes remaining.


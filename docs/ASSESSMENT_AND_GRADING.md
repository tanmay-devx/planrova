# Assessment & Weighted Grading Engine

## 1. Overview
The Assessment and Weighted Grading Engine (`shared/domain/academic/grading.engine.js`) ensures precision-safe gradebook arithmetic across diverse institutional evaluation schemes.

---

## 2. Weight Configuration & Validation
`validateCourseAssessmentWeights(assessments)`:
- Computes $\sum w_i$ across active, non-excused assessments.
- Returns status:
  - `complete`: Total weight is exactly 100%.
  - `underweight`: Total weight < 100%, reporting unallocated percentage.
  - `overweight`: Total weight > 100%, flagging the over-allocation error.

---

## 3. Drop Lowest Policy
Instructors often employ policies such as "drop lowest quiz score".
`computeDetailedGradingBreakdown` supports drop policies:
1. Filters eligible assessments by type (e.g. `type: 'quiz'`).
2. Computes earned ratios $\frac{\text{obtainedMarks}}{\text{totalMarks}}$.
3. Identifies the lowest $K$ scores and marks them with `isDropped = true`.
4. Excludes dropped assessments from completed weight and earned quality points.

---

## 4. What-If Target Grade Simulator
`simulateRequiredAssessmentScore({ assessments, targetPercentage, targetAssessmentId })`:
- Computes points needed:
  $$\text{PointsNeeded} = \text{TargetPercentage} - \text{CompletedContribution}$$
- Calculates required average percentage on remaining work:
  $$\text{RequiredPercentage} = \frac{\text{PointsNeeded}}{\text{RemainingWeight}} \times 100$$
- Validates mathematical feasibility:
  - If $\text{RequiredPercentage} \le 0$: Target is already guaranteed with current marks.
  - If $0 < \text{RequiredPercentage} \le 100$: Target is mathematically achievable.
  - If $\text{RequiredPercentage} > 100$: Target is impossible; returns maximum achievable grade.


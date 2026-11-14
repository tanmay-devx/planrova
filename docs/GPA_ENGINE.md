# GPA Calculator & Multi-Semester Target Simulator

## 1. Overview
The GPA Engine (`shared/domain/academic/gpa.engine.js`) implements credit-weighted grade point calculations across standard grading scales:
- US 4.0 Scale (`letter_4_0`)
- 10-Point Indian/International Scale (`points_10`)
- Percentage Scale (`percentage_100`)

---

## 2. Core Mathematical Formulations

### 2.1 Semester GPA (SGPA)
$$\text{SGPA} = \frac{\sum_{i=1}^N \left( \text{Credits}_i \times \text{GradePoints}_i \right)}{\sum_{i=1}^N \text{Credits}_i}$$

### 2.2 Cumulative GPA (CGPA)
$$\text{CGPA} = \frac{\sum_{j=1}^M \left( \text{Credits}_j \times \text{SGPA}_j \right)}{\sum_{j=1}^M \text{Credits}_j}$$

---

## 3. Multi-Semester Target Simulator
`simulateMultiSemesterTarget({ currentCGPA, completedCredits, upcomingSemesters, targetCGPA, gradingScale })`:
- Computes total cumulative credits:
  $$\text{TotalCredits} = \text{CompletedCredits} + \text{UpcomingCredits}$$
- Computes required quality points:
  $$\text{RequiredQP} = (\text{TargetCGPA} \times \text{TotalCredits}) - (\text{CurrentCGPA} \times \text{CompletedCredits})$$
- Computes required uniform SGPA across upcoming credits:
  $$\text{RequiredSGPA} = \frac{\text{RequiredQP}}{\text{UpcomingCredits}}$$
- Maximum achievable CGPA if student scores maximum grade points on all upcoming credits:
  $$\text{MaxAchievableCGPA} = \frac{(\text{CurrentCGPA} \times \text{CompletedCredits}) + (\text{MaxGradePoint} \times \text{UpcomingCredits})}{\text{TotalCredits}}$$


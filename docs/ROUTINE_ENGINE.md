# Routine Execution & Ritual Planning Engine

## 1. Overview
The Routine Engine (`shared/domain/wellbeing/routine.engine.js`) manages structured rituals (Morning Momentum, Evening Wind Down, Study Preparation, Workout).

---

## 2. Invariants & Data Structures
- **Ordered Steps:** Each step defines `order`, `title`, and `durationMinutes`.
- **Progress Tracking:**
  $$\text{ProgressPercentage} = \frac{\text{CompletedSteps}}{\text{TotalSteps}} \times 100$$
- **Duration Calculation:**
  $$\text{TotalDurationMinutes} = \sum_{s \in \text{Steps}} \text{DurationMinutes}(s)$$
- **Schedule Integration:** Active routines map directly into candidate blocks in Phase 3 Adaptive Planning proposals.


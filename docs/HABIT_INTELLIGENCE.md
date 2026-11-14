# Habit Intelligence & Consistency Engine

## 1. Overview
The Habit Intelligence Engine (`shared/domain/wellbeing/habit.engine.js`) evaluates streaks based on actual schedules, measures weekly and monthly consistency, and delivers supportive, non-guilt-inducing insights.

---

## 2. Streak Evaluation Rules
1. **Schedule-Awareness:**
   - Daily habits evaluate across consecutive calendar days.
   - Weekday habits (Mon-Fri) skip Saturday and Sunday without breaking active streaks.
   - Weekly habits evaluate completion against scheduled target days.
2. **Paused Habits Invariant:** Pausing a habit suspends reminder and schedule generation without penalizing the user or creating artificial "missed day" records.
3. **Deterministic Recalculation:** Editing historical completion dates deterministically recalculates `currentStreak` and `longestStreak` from the sorted unique date set.

---

## 3. Consistency Analytics

### Weekly Completion Rate
$$\text{WeeklyRate} = \frac{\text{CompletedScheduledDaysLast7}}{\text{TotalScheduledDaysLast7}} \times 100$$

### Monthly Completion Rate
$$\text{MonthlyRate} = \frac{\text{CompletedScheduledDaysLast30}}{\text{TotalScheduledDaysLast30}} \times 100$$


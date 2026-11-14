# Planrova 2.0 — Personal Wellbeing & Vitality Domain

**Author:** Principal Software Architect, Full-Stack Engineer, QA Architect  
**Date:** 2026-11-14  
**Document:** `docs/WELLBEING_DOMAIN.md`

---

## 1. Architectural Mission

The Planrova 2.0 Wellbeing Domain (`shared/domain/wellbeing/`) empowers users to build sustainable daily habits, track hydration, execute structured rituals, and record mindful daily reflections without judgment or clinical claims.

All wellbeing logic runs completely on-device in pure JavaScript with zero external dependencies.

---

## 2. Canonical Entities & Engines

### 2.1 Schedule-Aware Habit Streak Engine (`habit.engine.js`)
Represents recurring habits with cadence-aware streak calculation:
- `id`: Unique identifier (`habit_...`).
- `name`: Habit title.
- `frequency`: `{ type: 'daily' | 'weekdays' | 'weekly' | 'custom', days: number[] }`.
- `completionDates`: Authoritative array of `YYYY-MM-DD` completion date strings.
- `currentStreak`: Current active consecutive streak count.
- `longestStreak`: All-time longest streak record.
- `isPaused`: Boolean flag allowing users to pause habits without streak resets.

#### Cadence-Aware Streak Calculation
The streak engine inspects required days based on frequency:
- **Weekdays Only:** If today is Monday and the habit was completed on Friday, the weekend is recognized as non-scheduled; the streak remains unbroken.
- **Weekly / Custom Days:** Non-scheduled days do not penalize the user.
- **Same-Day Idempotency:** Checking a habit multiple times on the same date is idempotent.

---

### 2.2 Millilitre-Level Hydration Engine (`hydration.engine.js`)
Tracks fluid consumption with granular millilitre accuracy:
- `dailyGoalMl`: User's configured daily target (default 2500 ml).
- `logs`: Array of `HydrationLog` entries `[{ id, amountMl, beverageType, loggedAt }]`.
- `beverageType`: `'water' | 'coffee' | 'tea' | 'juice' | 'other'`.

#### Net Hydration Calculation
Accounts for beverage-specific hydration factors (e.g. coffee mild diuretic adjustment):
$$\text{NetHydrationMl} = \sum \left( \text{AmountMl} \times \text{Factor}_{\text{beverage}} \right)$$
- Water: $1.0$
- Juice / Tea: $0.9$
- Coffee: $0.8$

#### Smart Reminder Candidate Slots
The engine analyzes elapsed hours and remaining volume to suggest non-spam reminder candidate slots for Adaptive Planning, preventing clustering reminders too close together.

---

### 2.3 Ritual & Routine Execution Engine (`routine.engine.js`)
Manages structured rituals (Morning Momentum, Evening Wind Down, Study Preparation, Workout):
- **Ordered Steps:** Each step defines `order`, `title`, and `durationMinutes`.
- **Progress Tracking:**
  $$\text{ProgressPercentage} = \frac{\text{CompletedSteps}}{\text{TotalSteps}} \times 100$$
- **Duration Rollup:**
  $$\text{TotalDurationMinutes} = \sum_{s \in \text{Steps}} \text{DurationMinutes}(s)$$
- **Adaptive Scheduling Integration:** Active routines map directly into candidate blocks in Phase 3 Adaptive Planning proposals.

---

### 2.4 Mindful Reflection Check-Ins
Supports private self-reflection without clinical diagnostic claims:
- `energyLevel`: Integer rating between 1 and 5.
- `moodLabel`: `'great' | 'good' | 'neutral' | 'tired' | 'stressed'`.
- `personalNote`: Private reflection text.

#### Strict Privacy Invariant
Personal reflections and emotional ratings are **permanently scrubbed** by the AI context minimization engine and are never transmitted to cloud LLMs or third-party servers.

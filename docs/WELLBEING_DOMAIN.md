# Personal Wellbeing Domain Architecture & Schemas

## 1. Architectural Mission
The Wellbeing Domain (`shared/domain/wellbeing/`) empowers users to build sustainable daily routines, maintain consistent habits, track hydration, and capture mindful daily reflections without judgment or clinical claims.

---

## 2. Canonical Entities

### 2.1 Habit
Preserves Phase 2's canonical habit model:
- `id`: Unique habit identifier.
- `name`: Habit title.
- `frequency`: `{ type: 'daily' | 'weekdays' | 'weekly' | 'custom', days: number[] }`.
- `completionDates`: Authoritative array of `YYYY-MM-DD` completion date strings.
- `currentStreak`: Current active consecutive streak.
- `longestStreak`: All-time longest streak.
- `isPaused`: Boolean flag pausing habit without streak penalty.
- `isArchived`: Boolean flag.

### 2.2 HydrationLog
Tracks daily fluid consumption:
- `id`: Unique identifier (`hyd_...`).
- `userId`: Owner ID.
- `amountMl`: Fluid volume in millilitres.
- `dateKey`: Calendar date (`YYYY-MM-DD`).
- `beverageType`: `'water' | 'coffee' | 'tea' | 'juice' | 'other'`.
- `source`: `'manual' | 'quick_add' | 'shortcut'`.
- `loggedAt`: ISO timestamp.

### 2.3 WellbeingCheckIn
Private daily reflection:
- `id`: Unique identifier (`chk_...`).
- `dateKey`: Calendar date (`YYYY-MM-DD`).
- `energyLevel`: Integer rating between 1 and 5.
- `moodLabel`: `'great' | 'good' | 'neutral' | 'tired' | 'stressed'`.
- `personalNote`: Private reflection text.

### 2.4 Routine
Reusable ritual consisting of ordered steps:
- `id`: Unique identifier (`rtn_...`).
- `title`: Display name (e.g. "Morning Momentum").
- `type`: `'morning' | 'evening' | 'study_prep' | 'workout' | 'wind_down' | 'custom'`.
- `steps`: `[{ id, title, durationMinutes, isCompleted, order }]`.
- `estimatedDurationMinutes`: Total time required.
- `daysOfWeek`: Scheduled days (0-6).
- `preferredTime`: Desired start time (e.g. "07:30").


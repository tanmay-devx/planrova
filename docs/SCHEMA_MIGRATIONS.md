# Planrova 2.0 — Schema Migrations & Backward Compatibility

## 1. Migration Philosophy & Safety Invariants

Planrova 2.0 introduces a unified canonical domain model while strictly maintaining the following non-negotiable data safety invariants:

1. **Zero Destructive Deletions:** No migration script may delete or drop existing user fields.
2. **Dual-Write Compatibility:** Canonical entities written by Planrova 2.0 maintain legacy keys alongside canonical keys (e.g. `desc` alongside `description`, `date` alongside `dueDate`, `completed` alongside `status`).
3. **Idempotence:** Every migration function can be executed multiple times over the same record without duplicating data or altering valid state.
4. **Offline Resilience:** Migrations operate synchronously in-memory upon reading IndexedDB or Firestore data before presenting records to UI components.

---

## 2. Habit Schema Unification

- **Implementation:** [habit.migration.js](file:///home/tanmay/Videos/planrova/shared/domain/migrations/habit.migration.js)
- **Unit Tests:** [habitMigration.test.js](file:///home/tanmay/Videos/planrova/tests/habitMigration.test.js)

### 2.1 The Divergence Problem
Prior to Phase 2:
- **Web Client:** Tracked habits in `user_habits` with a `streak` counter, storing completions in an external key `habit_logs = { 'YYYY-MM-DD': ['habit_name_1', 'habit_name_2'] }`.
- **Mobile Client:** Tracked habits in `habits` with a `fire` counter, storing completions in an inline array `habit.logs = [{ date: 'YYYY-MM-DD' }]`.
- **Result:** Syncing between Web and Mobile resulted in lost streaks, missing completion logs, and inconsistent progress rings.

### 2.2 Canonical Habit Schema
```javascript
{
  id: "h_1731574800000",
  name: "Morning Meditation",
  icon: "sparkles",
  category: "health",
  frequency: { type: "daily", days: [] },
  completionDates: ["2026-11-12", "2026-11-13", "2026-11-14"], // Single Source of Truth
  currentStreak: 3,
  longestStreak: 3,
  // Dual-write legacy mirrors
  streak: 3,
  fire: 3,
  logs: [{ date: "2026-11-12" }, { date: "2026-11-13" }, { date: "2026-11-14" }],
  createdAt: 1731574800000,
  updatedAt: 1731574800000,
  schemaVersion: 1
}
```

### 2.3 Migration Logic (`migrateHabitsToCanonical`)
When loading habits:
1. **Completion Date Extraction:**
   - For each habit, collect dates from `habit.completionDates` (if already canonical).
   - Merge dates from `habit.logs` (mobile objects: `{ date: 'YYYY-MM-DD' }` or plain strings).
   - Merge dates from external web `habit_logs` by matching habit name or ID.
   - Deduplicate into a sorted array of `YYYY-MM-DD` strings.
2. **Deterministic Streak Computation:**
   - Execute `calculateHabitStreaks(completionDates, todayDate)`.
   - Updates `currentStreak` and `longestStreak` using unbroken calendar day sequences.
3. **Legacy Field Mirroring:**
   - Populate `streak = currentStreak`.
   - Populate `fire = currentStreak`.
   - Populate `logs = completionDates.map(date => ({ date }))`.
   - Set `schemaVersion = 1`.

---

## 3. Note-Task Relationship Migration

- **Implementation:** [entity-links.js](file:///home/tanmay/Videos/planrova/shared/domain/relationships/entity-links.js)
- **Unit Tests:** [relationships.test.js](file:///home/tanmay/Videos/planrova/tests/relationships.test.js)

### 3.1 Legacy State
- In Planrova v1, notes optionally included a one-way array `note.linkedTasks = ['t_123']`.
- Tasks had no reference to notes (`task.linkedNoteIds` was non-existent).
- Deleting a task left dangling task IDs inside notes, causing empty or broken chip renders.

### 3.2 Canonical State & Automatic Link Healing
```mermaid
sequenceDiagram
    participant User
    participant TaskModal as Task Edit Modal
    participant NotesDrawer as Note Drawer
    participant Storage as LocalStorage / Sync

    User->>TaskModal: Selects Note to Link
    TaskModal->>Storage: linkNoteAndTask(note, task)
    Note->>Note: Adds task.id to linkedTaskIds & linkedTasks
    Task->>Task: Adds note.id to linkedNoteIds
    Storage->>Storage: Persists both entities with updated timestamps
    Note->>NotesDrawer: Renders linked task checklist item
    Task->>TaskModal: Renders linked note chip
```

### 3.3 Soft-Deletion Cascade Protection
When an entity is deleted, `cleanupDeletedEntityLinks(deletedType, deletedId, entities)` scans the referencing collection:
- `deletedType === 'task'`: All notes containing `deletedId` have that ID removed from `linkedTaskIds` and `linkedTasks`.
- `deletedType === 'note'`: All tasks containing `deletedId` have that ID removed from `linkedNoteIds`.
- The cleaned collection is persisted immediately, preventing orphaned references.

---

## 4. Expense Monetary Representation Migration

- **Implementation:** [expense.schema.js](file:///home/tanmay/Videos/planrova/shared/domain/entities/expense.schema.js)
- **Unit Tests:** [domain.test.js](file:///home/tanmay/Videos/planrova/tests/domain.test.js)

### 4.1 Float Imprecision Hazard
JavaScript floating-point arithmetic causes fractional rounding errors (e.g. `0.1 + 0.2 = 0.30000000000000004`). In budget tracking, aggregating hundreds of floating-point expense amounts produces cumulative rounding drift.

### 4.2 Minor Units Migration
Planrova 2.0 converts all monetary amounts to integer minor units:
- For INR / USD / EUR: 1 unit = 100 minor units (paise / cents).
- Helper function `toMinorUnits(amount)` computes `Math.round(amount * 100)`.
- Helper function `toMajorUnits(amountMinor)` computes `amountMinor / 100`.
- Canonical schema stores both `amountMinor` (for safe integer sums) and `amount` (for legacy UI components).

---

## 5. Rollback & Forward Compatibility Matrix

| Entity | Old Client Reads Phase 2 Record | Phase 2 Client Reads Legacy Record |
| :--- | :--- | :--- |
| **Task** | Reads `title`, `desc`, `date`, `completed` without errors. | Normalizes into `description`, `dueDate`, `status`, `linkedNoteIds`. |
| **Note** | Reads `title`, `content`, `date`, `linkedTasks` without errors. | Normalizes into `linkedTaskIds`, `tags`, `pinned`. |
| **Habit** | Web reads `streak`; Mobile reads `fire` and `logs`. | Migrates into `completionDates` and deterministic streaks. |
| **Expense** | Reads `amount`, `category`, `date`. | Reads `amount`, populates `amountMinor = Math.round(amount * 100)`. |


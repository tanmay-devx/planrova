# Planrova 2.0 — Data Model & Storage Specification

## 1. Entity Overview & Storage Mappings

All local records are stored as serialized key-value pairs in Dexie (`PlanoryLocalDB.kv_store`) and synchronized to Firestore under `/users/{userId}/appData/{key}`.

| Entity Key | Description | Type | Storage Location | Unique Identifier |
| :--- | :--- | :--- | :--- | :--- |
| `tasks` | Planner tasks & timetable items | Array of Task objects | `users/{uid}/appData/tasks` | `id` |
| `user_habits` | Habit configurations & streaks | Array of Habit objects | `users/{uid}/appData/user_habits` | `id` |
| `habit_logs` | Historical dates habit was completed | Object `{ [habitId]: string[] }` | `users/{uid}/appData/habit_logs` | Key |
| `expenses` | Student budget expense logs | Array of Expense objects | `users/{uid}/appData/expenses` | `id` |
| `budget_settings` | Monthly limit & savings targets | Object | `users/{uid}/appData/budget_settings` | Key |
| `notes` | Markdown notes library | Array of Note objects | `users/{uid}/appData/notes` | `date` / `id` |
| `notes_drafts` | Unsaved note drafts | Array of Draft objects | `users/{uid}/appData/notes_drafts` | `date` |
| `hydration_logs` | Beverage & water intake logs | Array of Beverage objects | `users/{uid}/appData/hydration_logs` | `id` |
| `hydration` | Daily hydration state & target | Object `{ water, target }` | `users/{uid}/appData/hydration` | Key |
| `gamification` | XP, level, and vitality score | Object | `users/{uid}/appData/gamification` | Key |
| `pomodoro_stats` | Completed focus rounds & time | Object | `users/{uid}/appData/pomodoro_stats` | Key |
| `pomo_forest` | Planted and dead trees | Array of tree string identifiers | `users/{uid}/appData/pomo_forest` | Index |
| `unlocked_seeds` | Virtual garden seed catalog | Array of seed string IDs | `users/{uid}/appData/unlocked_seeds` | Value |
| `focus_coins` | Virtual currency balance | Integer | `users/{uid}/appData/focus_coins` | Value |
| `brain_dump` | Quick thought inbox | Array of Dump objects | `users/{uid}/appData/brain_dump` | `id` |
| `user_profile` | User name, college, bio, avatar | Object | `users/{uid}/appData/user_profile` | Key |
| `daily_alarms` | Mobile exact alarms configuration | Object | `users/{uid}/appData/daily_alarms` | Key |

---

## 2. Entity Schemas & Validation Rules

### Task Entity
```typescript
interface Task {
  id: string;               // e.g. "task_1700000000_abc"
  title: string;            // Non-empty string, trimmed
  desc: string;             // Optional details
  date: string;             // ISO Date "YYYY-MM-DD"
  startTime: string;        // "HH:MM" (24-hour) or ""
  endTime: string;          // "HH:MM" (24-hour) or ""
  category: 'work' | 'study' | 'health' | 'personal' | 'other';
  priority: 'low' | 'medium' | 'high';
  completed: boolean;       // Completion status
  updated_at: number;       // Epoch timestamp (ms)
  deleted?: boolean;        // Soft-deletion tombstone
}
```

### Habit Entity
```typescript
interface Habit {
  id: string;               // e.g. "h_1"
  name: string;             // Non-empty string
  streak: number;           // Current continuous days (non-negative integer)
  icon: string;             // Ionicons icon name
  logs: string[];           // Array of "YYYY-MM-DD" completion dates
  updated_at: number;       // Epoch timestamp (ms)
  deleted?: boolean;        // Soft-deletion tombstone
}
```

### Expense Entity
```typescript
interface Expense {
  id: string;               // e.g. "exp_1700000000"
  amount: number;           // Floating decimal for UI display (e.g. 150.50)
  amount_minor: number;     // Integer minor units (e.g. 15050 paise/cents)
  category: string;         // 'Food' | 'Transport' | 'Books' | 'Entertainment' | 'Other'
  notes: string;            // Description
  date: string;             // "YYYY-MM-DD"
  updated_at: number;       // Epoch timestamp (ms)
  deleted?: boolean;        // Soft-deletion tombstone
}
```

### Note Entity
```typescript
interface Note {
  id: string;               // e.g. "note_2026-11-14"
  date: string;             // "YYYY-MM-DD"
  title: string;            // Note title
  content: string;          // Formatted HTML / Markdown
  pinned: boolean;          // Whether pinned to weekly grid column
  tags: string[];           // Topic tags
  linkedTasks: string[];    // Task IDs referenced inside note
  updated_at: number;       // Epoch timestamp (ms)
  deleted?: boolean;        // Soft-deletion tombstone
}
```

### Hydration Log Entity
```typescript
interface HydrationLog {
  id: string;               // e.g. "h_1700000000"
  amount: number;           // Milliliters (+250 for water, -150 for diuretic coffee)
  type: string;             // "Water" | "Coffee" | "Tea" | "Juice"
  date: string;             // "YYYY-MM-DD"
  timestamp: number;        // Epoch timestamp (ms)
  updated_at: number;       // Epoch timestamp (ms)
  deleted?: boolean;        // Soft-deletion tombstone
}
```

---

## 3. Migration Strategy & Backward Compatibility

1. **Dexie Version Upgrades:**
   - Dexie schema migrations are strictly additive.
   - Version 1 tables remain untouched.
   - Version 2 adds compound indexes `[user_id+id]`, `user_id`, and `retry_count`.
   - Upgrade hook populates legacy unpartitioned records with `user_id: 'local'` and `retry_count: 0`.

2. **Currency Minor Units Migration:**
   - Any legacy expense missing `amount_minor` is lazily converted via `toMinorUnits(amount)` during UI aggregation and write cycles.
   - New records persist both `amount` and `amount_minor`.

3. **Tombstone Cleanup (Garbage Collection):**
   - Tombstones (`deleted: true`) are retained in IndexedDB and Firestore during active synchronization to notify peer devices.
   - A scheduled cleanup purges tombstones older than 30 days once all active devices have acknowledged the deletion.


# Phase 5 Storage, Multi-Tenant Isolation & Sync Architecture

## 1. Storage Layers & Tenant Isolation
Phase 5 utilizes Planrova's local-first storage architecture across Web and Mobile:
- **Web Persistence:** Scoped IndexedDB tables (`kv_store` in Dexie) keyed as `${userId}:${storageKey}`.
- **Mobile Persistence:** Cloud Firestore subcollections under `/users/{userId}/appData/{document=**}`.
- **In-Memory Cache:** Zero-latency reads and writes for 60fps UI rendering. `clearMemoryCache()` wipes in-memory records upon account logout.

---

## 2. Storage Keys
All finance and wellbeing records are isolated under dedicated storage keys:
- `finance_accounts`
- `finance_transactions`
- `finance_budgets`
- `finance_recurring_payments`
- `finance_subscriptions`
- `finance_savings_goals`
- `finance_categories`
- `user_habits`
- `habit_logs`
- `hydration_logs`
- `hydration_settings`
- `wellbeing_check_ins`
- `wellbeing_routines`

---

## 3. Safe Migrations
Legacy `budget_settings` and `expenses` are migrated seamlessly into `finance_budgets`, `finance_savings_goals`, and `finance_transactions` with `amountMinor` integer representations without overwriting valid historical records.


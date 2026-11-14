# Hydration Tracking & Reminder System

## 1. Overview
The Hydration System (`shared/domain/wellbeing/hydration.engine.js`) tracks daily fluid intake, provides quick-add logging, and generates non-spam reminder candidate slots.

---

## 2. Invariants
1. **Millilitres Authoritative:** Volumes are stored and aggregated strictly in millilitres (ml).
2. **User-Defined Goals:** Goals are configured by the user (default 2000ml). The system never infers medical requirements or offers clinical advice.
3. **Daily Resets:** Daily hydration rollups reset strictly at local date boundaries (`YYYY-MM-DD`).

---

## 3. Reminder Slot Calculation
`generateHydrationReminderSlots({ wakeTime, sleepTime, intervalMinutes })` computes candidate reminder times during active hours:
- Skips quiet hours and sleep intervals.
- Distributes slots every $N$ minutes (e.g. 90 or 120 minutes).
- Generates optional suggestions that integrate seamlessly into daily planning.


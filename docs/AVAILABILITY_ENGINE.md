# Availability Engine & Temporal Resolution
**Planrova 2.0 — Phase 3 Specification**

---

## 1. Overview

The Availability Engine (`shared/domain/scheduling/availability.engine.js`) calculates genuine user free time for any calendar date by resolving recurring rules, exceptions, timetables, and commitments.

---

## 2. Multi-Layer Availability Resolution Pipeline

```
[Default Working Hours (e.g. 09:00 - 18:00)]
                     │
                     ▼
[Weekday Rule Override (0=Sunday ... 6=Saturday)]
                     │
                     ▼
[Date Exception Check (Holidays, Sick Leaves, Travel)]
                     │
                     ▼
[All-Day Event Check (Reserves Full Day Capacity)]
                     │
                     ▼
[Timed Calendar Events & Recurring Timetable Materialization]
                     │
                     ▼
[Reserved Lunch Break Deduction]
                     │
                     ▼
[Final Free Time Intervals: [{ start, end }]]
```

---

## 3. Temporal Handling & Edge Cases

### IANA Timezones & Local Semantics
- Availability profiles preserve the user's configured IANA timezone (e.g. `Asia/Kolkata`, `America/New_York`).
- Dates are evaluated with local date semantics (`YYYY-MM-DD`).

### Multi-Day Chronologically Comparable Deadlines
Deadlines are converted into chronological minutes from midnight of the target date:
$$\text{resolvedDeadlineMinutes} = (\text{dayDifference} \times 1440) + \text{deadlineMinuteOnThatDay}$$
- A task due tomorrow at 12:00 has $\text{resolvedDeadlineMinutes} = 1440 + 720 = 2160\text{ min}$.
- A date-only deadline expires at the end of the working day ($18:00 = 1080\text{ min}$), NOT midnight start.

### Cross-Midnight Commitments
Any event or lecture with $\text{endTime} \le \text{startTime}$ (e.g., 23:00 to 02:00) is split across the midnight boundary:
- Part 1: `23:00 – 24:00` on date $D$.
- Part 2: `00:00 – 02:00` on date $D+1$.
Only the segment relevant to the target date is materialized into that day's availability calculation.


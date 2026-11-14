# Recurring Payments & Subscription Intelligence

## 1. Overview
The Recurring Payment Engine (`shared/domain/finance/recurring.engine.js`) manages recurring bills, subscriptions, and regular financial obligations.

---

## 2. Core Invariants
1. **Expected Obligation, Not Auto-Expense:** A recurring payment represents a forecasted commitment. It never automatically marks itself as paid or deducts money from user accounts without confirmation.
2. **Month-End & Leap-Year Boundary Clamping:**
   - When recurring on day 31, stepping into February clamps to day 28 (or 29 in leap years).
   - Stepping into April, June, September, or November clamps to day 30.
   - Prevents unintended month-shifting into March or May.
3. **Idempotent Mark-as-Paid:**
   - Marking a bill occurrence as paid verifies `periodDueDate` against `paymentHistory`.
   - Re-submitting payment for the same period throws an error, preventing duplicate expense records.
   - Advances `nextDueDate` cleanly using deterministic interval arithmetic.

---

## 3. Lookahead Projections
`getUpcomingRecurringOccurrences(recurringPayments, { startDate, lookaheadDays })` projects future bill obligations without creating persistent records, feeding into both UI countdowns and Phase 3 schedule proposal generation.


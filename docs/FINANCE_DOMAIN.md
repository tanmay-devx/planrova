# Planrova 2.0 — Personal Finance Domain

**Author:** Principal Software Architect, Senior Full-Stack Engineer, QA Architect  
**Date:** 2026-11-14  
**Document:** `docs/FINANCE_DOMAIN.md`

---

## 1. Architectural Mission

The Planrova 2.0 Personal Finance Domain (`shared/domain/finance/`) provides a local-first, privacy-respecting, mathematically rigorous financial intelligence system for students and professionals.

The core design invariant:
$$\mathbf{Authoritative\ Money} \in \mathbb{Z} \quad (\text{Integer Minor Currency Units, e.g. Paise or Cents})$$
Floating-point values (e.g. `150.50`) are never used as authoritative representations in storage, calculations, or sync payloads. Floating points are derived dynamically only for user-facing display formatting.

---

## 2. Canonical Entities & Schemas

### 2.1 FinancialAccount (`account.engine.js`)
Represents a cash wallet, bank account, or digital payment pool:
- `id`: Unique identifier (`acc_...`).
- `userId`: Scoped owner user ID.
- `name`: Display label (e.g. "Main Bank", "Cash Wallet").
- `accountType`: `'cash' | 'bank' | 'savings' | 'digital_wallet' | 'other'`.
- `currency`: 3-letter ISO code (`INR`, `USD`, `EUR`).
- `openingBalanceMinor`: Authoritative opening balance in integer minor units.
- `currentBalanceMinor`: Reconciled balance derived from opening balance + non-deleted transactions.
- `isArchived`: Boolean flag for retired accounts.

### 2.2 Transaction (`transaction.engine.js`)
Represents an individual financial transaction:
- `id`: Unique identifier (`txn_...`).
- `userId`: Owner user ID.
- `accountId`: Primary source account ID.
- `toAccountId`: Destination account ID (for `transfer` type).
- `type`: `'income' | 'expense' | 'transfer'`.
- `amountMinor`: Positive integer minor units.
- `currency`: Currency code.
- `categoryId`: Category ID (e.g. `cat_food`, `cat_transport`).
- `title`: Short transaction summary.
- `transactionDate`: Local calendar date (`YYYY-MM-DD`).
- `paymentMethod`: `'cash' | 'card' | 'upi' | 'bank' | 'other'`.
- `idempotencyKey`: Deterministic submission key preventing duplicate transactions.
- `isRefund`: Boolean flag indicating a refund credit.
- `deletedAt`: ISO timestamp for soft deletion (tombstone).

### 2.3 Budget (`budget.engine.js`)
Represents a spending ceiling:
- `id`: Unique identifier (`bgt_...`).
- `categoryId`: Category target (`null` for overall monthly budget).
- `period`: `'monthly' | 'weekly' | 'custom'`.
- `limitMinor`: Spending ceiling in integer minor units.
- `alertThreshold`: Percentage at which warnings trigger (default 80%).

### 2.4 RecurringPayment & Subscription (`recurring.engine.js`)
Represents regular financial commitments:
- `frequency`: `'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'`.
- `interval`: Step interval count (e.g. every 2 weeks).
- `nextDueDate`: Calendar date of next anticipated occurrence (`YYYY-MM-DD`).
- `paymentHistory`: Audit trail of paid occurrences `[{ paidDate, amountMinor, transactionId, periodDueDate }]`.

### 2.5 SavingsGoal (`savings.engine.js`)
Represents a targeted financial savings objective:
- `targetAmountMinor`: Target goal in minor units.
- `currentAmountMinor`: Accumulated savings in minor units.
- `targetDate`: Target completion date (`YYYY-MM-DD`).

---

## 3. Financial Intelligence Engines

### 3.1 Account Balance Reconciliation & Transfers
`reconcileAccountBalance(account, transactions)`:
- Dynamically iterates over non-deleted transactions belonging to the account:
  $$\text{CurrentBalance} = \text{OpeningBalance} + \sum \text{Income} - \sum \text{Expense} + \sum \text{TransfersIn} - \sum \text{TransfersOut}$$
- Transfers between user accounts update source and destination balances while cleanly isolating transfers from spending / income analytics.

### 3.2 Budget Utilization & Spending Velocity
`calculateBudgetStatus({ budget, transactions, referenceDate })`:
- Computes spending progress:
  $$\text{Utilization} = \frac{\text{SpentMinor}}{\text{LimitMinor}} \times 100$$
- Projects end-of-month velocity based on elapsed days vs total days in month:
  $$\text{ProjectedSpent} = \frac{\text{SpentMinor}}{\text{DaysElapsed}} \times \text{TotalDaysInMonth}$$
- Emits alert states: `normal` ($<80\%$), `warning` ($80\%–100\%$), `exceeded` ($>100\%$).

### 3.3 Savings Goal Pacing & Feasibility
`calculateSavingsGoalPacing({ goal, referenceDate })`:
- Computes required contribution pacing per month/week to reach the goal:
  $$\text{RemainingMinor} = \text{TargetMinor} - \text{CurrentMinor}$$
  $$\text{RequiredMonthlyContribution} = \frac{\text{RemainingMinor}}{\text{MonthsRemaining}}$$

---

## 4. Fault-Tolerance & Interrupted Operation Recovery

The recurring payments engine (`recurring.engine.js`) guarantees ledger consistency across 8 critical failure scenarios:

1. **Idempotent Replay (`allowIdempotentReplay`):** Submitting identical payment executions with matching periods returns the existing transaction ID without double-billing.
2. **Ledger Reconciliation (`reconcileRecurringPaymentState`):** If a process crash occurs after creating a ledger transaction but before updating the recurring schedule, reconciliation detects the orphaned transaction and advances `nextDueDate` automatically.
3. **Occurrence Reversal (`reverseRecurringPaymentOccurrence`):** If a user reverses a payment, the associated transaction is soft-deleted and `nextDueDate` rolls back to the prior due date cleanly.
4. **Tombstone Preservation:** Soft-deleted transactions are never resurrected during sync operations, and balance recalculation permanently excludes them.

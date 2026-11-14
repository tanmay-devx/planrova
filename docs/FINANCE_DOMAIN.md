# Personal Finance Domain Architecture & Schemas

## 1. Architectural Mission
The Planrova 2.0 Personal Finance Domain provides a local-first, privacy-respecting, and mathematically rigorous financial intelligence system for students and professionals.

Its central design principle:
$$\text{Authoritative Money} \in \mathbb{Z} \quad (\text{Integer Minor Currency Units, e.g. Paise / Cents})$$
Floating-point values (e.g. `150.50`) are never used as authoritative representations of monetary values in storage or calculations. They are only derived dynamically for user-facing UI formatting.

---

## 2. Canonical Entities & Schemas

### 2.1 FinancialAccount
Represents a user's wallet, bank account, or digital cash pool:
- `id`: Unique identifier (`acc_...`).
- `userId`: Scoped owner ID.
- `name`: Display label (e.g. "Main Bank", "Cash Wallet").
- `accountType`: `'cash' | 'bank' | 'savings' | 'digital_wallet' | 'other'`.
- `currency`: 3-letter ISO code (`INR`, `USD`, `EUR`, etc.).
- `openingBalanceMinor`: Authoritative opening balance in integer minor units.
- `currentBalanceMinor`: Reconciled balance derived from opening balance + non-deleted transactions.
- `isArchived`: Boolean flag for retired accounts.

### 2.2 Transaction
Represents an individual financial transaction:
- `id`: Unique identifier (`txn_...`).
- `userId`: Owner ID.
- `accountId`: Primary account ID.
- `toAccountId`: Destination account ID (for `transfer` type).
- `type`: `'income' | 'expense' | 'transfer'`.
- `amountMinor`: Positive integer minor units.
- `currency`: Currency code.
- `categoryId`: Category ID (e.g. `cat_food`, `cat_transport`).
- `title`: Short transaction summary.
- `description`: Detailed notes.
- `transactionDate`: Local calendar date (`YYYY-MM-DD`).
- `paymentMethod`: `'cash' | 'card' | 'upi' | 'bank' | 'other'`.
- `idempotencyKey`: Optional deterministic submission key preventing duplicate transactions.
- `isRefund`: Boolean flag indicating a refund expense.
- `deletedAt`: ISO timestamp for soft deletion.

### 2.3 Budget
Represents a spending ceiling:
- `id`: Unique identifier (`bgt_...`).
- `userId`: Owner ID.
- `name`: Budget label (e.g. "Food Budget", "Overall Monthly").
- `categoryId`: Optional category target (`null` for overall budget).
- `period`: `'monthly' | 'weekly' | 'custom'`.
- `limitMinor`: Spending ceiling in minor units.
- `alertThreshold`: Percentage at which warnings trigger (default 80%).
- `rolloverEnabled`: Boolean flag for unused or deficit budget rollover.

### 2.4 RecurringPayment & Subscription
Represents regular financial obligations:
- `frequency`: `'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'`.
- `interval`: Step interval count (e.g. every 2 weeks).
- `nextDueDate`: Calendar date of next anticipated occurrence.
- `paymentHistory`: Audit trail of paid periods `[{ paidDate, amountMinor, transactionId, periodDueDate }]`.

### 2.5 SavingsGoal
Represents a savings target:
- `targetAmountMinor`: Target goal in minor units.
- `currentAmountMinor`: Accumulated savings in minor units.
- `targetDate`: Optional target deadline.
- `contributions`: Detailed ledger of manual contributions.
- `isCompleted`: Boolean flag set when `currentAmountMinor >= targetAmountMinor`.

---

## 3. Financial Invariants
1. **Transfers Never Inflate Cashflow:** Consolidated income and expense calculations strictly omit `transfer` transactions.
2. **Deterministic Reconciliation:** Account balances always equal:
   $$\text{CurrentBalance}(A) = \text{OpeningBalance}(A) + \sum_{T \in \text{Income}(A)} \text{Amount}(T) - \sum_{T \in \text{Expense}(A)} \text{Amount}(T) \pm \sum_{T \in \text{Transfers}(A)} \text{Amount}(T)$$
3. **No Automatic Fund Transfers:** Planrova never connects to live bank rails or initiates automated fund movement.


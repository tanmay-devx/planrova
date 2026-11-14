/**
 * src/modules/finance/finance.ui.js
 * Dedicated Finance Workspace View for Planrova 2.0 Web Application.
 *
 * Implements:
 * - Financial Overview (Income, Expenses, Net Cashflow, Account balances)
 * - Budget Progress & Spending Status
 * - Upcoming Bills & Subscriptions
 * - Savings Goals & Contribution Trackers
 * - Transaction Management (Add Income/Expense/Transfer, Search, Delete)
 */

import {
  getStoredAccounts,
  getStoredTransactions,
  saveStoredTransaction,
  deleteStoredTransaction,
  getStoredBudgets,
  saveStoredBudget,
  getStoredRecurringPayments,
  saveStoredRecurringPayment,
  getStoredSavingsGoals,
  saveStoredSavingsGoal,
  migrateLegacyBudgetAndExpenses
} from './finance-storage.js';
import { calculateConsolidatedTotals, queryTransactions } from '../../../shared/domain/finance/transaction.engine.js';
import { evaluateAllBudgets } from '../../../shared/domain/finance/budget.engine.js';
import { getUpcomingRecurringOccurrences, recordRecurringPaymentPaid } from '../../../shared/domain/finance/recurring.engine.js';
import { evaluateSavingsGoal, recordSavingsContribution } from '../../../shared/domain/finance/savings.engine.js';
import { formatCurrency, toMinorUnits } from '../../../shared/domain/finance/finance.utils.js';
import { DEFAULT_FINANCIAL_CATEGORIES } from '../../../shared/domain/finance/finance.types.js';

let isInitialized = false;

export function initFinanceWorkspace() {
  migrateLegacyBudgetAndExpenses();
  renderFinanceWorkspace();
  if (!isInitialized) {
    setupFinanceEventListeners();
    isInitialized = true;
  }
}

export function renderFinanceWorkspace() {
  const container = document.getElementById('finance-workspace-content');
  if (!container) return;

  const accounts = getStoredAccounts();
  const txns = getStoredTransactions();
  const budgets = getStoredBudgets();
  const recurring = getStoredRecurringPayments();
  const savingsGoals = getStoredSavingsGoals();

  const nowStr = new Date().toISOString().slice(0, 10);
  const currentMonthStart = `${nowStr.slice(0, 7)}-01`;
  const currentMonthEnd = `${nowStr.slice(0, 7)}-31`;

  // 1. Consolidated totals for current month
  const monthlyTotals = calculateConsolidatedTotals(txns, {
    startDate: currentMonthStart,
    endDate: currentMonthEnd
  });

  // 2. Budget evaluations
  const budgetSummary = evaluateAllBudgets(budgets, txns, nowStr);

  // 3. Upcoming recurring obligations (next 14 days)
  const upcomingBills = getUpcomingRecurringOccurrences(recurring, {
    startDate: nowStr,
    lookaheadDays: 14
  });

  // 4. Savings goals evaluations
  const evaluatedGoals = savingsGoals.map(g => evaluateSavingsGoal(g, nowStr));

  // Render HTML structure
  container.innerHTML = `
    <div class="finance-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 style="margin:0; font-size:24px; font-weight:700;">Personal Finance</h2>
        <p style="margin:4px 0 0; color:var(--text-secondary); font-size:14px;">Local-first money, budget & savings intelligence</p>
      </div>
      <div style="display:flex; gap:10px;">
        <button id="btn-add-txn" class="btn btn-primary" style="display:flex; align-items:center; gap:6px;">
          <span>+</span> Add Transaction
        </button>
        <button id="btn-add-budget" class="btn btn-secondary">Set Budget</button>
        <button id="btn-add-goal" class="btn btn-secondary">New Goal</button>
      </div>
    </div>

    <!-- Summary Metrics Cards -->
    <div class="finance-metrics-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
      <div class="metric-card" style="background:var(--bg-secondary); padding:16px; border-radius:12px; border:1px solid var(--border-color);">
        <div style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Monthly Income</div>
        <div style="font-size:22px; font-weight:700; color:#10B981; margin-top:4px;">${formatCurrency(monthlyTotals.totalIncomeMinor)}</div>
      </div>
      <div class="metric-card" style="background:var(--bg-secondary); padding:16px; border-radius:12px; border:1px solid var(--border-color);">
        <div style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Monthly Expenses</div>
        <div style="font-size:22px; font-weight:700; color:#EF4444; margin-top:4px;">${formatCurrency(monthlyTotals.totalExpenseMinor)}</div>
      </div>
      <div class="metric-card" style="background:var(--bg-secondary); padding:16px; border-radius:12px; border:1px solid var(--border-color);">
        <div style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Net Cashflow</div>
        <div style="font-size:22px; font-weight:700; color:${monthlyTotals.netCashflowMinor >= 0 ? '#10B981' : '#EF4444'}; margin-top:4px;">
          ${formatCurrency(monthlyTotals.netCashflowMinor)}
        </div>
      </div>
      <div class="metric-card" style="background:var(--bg-secondary); padding:16px; border-radius:12px; border:1px solid var(--border-color);">
        <div style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Remaining Budget</div>
        <div style="font-size:22px; font-weight:700; color:var(--accent-color); margin-top:4px;">${formatCurrency(budgetSummary.totalRemainingMinor)}</div>
      </div>
    </div>

    <!-- Active Accounts & Budgets Row -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:24px;">
      <!-- Accounts Section -->
      <div class="card" style="background:var(--bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--border-color);">
        <h3 style="margin:0 0 14px; font-size:16px; font-weight:600;">Accounts & Wallets</h3>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${accounts.map(acc => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-primary); border-radius:8px;">
              <div>
                <div style="font-weight:600; font-size:14px;">${acc.name}</div>
                <div style="font-size:11px; color:var(--text-secondary); text-transform:capitalize;">${acc.accountType}</div>
              </div>
              <div style="font-weight:700; font-size:15px;">${formatCurrency(acc.currentBalanceMinor, acc.currency)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Budget Progress Section -->
      <div class="card" style="background:var(--bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--border-color);">
        <h3 style="margin:0 0 14px; font-size:16px; font-weight:600;">Active Budgets</h3>
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${budgetSummary.evaluations.map(b => {
            const statusColor = b.status === 'exceeded' ? '#EF4444' : (b.status === 'approaching_limit' ? '#F59E0B' : '#10B981');
            return `
              <div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px;">
                  <span style="font-weight:600;">${b.name}</span>
                  <span style="color:${statusColor}; font-weight:600;">${b.utilizationPercentage}% (${formatCurrency(b.totalSpentMinor)} / ${formatCurrency(b.limitMinor)})</span>
                </div>
                <div style="height:8px; background:var(--bg-primary); border-radius:4px; overflow:hidden;">
                  <div style="width:${Math.min(100, b.utilizationPercentage)}%; height:100%; background:${statusColor}; transition:width 0.3s;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Savings Goals & Upcoming Bills Row -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:24px;">
      <!-- Savings Goals -->
      <div class="card" style="background:var(--bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--border-color);">
        <h3 style="margin:0 0 14px; font-size:16px; font-weight:600;">Savings Goals</h3>
        ${evaluatedGoals.length === 0 ? '<p style="font-size:13px; color:var(--text-secondary);">No active savings goals. Create one to track your milestones.</p>' : ''}
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${evaluatedGoals.map(g => `
            <div style="padding:12px; background:var(--bg-primary); border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:600; font-size:14px;">${g.title}</span>
                <span style="font-size:12px; font-weight:700; color:#84CC16;">${g.progressPercentage}%</span>
              </div>
              <div style="height:6px; background:var(--bg-secondary); border-radius:3px; overflow:hidden; margin-bottom:6px;">
                <div style="width:${g.progressPercentage}%; height:100%; background:#84CC16;"></div>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-secondary);">
                <span>Saved: ${formatCurrency(g.currentAmountMinor)}</span>
                <span>Target: ${formatCurrency(g.targetAmountMinor)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Upcoming Recurring Obligations -->
      <div class="card" style="background:var(--bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--border-color);">
        <h3 style="margin:0 0 14px; font-size:16px; font-weight:600;">Upcoming Bills (Next 14 Days)</h3>
        ${upcomingBills.length === 0 ? '<p style="font-size:13px; color:var(--text-secondary);">No recurring payments due in the next 14 days.</p>' : ''}
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${upcomingBills.map(bill => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-primary); border-radius:8px;">
              <div>
                <div style="font-weight:600; font-size:13px;">${bill.title}</div>
                <div style="font-size:11px; color:var(--text-secondary);">Due: ${bill.dueDate}</div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:700; font-size:14px;">${formatCurrency(bill.amountMinor, bill.currency)}</span>
                <button class="btn btn-sm btn-secondary btn-mark-paid" data-rec-id="${bill.recurringPaymentId}" data-due="${bill.dueDate}" style="font-size:11px; padding:4px 8px;">Pay</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Recent Transactions Section -->
    <div class="card" style="background:var(--bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--border-color);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="margin:0; font-size:16px; font-weight:600;">Recent Transactions</h3>
        <input type="text" id="finance-search-input" placeholder="Search transactions..." style="padding:6px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--text-primary); font-size:13px; width:220px;">
      </div>
      <div id="finance-txn-list" style="display:flex; flex-direction:column; gap:8px;">
        ${renderTransactionRows(txns.slice(0, 20))}
      </div>
    </div>
  `;
}

function renderTransactionRows(transactions = []) {
  if (transactions.length === 0) {
    return '<p style="font-size:13px; color:var(--text-secondary); text-align:center; padding:20px;">No transactions found.</p>';
  }

  return transactions.map(t => {
    const isIncome = t.type === 'income';
    const isTransfer = t.type === 'transfer';
    const amountColor = isIncome ? '#10B981' : (isTransfer ? '#3B82F6' : '#EF4444');
    const prefix = isIncome ? '+' : (isTransfer ? '⇄ ' : '-');

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-primary); border-radius:8px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="font-size:18px;">${isIncome ? '💵' : (isTransfer ? '⇄' : '💸')}</div>
          <div>
            <div style="font-weight:600; font-size:14px;">${t.title}</div>
            <div style="font-size:11px; color:var(--text-secondary);">${t.transactionDate} • ${t.paymentMethod}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-weight:700; font-size:15px; color:${amountColor};">${prefix}${formatCurrency(t.amountMinor, t.currency)}</span>
          <button class="btn-delete-txn" data-id="${t.id}" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:14px;" title="Delete">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function setupFinanceEventListeners() {
  document.addEventListener('click', (e) => {
    // Add Transaction Modal
    if (e.target.closest('#btn-add-txn')) {
      showAddTransactionModal();
    }
    // Delete Transaction
    if (e.target.closest('.btn-delete-txn')) {
      const btn = e.target.closest('.btn-delete-txn');
      const id = btn.getAttribute('data-id');
      if (confirm('Delete this transaction?')) {
        deleteStoredTransaction(id);
        renderFinanceWorkspace();
      }
    }
    // Pay recurring bill
    if (e.target.closest('.btn-mark-paid')) {
      const btn = e.target.closest('.btn-mark-paid');
      const recId = btn.getAttribute('data-rec-id');
      const due = btn.getAttribute('data-due');
      handlePayRecurringBill(recId, due);
    }
  });

  // Search input
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'finance-search-input') {
      const query = e.target.value;
      const allTxns = getStoredTransactions();
      const filtered = queryTransactions(allTxns, { searchQuery: query });
      const container = document.getElementById('finance-txn-list');
      if (container) {
        container.innerHTML = renderTransactionRows(filtered);
      }
    }
  });
}

function handlePayRecurringBill(recurringPaymentId, dueDate) {
  const recurring = getStoredRecurringPayments();
  const item = recurring.find(r => r.id === recurringPaymentId);
  if (!item) return;

  try {
    const { updatedRecurring, transaction } = recordRecurringPaymentPaid(item, {
      paidDate: new Date().toISOString().slice(0, 10)
    });
    saveStoredRecurringPayment(updatedRecurring);
    saveStoredTransaction(transaction);
    alert(`Payment recorded for ${item.title}`);
    renderFinanceWorkspace();
  } catch (err) {
    alert(err.message);
  }
}

function showAddTransactionModal() {
  const accounts = getStoredAccounts();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000;';
  
  modal.innerHTML = `
    <div style="background:var(--bg-secondary); padding:24px; border-radius:14px; width:90%; max-width:420px; border:1px solid var(--border-color);">
      <h3 style="margin:0 0 16px; font-size:18px; font-weight:700;">Add Transaction</h3>
      <form id="form-add-txn" style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text-secondary);">Type</label>
          <select id="txn-type" style="width:100%; padding:8px; border-radius:8px; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text-secondary);">Title</label>
          <input type="text" id="txn-title" required placeholder="e.g. Groceries, Salary, Dinner" style="width:100%; padding:8px; border-radius:8px; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">
        </div>
        <div>
          <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text-secondary);">Amount</label>
          <input type="number" step="0.01" id="txn-amount" required placeholder="0.00" style="width:100%; padding:8px; border-radius:8px; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">
        </div>
        <div>
          <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text-secondary);">Account</label>
          <select id="txn-account" style="width:100%; padding:8px; border-radius:8px; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">
            ${accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.currentBalanceMinor, a.currency)})</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text-secondary);">Date</label>
          <input type="date" id="txn-date" value="${new Date().toISOString().slice(0, 10)}" style="width:100%; padding:8px; border-radius:8px; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
          <button type="button" id="btn-cancel-txn" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#btn-cancel-txn').onclick = () => modal.remove();
  modal.querySelector('#form-add-txn').onsubmit = (e) => {
    e.preventDefault();
    const type = modal.querySelector('#txn-type').value;
    const title = modal.querySelector('#txn-title').value;
    const amountFloat = parseFloat(modal.querySelector('#txn-amount').value);
    const accountId = modal.querySelector('#txn-account').value;
    const date = modal.querySelector('#txn-date').value;

    saveStoredTransaction({
      type,
      title,
      amountMinor: toMinorUnits(amountFloat),
      accountId,
      transactionDate: date,
      currency: 'INR'
    });

    modal.remove();
    renderFinanceWorkspace();
  };
}


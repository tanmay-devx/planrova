/**
 * shared/domain/entities/expense.schema.js
 * Canonical Expense Schema & Validation for Planrova 2.0
 */

export const EXPENSE_CATEGORIES = Object.freeze([
  'Food', 
  'Transport', 
  'Study', 
  'Entertainment', 
  'Bills', 
  'Health', 
  'Shopping', 
  'Other'
]);

/**
 * Validates a canonical Expense object.
 */
export function validateExpense(expense) {
  const errors = [];
  if (!expense || typeof expense !== 'object') {
    return { valid: false, errors: ['Expense must be an object'] };
  }

  if (!expense.id || typeof expense.id !== 'string') {
    errors.push('Expense id is required and must be a string');
  }

  if (typeof expense.amountMinor !== 'number' || !Number.isInteger(expense.amountMinor) || expense.amountMinor <= 0) {
    errors.push('amountMinor must be a positive integer representing minor currency units (paise/cents)');
  }

  if (!expense.currency || typeof expense.currency !== 'string') {
    errors.push('currency must be a valid 3-letter currency code (e.g. INR)');
  }

  if (expense.date && !/^\d{4}-\d{2}-\d{2}$/.test(expense.date)) {
    errors.push('date must be in YYYY-MM-DD format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Converts a major unit amount (e.g. ₹150.50) to integer minor units (e.g. 15050 paise).
 */
export function toMinorUnits(amount) {
  if (typeof amount === 'number' && Number.isInteger(amount) && amount > 1000) {
    // If already large integer, assume minor units
    return amount;
  }
  const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Converts integer minor units (15050 paise) to major units (150.50).
 */
export function toMajorUnits(amountMinor) {
  if (typeof amountMinor !== 'number' || isNaN(amountMinor)) return 0;
  return amountMinor / 100;
}

/**
 * Normalizes any expense (legacy or new) into the Canonical Expense schema.
 */
export function normalizeExpense(raw = {}) {
  const now = Date.now();
  const id = raw.id || `exp_${now}_${Math.floor(Math.random() * 1000)}`;
  
  // Amount resolution: handle legacy 'amount' (major or minor) vs canonical 'amountMinor'
  let amountMinor = 0;
  if (typeof raw.amountMinor === 'number' && Number.isInteger(raw.amountMinor)) {
    amountMinor = raw.amountMinor;
  } else if (raw.amount !== undefined) {
    amountMinor = toMinorUnits(raw.amount);
  }

  const description = (raw.description || raw.desc || raw.notes || 'Expense').trim();
  const category = raw.category || 'Other';
  const currency = raw.currency || 'INR';
  const date = raw.date || new Date().toISOString().split('T')[0];
  const paymentMethod = raw.paymentMethod || 'other';

  return {
    ...raw,
    id,
    amountMinor,
    // Preserve legacy 'amount' as major unit float for backwards-compatibility:
    amount: toMajorUnits(amountMinor),
    description,
    desc: description,
    category,
    currency,
    date,
    paymentMethod,
    createdAt: raw.createdAt || raw.created_at || now,
    updatedAt: raw.updatedAt || raw.updated_at || now,
    deleted: Boolean(raw.deleted),
    schemaVersion: 1
  };
}


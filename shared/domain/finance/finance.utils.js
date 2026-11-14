/**
 * shared/domain/finance/finance.utils.js
 * Pure mathematical, date, and currency utilities for Planrova 2.0 Finance Domain.
 *
 * Invariants:
 * 1. Integer minor units are authoritative for money representations (e.g. 10000 = ₹100.00 / $100.00).
 * 2. Deterministic recurrence math with safe month-end & leap-year handling.
 * 3. 100% platform-independent; zero external dependencies.
 */

/**
 * Converts a major unit amount (e.g. 150.50) to integer minor units (e.g. 15050 paise/cents).
 */
export function toMinorUnits(amount) {
  const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (typeof parsed !== 'number' || isNaN(parsed) || !isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Converts integer minor units (15050 paise/cents) to major units (150.50).
 */
export function toMajorUnits(amountMinor) {
  if (typeof amountMinor !== 'number' || isNaN(amountMinor) || !isFinite(amountMinor)) return 0;
  return Math.round(amountMinor) / 100;
}

/**
 * Formats minor units into user-facing decimal currency string.
 */
export function formatCurrency(amountMinor, currency = 'INR', locale = 'en-IN') {
  const major = toMajorUnits(amountMinor);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(major);
  } catch {
    // Fallback if locale or currency code is non-standard
    return `${currency.toUpperCase()} ${major.toFixed(2)}`;
  }
}

/**
 * Safe date parsing for YYYY-MM-DD strings into { year, month (1-12), day }.
 */
export function parseDateParts(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  }
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  }
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10)
  };
}

/**
 * Formats year, month (1-12), day into YYYY-MM-DD.
 */
export function formatDateParts(year, month, day) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Determines days in a given month (1-12) of a given year, accurately handling leap years.
 */
export function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Computes the next due date for recurring payments.
 * Supports:
 * - 'daily' (step = interval days)
 * - 'weekly' (step = interval weeks = interval * 7 days)
 * - 'monthly' (step = interval months, with month-end clamping)
 * - 'yearly' (step = interval years, with leap year clamping Feb 29 -> Feb 28 in non-leap)
 * - 'custom' (interval in days)
 *
 * Month-End Clamping Rule:
 * If a payment starts on the 31st, advancing to February clamps to the 28th (or 29th if leap year),
 * and advancing to April clamps to the 30th, preserving user intent without silently shifting months.
 */
export function calculateNextDueDate(startDateStr, frequency = 'monthly', interval = 1, fromDateStr = null) {
  const { year: sYear, month: sMonth, day: targetDay } = parseDateParts(startDateStr);
  const baseDateStr = fromDateStr || startDateStr;
  const { year: bYear, month: bMonth, day: bDay } = parseDateParts(baseDateStr);

  const safeInterval = Math.max(1, parseInt(interval, 10) || 1);

  if (frequency === 'daily') {
    const dateObj = new Date(Date.UTC(bYear, bMonth - 1, bDay + safeInterval));
    return formatDateParts(dateObj.getUTCFullYear(), dateObj.getUTCMonth() + 1, dateObj.getUTCDate());
  }

  if (frequency === 'weekly') {
    const dateObj = new Date(Date.UTC(bYear, bMonth - 1, bDay + (safeInterval * 7)));
    return formatDateParts(dateObj.getUTCFullYear(), dateObj.getUTCMonth() + 1, dateObj.getUTCDate());
  }

  if (frequency === 'monthly') {
    let nextMonth = bMonth + safeInterval;
    let nextYear = bYear;
    while (nextMonth > 12) {
      nextMonth -= 12;
      nextYear += 1;
    }
    const maxDays = getDaysInMonth(nextYear, nextMonth);
    // Clamp to the targetDay or maximum days in the target month
    const nextDay = Math.min(targetDay, maxDays);
    return formatDateParts(nextYear, nextMonth, nextDay);
  }

  if (frequency === 'yearly') {
    const nextYear = bYear + safeInterval;
    const maxDays = getDaysInMonth(nextYear, sMonth);
    const nextDay = Math.min(targetDay, maxDays);
    return formatDateParts(nextYear, sMonth, nextDay);
  }

  if (frequency === 'custom') {
    // Custom interval treated as days
    const dateObj = new Date(Date.UTC(bYear, bMonth - 1, bDay + safeInterval));
    return formatDateParts(dateObj.getUTCFullYear(), dateObj.getUTCMonth() + 1, dateObj.getUTCDate());
  }

  return baseDateStr;
}

/**
 * Checks whether targetDateStr falls inclusively within [startDateStr, endDateStr].
 */
export function isDateInRange(targetDateStr, startDateStr, endDateStr) {
  if (!targetDateStr) return false;
  if (startDateStr && targetDateStr < startDateStr) return false;
  if (endDateStr && targetDateStr > endDateStr) return false;
  return true;
}

/**
 * Calculates calendar days difference between two YYYY-MM-DD date strings.
 */
export function daysBetween(dateStrA, dateStrB) {
  const pA = parseDateParts(dateStrA);
  const pB = parseDateParts(dateStrB);
  const msA = Date.UTC(pA.year, pA.month - 1, pA.day);
  const msB = Date.UTC(pB.year, pB.month - 1, pB.day);
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}

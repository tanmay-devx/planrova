import { describe, it, expect } from 'vitest';
import { toMinorUnits, fromMinorUnits, validateExpense } from '../src/db/validation.js';

describe('Budget & Expense Engine', () => {
  it('prevents floating-point rounding errors when summing multiple expenses', () => {
    // Classic 0.1 + 0.2 + 0.3 floating point imprecision
    const expenses = [
      { amount: 19.99, amount_minor: 1999 },
      { amount: 29.99, amount_minor: 2999 },
      { amount: 9.99, amount_minor: 999 },
      { amount: 40.03, amount_minor: 4003 }
    ];

    const totalMinor = expenses.reduce((sum, item) => sum + item.amount_minor, 0);
    const totalDecimal = fromMinorUnits(totalMinor);

    expect(totalMinor).toBe(10000); // exactly 10000 paise = 100.00
    expect(totalDecimal).toBe(100);
  });

  it('correctly aggregates monthly expenses by category', () => {
    const rawExpenses = [
      { id: '1', amount: 150, category: 'Food', date: '2026-11-10' },
      { id: '2', amount: 50, category: 'Food', date: '2026-11-12' },
      { id: '3', amount: 80, category: 'Transport', date: '2026-11-14' },
      { id: '4', amount: 120, category: 'Books', date: '2026-11-05' }
    ];

    const validated = rawExpenses.map(validateExpense);

    const categoriesMapMinor = {};
    validated.forEach(exp => {
      categoriesMapMinor[exp.category] = (categoriesMapMinor[exp.category] || 0) + exp.amount_minor;
    });

    expect(categoriesMapMinor['Food']).toBe(20000); // 200.00
    expect(categoriesMapMinor['Transport']).toBe(8000); // 80.00
    expect(categoriesMapMinor['Books']).toBe(12000); // 120.00

    const totalMinor = Object.values(categoriesMapMinor).reduce((a, b) => a + b, 0);
    expect(fromMinorUnits(totalMinor)).toBe(400);

    const foodPct = Math.round((categoriesMapMinor['Food'] / totalMinor) * 100);
    expect(foodPct).toBe(50);
  });
});


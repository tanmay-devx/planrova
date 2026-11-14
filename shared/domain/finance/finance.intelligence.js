/**
 * shared/domain/finance/finance.intelligence.js
 * Advanced Cash Flow Velocity, Predictive Spending, and Budget Variance Engine.
 */

/**
 * Computes daily cashflow velocity, burn rate, and runway.
 * @param {object} params
 * @returns {object}
 */
export function computeCashFlowVelocity({
  transactions = [],
  days = 30,
  totalLiquidBalanceMinor = 0,
  referenceDate = new Date()
}) {
  const safeDays = Math.max(1, days);
  const cutoffTime = new Date(referenceDate).getTime() - (safeDays * 24 * 60 * 60 * 1000);

  let totalOutflowMinor = 0;
  let totalInflowMinor = 0;

  transactions.forEach(t => {
    if (t.deleted) return;
    const tTime = t.date ? new Date(t.date).getTime() : (t.created_at || 0);
    if (tTime < cutoffTime) return;

    const amountMinor = t.amountMinor !== undefined 
      ? Number(t.amountMinor) 
      : Math.round(Number(t.amount || 0) * 100);

    if (t.type === 'income') {
      totalInflowMinor += amountMinor;
    } else {
      totalOutflowMinor += amountMinor;
    }
  });

  const dailyAverageSpendMinor = Math.round(totalOutflowMinor / safeDays);
  const dailyAverageIncomeMinor = Math.round(totalInflowMinor / safeDays);
  const netBurnRateMinor = dailyAverageSpendMinor - dailyAverageIncomeMinor;

  let runwayDays = Infinity;
  if (netBurnRateMinor > 0 && totalLiquidBalanceMinor > 0) {
    runwayDays = Math.floor(totalLiquidBalanceMinor / netBurnRateMinor);
  } else if (netBurnRateMinor <= 0) {
    runwayDays = Infinity; // Cashflow positive or breakeven
  } else {
    runwayDays = 0; // Deficit with no balance
  }

  return {
    daysAnalyzed: safeDays,
    totalOutflowMinor,
    totalInflowMinor,
    dailyAverageSpendMinor,
    dailyAverageIncomeMinor,
    netBurnRateMinor,
    isCashflowPositive: netBurnRateMinor <= 0,
    runwayDays
  };
}

/**
 * Projects month-end spending based on current month run-rate velocity.
 */
export function projectMonthlySpend({
  currentSpendMinor = 0,
  currentDay = new Date().getDate(),
  totalDaysInMonth = 30
}) {
  const safeDay = Math.max(1, currentDay);
  const safeTotalDays = Math.max(safeDay, totalDaysInMonth);
  const dailyRunRateMinor = Math.round(currentSpendMinor / safeDay);
  const projectedMonthEndMinor = Math.round(dailyRunRateMinor * safeTotalDays);
  const remainingDays = safeTotalDays - safeDay;

  return {
    currentSpendMinor,
    currentDay: safeDay,
    totalDaysInMonth: safeTotalDays,
    remainingDays,
    dailyRunRateMinor,
    projectedMonthEndMinor
  };
}

/**
 * Evaluates budget variances and flags high-velocity categories.
 */
export function computeBudgetVariance({
  budgets = [],
  transactions = [],
  nowStr = new Date().toISOString().slice(0, 10)
}) {
  const currentMonthPrefix = nowStr.slice(0, 7);
  const currentDay = parseInt(nowStr.slice(8, 10), 10) || 15;
  const daysInMonth = new Date(parseInt(nowStr.slice(0, 4), 10), parseInt(nowStr.slice(5, 7), 10), 0).getDate();

  // Aggregate current month expense by category
  const categorySpendMap = new Map();
  transactions.forEach(t => {
    if (t.deleted || t.type === 'income') return;
    const tDate = t.date || '';
    if (!tDate.startsWith(currentMonthPrefix)) return;

    const cat = (t.category || 'General').toLowerCase();
    const amountMinor = t.amountMinor !== undefined 
      ? Number(t.amountMinor) 
      : Math.round(Number(t.amount || 0) * 100);

    categorySpendMap.set(cat, (categorySpendMap.get(cat) || 0) + amountMinor);
  });

  const variances = budgets.map(b => {
    const cat = (b.category || b.name || 'General').toLowerCase();
    const spentMinor = categorySpendMap.get(cat) || 0;
    const limitMinor = b.limitMinor !== undefined 
      ? Number(b.limitMinor) 
      : Math.round(Number(b.limit || 0) * 100);

    const varianceMinor = limitMinor - spentMinor;
    const utilizationPct = limitMinor > 0 ? Math.round((spentMinor / limitMinor) * 100) : 0;
    const isOverspent = varianceMinor < 0;

    // Projected velocity alert: if spent > 75% before halfway through month
    const isAtVelocityRisk = (currentDay <= Math.floor(daysInMonth / 2)) && utilizationPct >= 65;

    let alertLevel = 'safe';
    if (isOverspent) alertLevel = 'critical';
    else if (utilizationPct >= 85 || isAtVelocityRisk) alertLevel = 'warning';

    return {
      budgetId: b.id,
      name: b.name || b.category,
      category: b.category,
      limitMinor,
      spentMinor,
      varianceMinor,
      utilizationPct,
      isOverspent,
      isAtVelocityRisk,
      alertLevel
    };
  });

  return variances;
}


# Budget Intelligence & Spending Forecasting

## 1. Overview
The Budget Intelligence Engine (`shared/domain/finance/budget.engine.js`) evaluates spending ceilings, computes real-time utilization metrics, detects overspending, and projects month-end totals using explainable deterministic statistics.

---

## 2. Core Metrics & Utilization Formula

Given a budget $B$ with limit $L$ (minor units) and filtered expenses $E$:
$$\text{TotalSpent} = \sum_{e \in E} \text{AmountMinor}(e)$$
$$\text{Remaining} = \max(0, L - \text{TotalSpent})$$
$$\text{Overspent} = \max(0, \text{TotalSpent} - L)$$
$$\text{Utilization Percentage} = \begin{cases} 
\frac{\text{TotalSpent}}{L} \times 100 & \text{if } L > 0 \\ 
0 & \text{otherwise} 
\end{cases}$$

### Status Classification
- **`healthy`**: $\text{Utilization} < \text{AlertThreshold}$ (default 80%).
- **`approaching_limit`**: $\text{AlertThreshold} \le \text{Utilization} \le 100\%$.
- **`exceeded`**: $\text{Utilization} > 100\%$.

---

## 3. Deterministic Spending Forecasts

To project period spending without fake AI extrapolation:
1. Determine total days in period $D_{\text{total}}$ (e.g. 30 days for November).
2. Determine elapsed days $D_{\text{elapsed}}$ up to reference date.
3. Calculate average daily rate:
   $$\text{DailyAverageSpent} = \left\lfloor \frac{\text{TotalSpent}}{D_{\text{elapsed}}} \right\rfloor$$
4. Calculate projected period total:
   $$\text{ProjectedSpent} = \left\lfloor \frac{\text{TotalSpent}}{D_{\text{elapsed}}} \times D_{\text{total}} \right\rfloor$$

### Explainability Invariant
Forecast insights are emitted only when $D_{\text{elapsed}} \ge 3$ and spending indicates potential budget breach. The UI always presents projections as estimates derived from historical velocity.


# Savings Goals & Financial Planning Engine

## 1. Overview
The Savings Goals Engine (`shared/domain/finance/savings.engine.js`) tracks milestones, computes savings progress, projects required contribution rates, and detects overdue goals.

---

## 2. Mathematical Models

### Progress Formula
$$\text{RemainingAmount} = \max(0, \text{TargetAmountMinor} - \text{CurrentAmountMinor})$$
$$\text{ProgressPercentage} = \min\left(100, \frac{\text{CurrentAmountMinor}}{\text{TargetAmountMinor}} \times 100\right)$$

### Periodic Contribution Pacing
Given target date $T_{\text{target}}$ and reference date $T_{\text{ref}}$:
$$\Delta D = \text{daysBetween}(T_{\text{ref}}, T_{\text{target}})$$
$$\text{RemainingMonths} = \max\left(1, \left\lceil \frac{\Delta D}{30.4375} \right\rceil\right)$$
$$\text{RequiredPerMonthMinor} = \left\lceil \frac{\text{RemainingAmount}}{\text{RemainingMonths}} \right\rceil$$

---

## 3. Feasibility States
- **Completed:** $\text{CurrentAmountMinor} \ge \text{TargetAmountMinor}$.
- **Active On-Track:** $T_{\text{target}} \ge T_{\text{ref}}$ and remaining amount $> 0$.
- **Overdue:** $T_{\text{target}} < T_{\text{ref}}$ and remaining amount $> 0$.
- **Ad-Hoc:** No target date specified; progress tracked purely against target volume.


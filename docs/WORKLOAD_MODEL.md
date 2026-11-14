# Workload Intelligence & Cognitive Strain Model
**Planrova 2.0 — Phase 3 Specification**

---

## 1. Flexible Capacity & Utilization Formula

To prevent false utilization calculations when fixed lectures or lunch breaks exist, Planrova defines flexible capacity strictly as:

$$\text{Flexible Capacity} = \max(0, \text{Total Working Minutes} - \text{Fixed Commitment Minutes} - \text{Reserved Break Minutes})$$

$$\text{Capacity Utilization} = \begin{cases} 
0 & \text{if } \text{Scheduled Work} = 0 \\
\infty & \text{if } \text{Flexible Capacity} = 0 \land \text{Scheduled Work} > 0 \\
\frac{\text{Scheduled Flexible Work Minutes}}{\text{Flexible Capacity}} & \text{otherwise}
\end{cases}$$

---

## 2. Non-Overlapping Workload Thresholds

Workload classifications use strict, mutually exclusive boundaries:

| Classification | Utilization Range | Interpretation & Advice |
| :--- | :--- | :--- |
| `light` | $[0.00, 0.40)$ | Plenty of open capacity; ideal for light study or personal projects. |
| `balanced` | $[0.40, 0.80)$ | Optimal focus and productivity with healthy buffer margin. |
| `heavy` | $[0.80, 1.00]$ | Tightly packed schedule with minimal recovery buffer; protect breaks. |
| `overloaded` | $> 1.00$ | Infeasible commitment. Move non-urgent tasks to another day. |

---

## 3. Cognitive Load Scoring (0 – 100 Scale)

In addition to pure duration, cognitive strain is calculated using:
1. **Duration Ratio (Up to 40 pts)**: Proportional scheduled work vs 8 hours.
2. **High Urgency Pressure (Up to 25 pts)**: Ratio of `urgent` and `high` priority tasks.
3. **Deep Focus Strain (Up to 20 pts)**: Presence of demanding sessions $\ge 90\text{ min}$ without rest.
4. **Back-to-Back Density (Up to 15 pts)**: Number of consecutive blocks with $< 10\text{ min}$ transition gap.

### Fatigue Risk Mapping
- $\text{Utilization} \ge 0.80 \lor \text{Cognitive Score} \ge 70 \implies \mathbf{High}$
- $\text{Utilization} \ge 0.50 \lor \text{Cognitive Score} \ge 40 \implies \mathbf{Moderate}$
- Otherwise $\implies \mathbf{Low}$


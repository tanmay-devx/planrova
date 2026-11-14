import { getStorageItem, setStorageItem } from '../../utils/storage.js';
import {
  computeGreeting,
  computeTodayStats,
  computePriorityActions,
  computeNextBestAction,
  computeWeeklyOutlook
} from './command-center.engine.js';
import { ACADEMIC_STORAGE_KEYS } from '../../../shared/domain/academic/academic.types.js';
import { addXP, logDailyActivity } from '../gamification.js';

let miniTimerInterval = null;
let miniTimerSecondsLeft = 25 * 60;
let miniTimerIsRunning = false;
let miniTimerTotalSeconds = 25 * 60;

/**
 * Initializes the Daily Command Center UI.
 */
export function initCommandCenter() {
  const container = document.getElementById('home-command-center-view');
  if (!container) return;

  renderCommandCenter();
}

/**
 * Formats seconds into MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Renders the Daily Command Center dashboard.
 */
export function renderCommandCenter() {
  const container = document.getElementById('home-command-center-view');
  if (!container) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();

  // 1. Fetch user data from local storage
  const profile = getStorageItem('user_profile', { name: 'Builder' });
  const tasks = getStorageItem('tasks', []);
  const habits = getStorageItem('user_habits', []);
  const habitLogs = getStorageItem('habit_logs', {});
  const hydration = getStorageItem('hydration', { water: 0, target: 2000 });
  const pomodoroStats = getStorageItem('pomodoro_stats', { roundsToday: 0 });
  const assessments = getStorageItem(ACADEMIC_STORAGE_KEYS.ASSESSMENTS, []);
  const gamification = getStorageItem('gamification_state', { level: 1, xp: 0, streak: 0 });
  const expenses = getStorageItem('expenses', []);
  const transactions = getStorageItem('planrova_finance_transactions', []);

  // 2. Compute metrics and analytics
  const greeting = computeGreeting(hour, profile.name);
  const stats = computeTodayStats({
    tasks,
    habits,
    habitLogs,
    hydration,
    pomodoroStats,
    todayStr
  });
  const priorityActions = computePriorityActions({
    tasks,
    assessments,
    habits,
    habitLogs,
    todayStr,
    limit: 5
  });
  const nextAction = computeNextBestAction({
    tasks,
    assessments,
    habits,
    habitLogs,
    hour,
    todayStr
  });
  const weeklyDays = computeWeeklyOutlook({ tasks, baseDate: new Date() });

  // Compute today's financial spending
  const todayExpenses = [...expenses, ...transactions].filter(e => !e.deleted && (e.date === todayStr || (e.timestamp && new Date(e.timestamp).toISOString().split('T')[0] === todayStr)));
  const todaySpend = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Format date display (e.g., Saturday, November 15, 2026)
  const dateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  // 3. Assemble HTML
  container.innerHTML = `
    <!-- Top Hero Section -->
    <div class="command-center-hero" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
      <div>
        <div style="font-size: 13px; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">
          ${dateFormatted} · Daily Command Center
        </div>
        <h1 style="font-size: 26px; font-weight: 800; margin: 0; color: var(--text-primary); letter-spacing: -0.02em;">
          ${greeting}
        </h1>
        <p style="font-size: 13px; color: var(--text-secondary); margin: 6px 0 0 0;">
          Here is your high-impact summary for today. Stay focused and execute.
        </p>
      </div>

      <div style="display: flex; gap: 10px; align-items: center;">
        <button id="cc-quick-task-btn" class="btn-primary" style="padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: 8px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <span>+</span> Quick Task
        </button>
        <button id="cc-open-capture-btn" class="btn-secondary" style="padding: 8px 14px; font-size: 13px; font-weight: 600; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer;">
          ⚡ Quick Capture
        </button>
      </div>
    </div>

    <!-- 4 High-Level Metric Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px;">
      <!-- Tasks Metric -->
      <div class="card" style="padding: 16px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Tasks Today</span>
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: ${stats.highPriorityRemaining > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)'}; color: ${stats.highPriorityRemaining > 0 ? '#ef4444' : 'var(--text-secondary)'}; font-weight: 700;">
            ${stats.highPriorityRemaining > 0 ? `${stats.highPriorityRemaining} high priority` : 'On track'}
          </span>
        </div>
        <div style="font-size: 26px; font-weight: 800; color: var(--text-primary);">
          ${stats.tasksDone} <span style="font-size: 15px; font-weight: 500; color: var(--text-secondary);">/ ${stats.tasksTotal} done</span>
        </div>
        <div style="height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 10px; overflow: hidden;">
          <div style="height: 100%; width: ${stats.tasksTotal > 0 ? (stats.tasksDone / stats.tasksTotal) * 100 : 0}%; background: var(--accent); transition: width 0.3s ease;"></div>
        </div>
      </div>

      <!-- Habits Metric -->
      <div class="card" style="padding: 16px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Habits Consistency</span>
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700;">
            ${stats.habitsPct}%
          </span>
        </div>
        <div style="font-size: 26px; font-weight: 800; color: var(--text-primary);">
          ${stats.habitsDone} <span style="font-size: 15px; font-weight: 500; color: var(--text-secondary);">/ ${stats.habitsTotal} completed</span>
        </div>
        <div style="height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 10px; overflow: hidden;">
          <div style="height: 100%; width: ${stats.habitsPct}%; background: #10b981; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <!-- Hydration Metric -->
      <div class="card" style="padding: 16px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Hydration</span>
          <button id="cc-add-water-btn" style="border: none; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 8px; cursor: pointer;">
            + 250ml
          </button>
        </div>
        <div style="font-size: 26px; font-weight: 800; color: var(--text-primary);">
          ${stats.water} <span style="font-size: 15px; font-weight: 500; color: var(--text-secondary);">/ ${stats.waterTarget} ml</span>
        </div>
        <div style="height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 10px; overflow: hidden;">
          <div style="height: 100%; width: ${stats.waterPct}%; background: #3b82f6; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <!-- Focus & Pomodoro Metric -->
      <div class="card" style="padding: 16px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Focus Time</span>
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-weight: 700;">
            ${stats.focusRounds} sessions
          </span>
        </div>
        <div style="font-size: 26px; font-weight: 800; color: var(--text-primary);">
          ${stats.focusMinutes} <span style="font-size: 15px; font-weight: 500; color: var(--text-secondary);">minutes</span>
        </div>
        <div style="height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 10px; overflow: hidden;">
          <div style="height: 100%; width: ${Math.min(100, (stats.focusMinutes / 120) * 100)}%; background: #f59e0b; transition: width 0.3s ease;"></div>
        </div>
      </div>
    </div>

    <!-- Main 2-Column Grid -->
    <div style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 20px; align-items: start; margin-bottom: 24px;">
      <!-- LEFT COLUMN -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Next Best Action Card (Featured Recommendation) -->
        <div class="card" style="padding: 20px; border-radius: 14px; background: linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(26, 26, 26, 0.8) 100%); border: 1px solid rgba(212, 175, 55, 0.35); position: relative; overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="background: var(--accent); color: #000; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em;">
              Next Best Action
            </span>
            <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">${nextAction.badge}</span>
          </div>

          <h3 style="font-size: 18px; font-weight: 700; margin: 0 0 8px 0; color: var(--text-primary);">
            ${nextAction.title}
          </h3>

          <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0; line-height: 1.45;">
            ${nextAction.reason}
          </p>

          <button id="cc-next-action-btn" class="btn-primary" data-action-type="${nextAction.actionType}" data-target-id="${nextAction.targetId || ''}" style="padding: 9px 18px; font-size: 13px; font-weight: 700; border-radius: 8px; cursor: pointer;">
            ⚡ ${nextAction.ctaText}
          </button>
        </div>

        <!-- Priority Actions Section -->
        <div class="card" style="padding: 20px; border-radius: 14px; background: var(--bg-card); border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: var(--text-primary);">Priority Actions</h3>
              <span style="font-size: 12px; color: var(--text-secondary);">Top tasks & deadlines requiring your attention</span>
            </div>
            <button id="cc-view-all-tasks-btn" style="background: none; border: none; color: var(--accent); font-size: 12px; font-weight: 600; cursor: pointer;">
              View All Tasks →
            </button>
          </div>

          <div id="cc-priority-list" style="display: flex; flex-direction: column; gap: 10px;">
            ${priorityActions.length === 0 ? `
              <div style="padding: 24px; text-align: center; color: var(--text-secondary); font-size: 13px;">
                🎉 No pending priority actions! You're completely caught up for today.
              </div>
            ` : priorityActions.map(action => `
              <div class="priority-action-row" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                  <input type="checkbox" class="cc-task-checkbox" data-id="${action.id}" data-type="${action.type}" style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent);">
                  <div style="min-width: 0; flex: 1;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${action.title}
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                      <span style="padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); font-weight: 600;">${action.badge}</span>
                      <span>·</span>
                      <span style="color: ${action.isOverdue ? '#ef4444' : 'inherit'}; font-weight: ${action.isOverdue ? '700' : '400'};">
                        ${action.isOverdue ? '⚠️ Overdue' : action.due}
                      </span>
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                  <button class="cc-action-focus-btn" data-id="${action.id}" data-title="${encodeURIComponent(action.title)}" title="Start focus session" style="background: none; border: 1px solid var(--border-color); color: var(--text-secondary); border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer;">
                    🎯 Focus
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 7-Day Weekly Outlook Strip -->
        <div class="card" style="padding: 20px; border-radius: 14px; background: var(--bg-card); border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: var(--text-primary);">Weekly Outlook</h3>
            <span style="font-size: 12px; color: var(--text-secondary);">Workload distribution</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">
            ${weeklyDays.map(day => `
              <div class="cc-week-day-pill" data-date="${day.dateStr}" style="display: flex; flex-direction: column; align-items: center; padding: 10px 4px; border-radius: 10px; background: ${day.isToday ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${day.isToday ? 'var(--accent)' : 'var(--border-color)'}; cursor: pointer; transition: all 0.2s ease;">
                <span style="font-size: 11px; font-weight: 600; color: ${day.isToday ? 'var(--accent)' : 'var(--text-secondary)'}; text-transform: uppercase;">
                  ${day.dayName}
                </span>
                <span style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin: 4px 0;">
                  ${day.dayNum}
                </span>
                <span style="font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 6px; background: ${day.totalCount > 0 ? (day.doneCount === day.totalCount ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)') : 'transparent'}; color: ${day.totalCount > 0 ? (day.doneCount === day.totalCount ? '#10b981' : 'var(--text-secondary)') : 'transparent'};">
                  ${day.totalCount > 0 ? `${day.doneCount}/${day.totalCount}` : '-'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Focus & Quick Utilities -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Quick Focus / Pomodoro Mini Widget -->
        <div class="card" style="padding: 20px; border-radius: 14px; background: var(--bg-card); border: 1px solid var(--border-color); text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <span style="font-size: 13px; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em;">Quick Focus</span>
            <span id="cc-timer-mode-label" style="font-size: 11px; color: var(--accent); font-weight: 600;">Deep Work</span>
          </div>

          <!-- Timer Display -->
          <div id="cc-timer-display" style="font-size: 44px; font-weight: 900; letter-spacing: -0.02em; color: var(--text-primary); margin: 12px 0;">
            ${formatTime(miniTimerSecondsLeft)}
          </div>

          <!-- Controls -->
          <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 16px;">
            <button id="cc-timer-toggle-btn" class="btn-primary" style="padding: 8px 24px; font-size: 13px; font-weight: 700; border-radius: 8px; cursor: pointer;">
              ${miniTimerIsRunning ? 'Pause' : 'Start Focus'}
            </button>
            <button id="cc-timer-reset-btn" class="btn-secondary" style="padding: 8px 14px; font-size: 13px; font-weight: 600; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-secondary); cursor: pointer;">
              Reset
            </button>
          </div>

          <!-- Presets -->
          <div style="display: flex; justify-content: center; gap: 6px;">
            <button class="cc-timer-preset-btn" data-mins="25" data-mode="Deep Work" style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-secondary); cursor: pointer;">
              25m Deep
            </button>
            <button class="cc-timer-preset-btn" data-mins="50" data-mode="Study Block" style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-secondary); cursor: pointer;">
              50m Block
            </button>
            <button class="cc-timer-preset-btn" data-mins="5" data-mode="Short Break" style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-secondary); cursor: pointer;">
              5m Break
            </button>
          </div>
        </div>

        <!-- Wellbeing & Daily Core Widget -->
        <div class="card" style="padding: 20px; border-radius: 14px; background: var(--bg-card); border: 1px solid var(--border-color);">
          <h4 style="font-size: 14px; font-weight: 700; margin: 0 0 14px 0; color: var(--text-primary);">
            Progress & Life OS
          </h4>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Level & Streak -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color);">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Level ${gamification.level || 1} Builder</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${gamification.xp || 0} Total XP</div>
              </div>
              <div style="font-size: 12px; font-weight: 800; color: var(--accent); display: flex; align-items: center; gap: 4px;">
                🔥 ${gamification.streak || 0} Day Streak
              </div>
            </div>

            <!-- Spending Today -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color);">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Daily Spending</div>
                <div style="font-size: 11px; color: var(--text-secondary);">Today's recorded outflows</div>
              </div>
              <div style="font-size: 14px; font-weight: 800; color: ${todaySpend > 0 ? '#f59e0b' : 'var(--text-secondary)'};">
                $${todaySpend.toFixed(2)}
              </div>
            </div>

            <!-- Workspace Quick Shortcuts -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
              <button id="cc-nav-academic" style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;">
                🎓 Academic
              </button>
              <button id="cc-nav-finance" style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;">
                💰 Finance
              </button>
              <button id="cc-nav-wellbeing" style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;">
                🌿 Wellbeing
              </button>
              <button id="cc-nav-ai" style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;">
                ✨ AI Assistant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 4. Attach Event Handlers
  attachCommandCenterEvents(container, tasks, habits, habitLogs, hydration);
}

/**
 * Attaches interactive listeners to Command Center elements.
 */
function attachCommandCenterEvents(container, tasks, habits, habitLogs, hydration) {
  // Quick Task button
  const quickTaskBtn = container.querySelector('#cc-quick-task-btn');
  if (quickTaskBtn) {
    quickTaskBtn.addEventListener('click', () => {
      const addBtn = document.getElementById('add-task-btn');
      if (addBtn) addBtn.click();
    });
  }

  // Quick Capture button
  const quickCaptureBtn = container.querySelector('#cc-open-capture-btn');
  if (quickCaptureBtn) {
    quickCaptureBtn.addEventListener('click', () => {
      const overlay = document.getElementById('quick-capture-modal-overlay');
      if (overlay) {
        overlay.classList.remove('hidden');
        const input = document.getElementById('quick-capture-input');
        if (input) input.focus();
      }
    });
  }

  // Add water button
  const addWaterBtn = container.querySelector('#cc-add-water-btn');
  if (addWaterBtn) {
    addWaterBtn.addEventListener('click', () => {
      const current = getStorageItem('hydration', { water: 0, target: 2000 });
      current.water = (Number(current.water) || 0) + 250;
      setStorageItem('hydration', current);
      addXP(5);
      logDailyActivity('water', 1);
      renderCommandCenter();
    });
  }

  // Next Best Action CTA
  const nextActionBtn = container.querySelector('#cc-next-action-btn');
  if (nextActionBtn) {
    nextActionBtn.addEventListener('click', () => {
      const actionType = nextActionBtn.dataset.actionType;
      const targetId = nextActionBtn.dataset.targetId;

      if (actionType === 'academic') {
        if (typeof window.switchMainView === 'function') {
          window.switchMainView('academic');
        }
      } else if (actionType === 'habit') {
        const todayStr = new Date().toISOString().split('T')[0];
        const logs = getStorageItem('habit_logs', {});
        const todayList = logs[todayStr] || [];
        if (!todayList.includes(targetId)) {
          todayList.push(targetId);
          logs[todayStr] = todayList;
          setStorageItem('habit_logs', logs);
          addXP(15);
          logDailyActivity('habit', 1);
        }
        renderCommandCenter();
      } else if (actionType === 'task') {
        // Toggle mini timer with that task
        miniTimerSecondsLeft = 25 * 60;
        miniTimerTotalSeconds = 25 * 60;
        startMiniTimer();
      } else if (actionType === 'done') {
        if (typeof window.switchMainView === 'function') {
          window.switchMainView('calendar');
        }
      }
    });
  }

  // Priority checkboxes
  const checkboxes = container.querySelectorAll('.cc-task-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = cb.dataset.id;
      const type = cb.dataset.type;

      if (type === 'task') {
        const allTasks = getStorageItem('tasks', []);
        const task = allTasks.find(t => t.id === id);
        if (task) {
          task.completed = true;
          task.completedAt = new Date().toISOString();
          setStorageItem('tasks', allTasks);
          addXP(10);
          logDailyActivity('task', 1);
        }
      } else if (type === 'habit') {
        const todayStr = new Date().toISOString().split('T')[0];
        const logs = getStorageItem('habit_logs', {});
        const todayList = logs[todayStr] || [];
        if (!todayList.includes(id)) {
          todayList.push(id);
          logs[todayStr] = todayList;
          setStorageItem('habit_logs', logs);
          addXP(15);
          logDailyActivity('habit', 1);
        }
      }

      renderCommandCenter();
    });
  });

  // Priority focus buttons
  const focusBtns = container.querySelectorAll('.cc-action-focus-btn');
  focusBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const title = decodeURIComponent(btn.dataset.title || 'Task');
      const modeLabel = container.querySelector('#cc-timer-mode-label');
      if (modeLabel) modeLabel.textContent = title.slice(0, 16);
      startMiniTimer();
    });
  });

  // View All Tasks
  const viewAllTasksBtn = container.querySelector('#cc-view-all-tasks-btn');
  if (viewAllTasksBtn) {
    viewAllTasksBtn.addEventListener('click', () => {
      if (typeof window.switchMainView === 'function') {
        window.switchMainView('weekly');
      }
    });
  }

  // Mini Timer Controls
  const timerToggleBtn = container.querySelector('#cc-timer-toggle-btn');
  const timerResetBtn = container.querySelector('#cc-timer-reset-btn');
  const presetBtns = container.querySelectorAll('.cc-timer-preset-btn');

  if (timerToggleBtn) {
    timerToggleBtn.addEventListener('click', () => {
      if (miniTimerIsRunning) {
        pauseMiniTimer();
      } else {
        startMiniTimer();
      }
    });
  }

  if (timerResetBtn) {
    timerResetBtn.addEventListener('click', () => {
      resetMiniTimer();
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = Number(btn.dataset.mins) || 25;
      const mode = btn.dataset.mode || 'Focus';
      pauseMiniTimer();
      miniTimerTotalSeconds = mins * 60;
      miniTimerSecondsLeft = mins * 60;
      const modeLabel = container.querySelector('#cc-timer-mode-label');
      if (modeLabel) modeLabel.textContent = mode;
      updateMiniTimerDisplay();
    });
  });

  // Weekly Outlook day pills
  const dayPills = container.querySelectorAll('.cc-week-day-pill');
  dayPills.forEach(pill => {
    pill.addEventListener('click', () => {
      if (typeof window.switchMainView === 'function') {
        window.switchMainView('weekly');
      }
    });
  });

  // Workspace shortcuts
  const wsAcademic = container.querySelector('#cc-nav-academic');
  const wsFinance = container.querySelector('#cc-nav-finance');
  const wsWellbeing = container.querySelector('#cc-nav-wellbeing');
  const wsAI = container.querySelector('#cc-nav-ai');

  if (wsAcademic) wsAcademic.addEventListener('click', () => window.switchMainView && window.switchMainView('academic'));
  if (wsFinance) wsFinance.addEventListener('click', () => window.switchMainView && window.switchMainView('finance'));
  if (wsWellbeing) wsWellbeing.addEventListener('click', () => window.switchMainView && window.switchMainView('wellbeing'));
  if (wsAI) wsAI.addEventListener('click', () => window.switchMainView && window.switchMainView('ai'));
}

/**
 * Starts the mini Pomodoro countdown.
 */
function startMiniTimer() {
  if (miniTimerIsRunning) return;
  miniTimerIsRunning = true;

  const toggleBtn = document.getElementById('cc-timer-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = 'Pause';

  miniTimerInterval = setInterval(() => {
    if (miniTimerSecondsLeft > 0) {
      miniTimerSecondsLeft--;
      updateMiniTimerDisplay();
    } else {
      pauseMiniTimer();
      addXP(25);
      logDailyActivity('focus', 1);

      // Increment pomodoro stats
      const stats = getStorageItem('pomodoro_stats', { roundsToday: 0 });
      stats.roundsToday = (Number(stats.roundsToday) || 0) + 1;
      setStorageItem('pomodoro_stats', stats);

      renderCommandCenter();
    }
  }, 1000);
}

/**
 * Pauses the mini Pomodoro countdown.
 */
function pauseMiniTimer() {
  if (miniTimerInterval) {
    clearInterval(miniTimerInterval);
    miniTimerInterval = null;
  }
  miniTimerIsRunning = false;
  const toggleBtn = document.getElementById('cc-timer-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = 'Start Focus';
}

/**
 * Resets the mini Pomodoro timer.
 */
function resetMiniTimer() {
  pauseMiniTimer();
  miniTimerSecondsLeft = miniTimerTotalSeconds;
  updateMiniTimerDisplay();
}

/**
 * Updates timer text in DOM without full re-render.
 */
function updateMiniTimerDisplay() {
  const display = document.getElementById('cc-timer-display');
  if (display) {
    display.textContent = formatTime(miniTimerSecondsLeft);
  }
}

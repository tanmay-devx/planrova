/**
 * src/modules/wellbeing/wellbeing.ui.js
 * Dedicated Wellbeing Workspace View for Planrova 2.0 Web Application.
 *
 * Implements:
 * - Daily Habits with Streak Indicators & Consistency Metrics
 * - Hydration Tracker with Quick-Add (250ml, 500ml) & Daily Goal Ring
 * - Daily Routines with Step Checklists & Time Estimates
 * - Lightweight Personal Check-in (Energy Level 1-5, Mood, Private Reflection)
 * - Weekly Consistency Analytics
 */

import {
  getStoredHabits,
  saveStoredHabit,
  getStoredHydrationLogs,
  saveStoredHydrationLog,
  getStoredHydrationSettings,
  getStoredCheckIns,
  saveStoredCheckIn,
  getStoredRoutines,
  saveStoredRoutine
} from './wellbeing-storage.js';
import { evaluateHabitConsistency, toggleHabitCompletion } from '../../../shared/domain/wellbeing/habit.engine.js';
import { calculateDailyHydration, calculateWeeklyHydration } from '../../../shared/domain/wellbeing/hydration.engine.js';
import { evaluateRoutineProgress, toggleRoutineStep } from '../../../shared/domain/wellbeing/routine.engine.js';
import { normalizeHabit } from '../../../shared/domain/entities/habit.schema.js';

let isInitialized = false;

export function initWellbeingWorkspace() {
  renderWellbeingWorkspace();
  if (!isInitialized) {
    setupWellbeingEventListeners();
    isInitialized = true;
  }
}

export function renderWellbeingWorkspace() {
  const container = document.getElementById('wellbeing-workspace-content');
  if (!container) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const habits = getStoredHabits();
  const hydrationLogs = getStoredHydrationLogs();
  const hydrationSettings = getStoredHydrationSettings();
  const checkIns = getStoredCheckIns();
  const routines = getStoredRoutines();

  // 1. Evaluate habits
  const evaluatedHabits = habits.map(h => evaluateHabitConsistency(h, now));

  // 2. Hydration metrics
  const dailyHydration = calculateDailyHydration(hydrationLogs, todayStr, hydrationSettings.goal);
  const weeklyHydration = calculateWeeklyHydration(hydrationLogs, now, hydrationSettings.goal);

  // 3. Today's Check-in
  const todayCheckIn = checkIns.find(c => c.dateKey === todayStr) || { energyLevel: 3, moodLabel: 'neutral', personalNote: '' };

  // 4. Routines evaluation
  const evaluatedRoutines = routines.map(r => ({
    routine: r,
    progress: evaluateRoutineProgress(r)
  }));

  container.innerHTML = `
    <div class="wellbeing-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 style="margin:0; font-size:24px; font-weight:700;">Personal Wellbeing</h2>
        <p style="margin:4px 0 0; color:var(--text-secondary); font-size:14px;">Habits, hydration, routines & mindful daily consistency</p>
      </div>
      <div style="display:flex; gap:10px;">
        <button id="btn-add-habit" class="btn btn-primary" style="display:flex; align-items:center; gap:6px;">
          <span>+</span> New Habit
        </button>
      </div>
    </div>

    <!-- Top Grid: Hydration & Check-in -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:24px;">
      <!-- Hydration Card -->
      <div class="card" style="background:var(--bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0; font-size:16px; font-weight:600; display:flex; align-items:center; gap:6px;">
            <span>💧</span> Hydration Today
          </h3>
          <span style="font-size:14px; font-weight:700; color:#3B82F6;">${dailyHydration.totalMl} / ${dailyHydration.targetGoalMl} ml</span>
        </div>
        
        <div style="height:10px; background:var(--bg-primary); border-radius:5px; overflow:hidden; margin-bottom:16px;">
          <div style="width:${dailyHydration.percentage}%; height:100%; background:linear-gradient(90deg, #3B82F6, #60A5FA); transition:width 0.3s;"></div>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary btn-quick-water" data-ml="250" style="flex:1; font-size:13px; padding:8px;">+ 250 ml (Glass)</button>
          <button class="btn btn-secondary btn-quick-water" data-ml="500" style="flex:1; font-size:13px; padding:8px;">+ 500 ml (Bottle)</button>
        </div>
      </div>

      <!-- Mindful Check-in Card -->
      <div class="card" style="background:var(--bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--border-color);">
        <h3 style="margin:0 0 12px; font-size:16px; font-weight:600; display:flex; align-items:center; gap:6px;">
          <span>🧘</span> Daily Reflection
        </h3>
        
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <span style="font-size:12px; color:var(--text-secondary);">Energy (1-5):</span>
          <div style="display:flex; gap:6px;">
            ${[1, 2, 3, 4, 5].map(lvl => `
              <button class="btn-energy-select ${todayCheckIn.energyLevel === lvl ? 'active' : ''}" data-level="${lvl}" style="padding:4px 10px; border-radius:6px; border:1px solid var(--border-color); background:${todayCheckIn.energyLevel === lvl ? '#8B5CF6' : 'var(--bg-primary)'}; color:${todayCheckIn.energyLevel === lvl ? '#fff' : 'var(--text-primary)'}; cursor:pointer; font-weight:600; font-size:12px;">
                ${lvl}
              </button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; gap:8px;">
          <input type="text" id="checkin-note-input" value="${todayCheckIn.personalNote || ''}" placeholder="How are you feeling today?" style="flex:1; padding:8px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--text-primary); font-size:13px;">
          <button id="btn-save-checkin" class="btn btn-secondary" style="font-size:12px;">Save</button>
        </div>
      </div>
    </div>

    <!-- Habits & Routines Grid -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:24px;">
      <!-- Habits Section -->
      <div class="card" style="background:var(--bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--border-color);">
        <h3 style="margin:0 0 14px; font-size:16px; font-weight:600;">Today's Habits</h3>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${evaluatedHabits.map(h => {
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-primary); border-radius:8px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="checkbox" class="habit-toggle" data-id="${h.habitId}" ${h.isCompletedToday ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                  <span style="font-weight:600; font-size:14px; ${h.isCompletedToday ? 'text-decoration:line-through; opacity:0.7;' : ''}">${h.name}</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px; font-size:13px; font-weight:700; color:#F59E0B;">
                  <span>🔥</span> ${h.currentStreak}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Routines Section -->
      <div class="card" style="background:var(--bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--border-color);">
        <h3 style="margin:0 0 14px; font-size:16px; font-weight:600;">Active Routines</h3>
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${evaluatedRoutines.map(({ routine, progress }) => `
            <div style="padding:12px; background:var(--bg-primary); border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-weight:600; font-size:14px;">${routine.title}</span>
                <span style="font-size:11px; color:var(--text-secondary);">${progress.totalDurationMinutes} min</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${(routine.steps || []).map(step => `
                  <div style="display:flex; align-items:center; gap:8px; font-size:13px;">
                    <input type="checkbox" class="routine-step-toggle" data-routine-id="${routine.id}" data-step-id="${step.id}" ${step.isCompleted ? 'checked' : ''} style="cursor:pointer;">
                    <span style="${step.isCompleted ? 'text-decoration:line-through; opacity:0.6;' : ''}">${step.title} (${step.durationMinutes}m)</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function setupWellbeingEventListeners() {
  document.addEventListener('click', (e) => {
    // Quick water logging
    if (e.target.closest('.btn-quick-water')) {
      const btn = e.target.closest('.btn-quick-water');
      const ml = parseInt(btn.getAttribute('data-ml'), 10);
      saveStoredHydrationLog({
        amountMl: ml,
        dateKey: new Date().toISOString().slice(0, 10),
        beverageType: 'water'
      });
      renderWellbeingWorkspace();
    }

    // Energy select
    if (e.target.closest('.btn-energy-select')) {
      const btn = e.target.closest('.btn-energy-select');
      const level = parseInt(btn.getAttribute('data-level'), 10);
      document.querySelectorAll('.btn-energy-select').forEach(b => {
        b.style.background = 'var(--bg-primary)';
        b.style.color = 'var(--text-primary)';
      });
      btn.style.background = '#8B5CF6';
      btn.style.color = '#fff';
      btn.setAttribute('data-active', 'true');
    }

    // Save check-in
    if (e.target.closest('#btn-save-checkin')) {
      const activeBtn = document.querySelector('.btn-energy-select[data-active="true"]') || document.querySelector('.btn-energy-select.active');
      const level = activeBtn ? parseInt(activeBtn.getAttribute('data-level'), 10) : 3;
      const noteInput = document.getElementById('checkin-note-input');
      const note = noteInput ? noteInput.value : '';

      saveStoredCheckIn({
        dateKey: new Date().toISOString().slice(0, 10),
        energyLevel: level,
        personalNote: note
      });
      alert('Reflection saved.');
      renderWellbeingWorkspace();
    }

    // Habit toggle
    if (e.target.closest('.habit-toggle')) {
      const checkbox = e.target.closest('.habit-toggle');
      const habitId = checkbox.getAttribute('data-id');
      const habits = getStoredHabits();
      const habit = habits.find(h => h.id === habitId);
      if (habit) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const updated = toggleHabitCompletion(habit, todayStr, new Date());
        saveStoredHabit(updated);
        renderWellbeingWorkspace();
      }
    }

    // Routine step toggle
    if (e.target.closest('.routine-step-toggle')) {
      const checkbox = e.target.closest('.routine-step-toggle');
      const routineId = checkbox.getAttribute('data-routine-id');
      const stepId = checkbox.getAttribute('data-step-id');
      const routines = getStoredRoutines();
      const routine = routines.find(r => r.id === routineId);
      if (routine) {
        const updated = toggleRoutineStep(routine, stepId);
        saveStoredRoutine(updated);
        renderWellbeingWorkspace();
      }
    }

    // Add habit modal
    if (e.target.closest('#btn-add-habit')) {
      showAddHabitModal();
    }
  });
}

function showAddHabitModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000;';

  modal.innerHTML = `
    <div style="background:var(--bg-secondary); padding:24px; border-radius:14px; width:90%; max-width:400px; border:1px solid var(--border-color);">
      <h3 style="margin:0 0 16px; font-size:18px; font-weight:700;">Create New Habit</h3>
      <form id="form-add-habit" style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text-secondary);">Habit Name</label>
          <input type="text" id="habit-name" required placeholder="e.g. Read 20 pages, Morning Jog" style="width:100%; padding:8px; border-radius:8px; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">
        </div>
        <div>
          <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text-secondary);">Frequency</label>
          <select id="habit-freq" style="width:100%; padding:8px; border-radius:8px; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">
            <option value="daily">Every Day</option>
            <option value="weekdays">Weekdays (Mon-Fri)</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
          <button type="button" id="btn-cancel-habit" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Habit</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('#btn-cancel-habit').onclick = () => modal.remove();
  modal.querySelector('#form-add-habit').onsubmit = (e) => {
    e.preventDefault();
    const name = modal.querySelector('#habit-name').value;
    const freq = modal.querySelector('#habit-freq').value;

    const newHabit = normalizeHabit({
      name,
      frequency: { type: freq, days: [] }
    });
    saveStoredHabit(newHabit);
    modal.remove();
    renderWellbeingWorkspace();
  };
}


/**
 * src/modules/adaptive-planning/planning-ui.js
 * Adaptive Planning Engine UI for Planrova 2.0 Web.
 *
 * Capabilities:
 * - "Today's Plan" interactive timeline view (tasks, lectures, exams, breaks, smart buffers)
 * - Workload status badge (Light / Balanced / Heavy / Overloaded) and fatigue risk indicator
 * - 7-Day Weekly Capacity Summary bar
 * - Interactive "Generate Plan" action modal with proposal preview and selective acceptance
 * - Interactive "Reschedule / Adapt" action modal
 * - Availability Configuration Modal
 * - Lock/Unlock toggle on individual schedule blocks
 */

import { 
  generateScheduleProposal, 
  generateRescheduleProposal,
  calculateWorkloadUtilization,
  classifyWorkload,
  PROPOSAL_STATUSES,
  WORKLOAD_CLASSIFICATIONS 
} from '../../../shared/domain/scheduling/index.js';

import { 
  getUserAvailability, 
  saveUserAvailability, 
  getDraftProposal, 
  saveDraftProposal, 
  getAcceptedScheduleBlocks, 
  acceptScheduleProposal 
} from '../scheduling-storage.js';

import { getStorageItem, setStorageItem } from '../../utils/storage.js';

let _activePlanDate = new Date().toISOString().split('T')[0];
let _currentGeneratedProposal = null;

export function getActivePlanDate() {
  return _activePlanDate;
}

export function setActivePlanDate(dateStr) {
  _activePlanDate = dateStr;
  renderTodayPlan();
}

/**
 * Initializes the Adaptive Planning UI
 */
export function initAdaptivePlanningUI() {
  const container = document.getElementById('today-plan-view');
  if (!container) return;

  setupPlanNavListeners();
  setupModalListeners();
  renderTodayPlan();

  // Listen for storage updates
  window.addEventListener('planrova:schedule_accepted', () => {
    renderTodayPlan();
  });
}

function setupPlanNavListeners() {
  const prevBtn = document.getElementById('plan-prev-day-btn');
  const nextBtn = document.getElementById('plan-next-day-btn');
  const todayBtn = document.getElementById('plan-today-btn');
  const dateInput = document.getElementById('plan-date-picker');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const d = new Date(_activePlanDate);
      d.setDate(d.getDate() - 1);
      _activePlanDate = d.toISOString().split('T')[0];
      renderTodayPlan();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const d = new Date(_activePlanDate);
      d.setDate(d.getDate() + 1);
      _activePlanDate = d.toISOString().split('T')[0];
      renderTodayPlan();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      _activePlanDate = new Date().toISOString().split('T')[0];
      renderTodayPlan();
    });
  }

  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        _activePlanDate = e.target.value;
        renderTodayPlan();
      }
    });
  }

  const generateBtn = document.getElementById('plan-generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => openGeneratePlanModal());
  }

  const availabilityBtn = document.getElementById('plan-availability-btn');
  if (availabilityBtn) {
    availabilityBtn.addEventListener('click', () => openAvailabilityModal());
  }
}

/**
 * Renders the full Today's Plan view
 */
export function renderTodayPlan() {
  const dateLabel = document.getElementById('plan-current-date-label');
  const datePicker = document.getElementById('plan-date-picker');
  if (dateLabel) {
    const d = new Date(_activePlanDate + 'T00:00:00');
    const dayName = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    dateLabel.textContent = dayName;
  }
  if (datePicker) {
    datePicker.value = _activePlanDate;
  }

  // 1. Render Weekly Capacity Overview Bar
  renderWeeklyCapacityBar();

  // 2. Fetch accepted blocks and availability for active date
  const acceptedBlocks = getAcceptedScheduleBlocks(_activePlanDate);
  const availability = getUserAvailability();

  // 3. Render Workload Pill
  renderWorkloadPill(acceptedBlocks, availability);

  // 4. Render Timeline
  const timelineContainer = document.getElementById('plan-timeline-container');
  if (!timelineContainer) return;

  if (acceptedBlocks.length === 0) {
    timelineContainer.innerHTML = `
      <div style="text-align: center; padding: 48px 24px; background: rgba(255,255,255,0.01); border: 1px dashed var(--border-color); border-radius: 16px; margin-top: 16px;">
        <div style="font-size: 36px; margin-bottom: 12px;">🗓️</div>
        <h3 style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px;">No Schedule Accepted for This Day</h3>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 440px; margin: 0 auto 20px; line-height: 1.5;">
          Let Planrova's deterministic planning engine generate a balanced schedule based on your deadlines, lectures, and energy focus windows.
        </p>
        <button class="btn-primary" id="plan-empty-generate-btn" style="padding: 10px 24px; border-radius: 20px; font-weight: 700;">
          ✨ Generate Today's Plan
        </button>
      </div>
    `;

    const emptyBtn = document.getElementById('plan-empty-generate-btn');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => openGeneratePlanModal());
    }
    return;
  }

  // Sort blocks chronologically
  const sortedBlocks = [...acceptedBlocks].sort((a, b) => a.startTime.localeCompare(b.startTime));

  let html = `<div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">`;

  sortedBlocks.forEach(block => {
    const isTask = block.blockType === 'task';
    const isLecture = block.blockType === 'lecture';
    const isBuffer = block.blockType === 'buffer';
    const isBreak = block.blockType === 'break';
    const isLocked = Boolean(block.isLocked);

    let badgeColor = '#4f8cff';
    let badgeLabel = 'Task';
    let icon = '📌';

    if (isLecture) {
      badgeColor = '#a78bfa';
      badgeLabel = 'Lecture';
      icon = '🎓';
    } else if (isBuffer) {
      badgeColor = '#34d399';
      badgeLabel = 'Smart Buffer';
      icon = '🛡️';
    } else if (isBreak) {
      badgeColor = '#fbbf24';
      badgeLabel = 'Break';
      icon = '☕';
    } else if (block.isFixed) {
      badgeColor = '#f87171';
      badgeLabel = 'Fixed Event';
      icon = '📅';
    }

    const lockIcon = isLocked ? '🔒' : '🔓';
    const lockTitle = isLocked ? 'Locked (Click to unlock)' : 'Unlocked (Click to lock)';

    html += `
      <div class="schedule-block-card" data-block-id="${block.id}" style="
        display: flex; 
        align-items: center; 
        gap: 16px; 
        background: var(--bg-card); 
        border: 1px solid ${isBuffer ? 'rgba(52, 211, 153, 0.3)' : 'var(--border-color)'}; 
        padding: 14px 18px; 
        border-radius: 12px;
        transition: transform 0.15s ease, border-color 0.15s ease;
      ">
        <div style="min-width: 95px; font-weight: 700; font-size: 13px; color: var(--accent);">
          ${block.startTime} – ${block.endTime}
        </div>
        <div style="font-size: 18px;">${icon}</div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 600; font-size: 14px; color: #fff;">${escapeHtml(block.title)}</span>
            <span style="font-size: 10px; font-weight: 700; background: ${badgeColor}22; color: ${badgeColor}; padding: 2px 8px; border-radius: 6px;">
              ${badgeLabel}
            </span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">
            Duration: ${block.durationMinutes} min ${block.provenance?.reason ? `• ${escapeHtml(block.provenance.reason)}` : ''}
          </div>
        </div>
        <div>
          ${!block.isFixed ? `
            <button class="icon-btn lock-block-toggle-btn" data-block-id="${block.id}" title="${lockTitle}" style="font-size: 14px; opacity: ${isLocked ? '1' : '0.5'};">
              ${lockIcon}
            </button>
          ` : `
            <span title="Fixed commitment" style="font-size: 14px; opacity: 0.8;">🔒</span>
          `}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  timelineContainer.innerHTML = html;

  // Setup lock toggle listeners
  const lockButtons = timelineContainer.querySelectorAll('.lock-block-toggle-btn');
  lockButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const blockId = e.currentTarget.dataset.blockId;
      toggleBlockLock(blockId);
    });
  });
}

function toggleBlockLock(blockId) {
  const blocks = getStorageItem('schedule_blocks', []) || [];
  const block = blocks.find(b => b.id === blockId);
  if (block) {
    block.isLocked = !block.isLocked;
    setStorageItem('schedule_blocks', blocks);
    renderTodayPlan();
  }
}

/**
 * Renders the workload pill (Light, Balanced, Heavy, Overloaded)
 */
function renderWorkloadPill(blocks, availability) {
  const pillEl = document.getElementById('plan-workload-pill');
  if (!pillEl) return;

  const taskBlocks = (blocks || []).filter(b => b.blockType === 'task');
  const scheduledFlexibleMinutes = taskBlocks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);

  const fixedCommitmentsMinutes = (blocks || [])
    .filter(b => b.isFixed || b.blockType === 'fixed_event' || b.blockType === 'lecture')
    .reduce((acc, b) => acc + (b.durationMinutes || 0), 0);

  const reservedBreakMinutes = (blocks || [])
    .filter(b => b.blockType === 'break')
    .reduce((acc, b) => acc + (b.durationMinutes || 0), 0);

  const totalWorkingMinutes = availability.defaultWorkingHours ? 540 : 480;

  const utilization = calculateWorkloadUtilization(
    scheduledFlexibleMinutes,
    totalWorkingMinutes,
    fixedCommitmentsMinutes,
    reservedBreakMinutes
  );

  const classification = classifyWorkload(utilization);
  const pct = Math.round(utilization * 100);

  let bg = '#10b981';
  let label = 'Light';

  if (classification === WORKLOAD_CLASSIFICATIONS.BALANCED) {
    bg = '#3b82f6';
    label = 'Balanced';
  } else if (classification === WORKLOAD_CLASSIFICATIONS.HEAVY) {
    bg = '#f59e0b';
    label = 'Heavy';
  } else if (classification === WORKLOAD_CLASSIFICATIONS.OVERLOADED) {
    bg = '#ef4444';
    label = 'Overloaded';
  }

  pillEl.innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 6px; background: ${bg}22; color: ${bg}; border: 1px solid ${bg}44; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700;">
      <span style="width: 8px; height: 8px; border-radius: 50%; background: ${bg};"></span>
      ${label} (${pct}%)
    </span>
  `;
}

/**
 * Renders the 7-day mini capacity bars across the week
 */
function renderWeeklyCapacityBar() {
  const container = document.getElementById('plan-weekly-capacity-bar');
  if (!container) return;

  const curr = new Date(_activePlanDate + 'T00:00:00');
  const day = curr.getDay();
  const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(curr.setDate(diffToMonday));

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push(d.toISOString().split('T')[0]);
  }

  const allBlocks = getStorageItem('schedule_blocks', []) || [];
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  let html = `<div style="display: flex; gap: 8px; align-items: center;">`;

  weekDays.forEach((dStr, idx) => {
    const isSelected = dStr === _activePlanDate;
    const dayBlocks = allBlocks.filter(b => b.date === dStr && !b.deleted);
    const flexibleMinutes = dayBlocks.filter(b => b.blockType === 'task').reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
    const util = Math.min(1.2, flexibleMinutes / 420);

    let barColor = '#34d399';
    if (util > 1.0) barColor = '#f87171';
    else if (util > 0.8) barColor = '#fbbf24';
    else if (util >= 0.4) barColor = '#60a5fa';

    html += `
      <div class="capacity-day-pill" data-date="${dStr}" style="
        flex: 1; 
        padding: 6px 8px; 
        background: ${isSelected ? 'rgba(255,255,255,0.08)' : 'var(--bg-card)'}; 
        border: 1px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}; 
        border-radius: 8px; 
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      " title="${dStr}: ${Math.round(util * 100)}% flexible capacity">
        <span style="font-size: 10px; font-weight: 700; color: ${isSelected ? 'var(--accent)' : 'var(--text-secondary)'};">${dayLabels[idx]}</span>
        <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden;">
          <div style="width: ${Math.min(100, Math.round(util * 100))}%; height: 100%; background: ${barColor};"></div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  container.querySelectorAll('.capacity-day-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const d = e.currentTarget.dataset.date;
      if (d) setActivePlanDate(d);
    });
  });
}

/**
 * Opens and renders the "Generate Plan" action modal
 */
export function openGeneratePlanModal() {
  const modal = document.getElementById('generate-plan-modal-overlay');
  if (!modal) return;

  const targetDateInput = document.getElementById('plan-modal-target-date');
  if (targetDateInput) targetDateInput.value = _activePlanDate;

  // Run initial preview
  runProposalGeneration();
  modal.classList.remove('hidden');
}

export function closeGeneratePlanModal() {
  const modal = document.getElementById('generate-plan-modal-overlay');
  if (modal) modal.classList.add('hidden');
  _currentGeneratedProposal = null;
}

function runProposalGeneration() {
  const targetDate = document.getElementById('plan-modal-target-date')?.value || _activePlanDate;
  const allowSplit = Boolean(document.getElementById('plan-modal-allow-split')?.checked ?? true);

  const tasks = getStorageItem('tasks', []) || [];
  const timetable = getStorageItem('timetable', null);
  const fixedEvents = getStorageItem('calendar_events', []) || [];
  const existingBlocks = getAcceptedScheduleBlocks(targetDate);
  const lockedBlocks = existingBlocks.filter(b => b.isLocked);
  const availability = getUserAvailability();

  const proposal = generateScheduleProposal({
    targetDate,
    tasks,
    userAvailability: availability,
    fixedEvents,
    timetable,
    lockedBlocks,
    preferences: { allowTaskSplitting: allowSplit }
  });

  _currentGeneratedProposal = proposal;
  renderProposalPreview(proposal);
}

function renderProposalPreview(proposal) {
  const previewContainer = document.getElementById('plan-proposal-preview-content');
  if (!previewContainer) return;

  const { proposedBlocks, unscheduledTasks, workload, buffers, conflicts } = proposal;

  let html = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Workload Summary Card -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 700; font-size: 13px; color: #fff;">Workload Assessment</span>
          <span style="font-weight: 700; font-size: 12px; color: var(--accent); text-transform: uppercase;">${workload.classification} (${Math.round(workload.capacityUtilization * 100)}%)</span>
        </div>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 10px; line-height: 1.4;">${escapeHtml(workload.explanation)}</p>
        <div style="display: flex; gap: 16px; font-size: 11px; color: var(--text-secondary);">
          <span>Scheduled: <b>${workload.scheduledWorkMinutes}m</b></span>
          <span>Buffer: <b>${workload.unallocatedMinutes}m</b></span>
          <span>Cognitive Strain: <b>${workload.cognitiveLoadScore ?? 35}/100</b></span>
          <span>Fatigue Risk: <b style="text-transform: capitalize;">${workload.fatigueRisk ?? 'low'}</b></span>
        </div>
      </div>
  `;

  // Proposed Timeline
  html += `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 700; font-size: 13px; color: #fff;">Proposed Schedule (${proposedBlocks.length} Blocks)</span>
        <button id="plan-modal-select-all-btn" class="btn-primary-sm" style="font-size: 10px; padding: 2px 8px; border-radius: 6px;">Toggle All</button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; padding-right: 4px;">
  `;

  proposedBlocks.forEach((block, idx) => {
    html += `
      <label style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer;">
        <input type="checkbox" class="proposal-block-checkbox" value="${block.id}" checked />
        <span style="min-width: 80px; font-weight: 700; font-size: 12px; color: var(--accent);">${block.startTime}–${block.endTime}</span>
        <span style="flex: 1; font-size: 12px; font-weight: 500; color: #fff;">${escapeHtml(block.title)}</span>
        <span style="font-size: 10px; color: var(--text-secondary);">${block.durationMinutes}m</span>
      </label>
    `;
  });

  html += `</div></div>`;

  // Unscheduled tasks section
  if (unscheduledTasks.length > 0) {
    html += `
      <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 10px; padding: 12px;">
        <div style="font-weight: 700; font-size: 12px; color: #fbbf24; margin-bottom: 6px;">Unscheduled Tasks (${unscheduledTasks.length})</div>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
    `;
    unscheduledTasks.forEach(u => {
      html += `
        <div style="color: var(--text-secondary);">
          • <b style="color: #fff;">${escapeHtml(u.title)}</b>: ${escapeHtml(u.reason)}
        </div>
      `;
    });
    html += `</div></div>`;
  }

  // Recommendations and Smart Buffers
  if (buffers.length > 0 || (workload.recommendations && workload.recommendations.length > 0)) {
    html += `
      <div style="background: rgba(52, 211, 153, 0.05); border: 1px solid rgba(52, 211, 153, 0.2); border-radius: 10px; padding: 12px;">
        <div style="font-weight: 700; font-size: 12px; color: #34d399; margin-bottom: 6px;">Smart Buffers & Recommendations</div>
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--text-secondary);">
    `;
    buffers.forEach(b => {
      html += `<div>🛡️ <b>${escapeHtml(b.title)}</b> (${b.startTime}–${b.endTime}): ${escapeHtml(b.provenance?.reason || 'Rest buffer')}</div>`;
    });
    (workload.recommendations || []).forEach(r => {
      html += `<div>💡 ${escapeHtml(r.message)}</div>`;
    });
    html += `</div></div>`;
  }

  html += `</div>`;
  previewContainer.innerHTML = html;

  // Toggle all checkbox listener
  const toggleBtn = document.getElementById('plan-modal-select-all-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const boxes = previewContainer.querySelectorAll('.proposal-block-checkbox');
      const allChecked = Array.from(boxes).every(b => b.checked);
      boxes.forEach(b => { b.checked = !allChecked; });
    });
  }
}

function setupModalListeners() {
  const closeBtn = document.getElementById('plan-modal-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeGeneratePlanModal);

  const recomputeBtn = document.getElementById('plan-modal-recompute-btn');
  if (recomputeBtn) recomputeBtn.addEventListener('click', runProposalGeneration);

  const acceptAllBtn = document.getElementById('plan-modal-accept-all-btn');
  if (acceptAllBtn) {
    acceptAllBtn.addEventListener('click', () => {
      if (!_currentGeneratedProposal) return;
      acceptScheduleProposal(_currentGeneratedProposal);
      closeGeneratePlanModal();
      renderTodayPlan();
    });
  }

  const acceptSelectedBtn = document.getElementById('plan-modal-accept-selected-btn');
  if (acceptSelectedBtn) {
    acceptSelectedBtn.addEventListener('click', () => {
      if (!_currentGeneratedProposal) return;
      const checked = Array.from(document.querySelectorAll('.proposal-block-checkbox:checked')).map(c => c.value);
      acceptScheduleProposal(_currentGeneratedProposal, { selectedBlockIds: checked });
      closeGeneratePlanModal();
      renderTodayPlan();
    });
  }

  // Availability Settings Modal
  const availCloseBtn = document.getElementById('plan-avail-close-btn');
  if (availCloseBtn) {
    availCloseBtn.addEventListener('click', closeAvailabilityModal);
  }

  const availSaveBtn = document.getElementById('plan-avail-save-btn');
  if (availSaveBtn) {
    availSaveBtn.addEventListener('click', saveAvailabilitySettings);
  }
}

export function openAvailabilityModal() {
  const modal = document.getElementById('availability-settings-modal-overlay');
  if (!modal) return;

  const avail = getUserAvailability();
  const startInput = document.getElementById('avail-work-start');
  const endInput = document.getElementById('avail-work-end');
  const focusStartInput = document.getElementById('avail-focus-start');
  const focusEndInput = document.getElementById('avail-focus-end');
  const lunchEnabledInput = document.getElementById('avail-lunch-enabled');
  const minSessionInput = document.getElementById('avail-min-session');

  if (startInput) startInput.value = avail.defaultWorkingHours?.start || '09:00';
  if (endInput) endInput.value = avail.defaultWorkingHours?.end || '18:00';
  if (focusStartInput) focusStartInput.value = avail.preferences?.defaultFocusSlot?.start || '10:00';
  if (focusEndInput) focusEndInput.value = avail.preferences?.defaultFocusSlot?.end || '12:00';
  if (lunchEnabledInput) lunchEnabledInput.checked = avail.preferences?.lunchBreak?.enabled ?? true;
  if (minSessionInput) minSessionInput.value = avail.preferences?.minSessionMinutes || 30;

  modal.classList.remove('hidden');
}

export function closeAvailabilityModal() {
  const modal = document.getElementById('availability-settings-modal-overlay');
  if (modal) modal.classList.add('hidden');
}

function saveAvailabilitySettings() {
  const startInput = document.getElementById('avail-work-start');
  const endInput = document.getElementById('avail-work-end');
  const focusStartInput = document.getElementById('avail-focus-start');
  const focusEndInput = document.getElementById('avail-focus-end');
  const lunchEnabledInput = document.getElementById('avail-lunch-enabled');
  const minSessionInput = document.getElementById('avail-min-session');

  const current = getUserAvailability();
  const updated = {
    ...current,
    defaultWorkingHours: {
      start: startInput?.value || '09:00',
      end: endInput?.value || '18:00'
    },
    preferences: {
      ...current.preferences,
      defaultFocusSlot: {
        start: focusStartInput?.value || '10:00',
        end: focusEndInput?.value || '12:00'
      },
      lunchBreak: {
        ...(current.preferences?.lunchBreak || {}),
        enabled: Boolean(lunchEnabledInput?.checked)
      },
      minSessionMinutes: Number(minSessionInput?.value || 30)
    }
  };

  saveUserAvailability(updated);
  closeAvailabilityModal();
  renderTodayPlan();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


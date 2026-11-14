/**
 * src/modules/quick-capture/capture-ui.js
 * Fast, Polished Universal Quick Capture Interface for Planrova 2.0 Web Client
 */

import { 
  CAPTURE_TYPES, 
  CAPTURE_TYPE_LABELS, 
  CAPTURE_TYPE_ICONS, 
  classifyCapture, 
  parseCapture 
} from '../../../shared/domain/index.js';
import { executeQuickCapture } from './capture-controller.js';

let activeOverrideType = null;

export function initQuickCaptureUI() {
  injectCaptureModal();
  injectFloatingActionButton();
  setupEventListeners();
}

function injectFloatingActionButton() {
  if (document.getElementById('quick-capture-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'quick-capture-fab';
  fab.className = 'quick-capture-fab';
  fab.title = 'Universal Quick Capture (Ctrl+Q)';
  fab.innerHTML = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" style="display:block;">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `;
  
  fab.addEventListener('click', () => {
    openQuickCaptureModal();
  });

  document.body.appendChild(fab);
}

function injectCaptureModal() {
  if (document.getElementById('quick-capture-modal-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'quick-capture-modal-overlay';
  overlay.className = 'modal-overlay hidden';
  overlay.style.zIndex = '10000';

  overlay.innerHTML = `
    <div class="modal-card quick-capture-card" style="max-width: 540px; width: 90%; background: #171B22; border: 1px solid rgba(194, 168, 120, 0.3); border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); padding: 24px; position: relative;">
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">⚡</span>
          <span style="font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 15px; color: #F3F1EC; letter-spacing: 0.5px;">UNIVERSAL QUICK CAPTURE</span>
        </div>
        <button id="quick-capture-close-btn" class="icon-btn" style="background: none; border: none; color: #8B92A0; font-size: 18px; cursor: pointer; padding: 4px;">✕</button>
      </div>

      <!-- Main Input -->
      <div style="margin-bottom: 16px;">
        <input 
          type="text" 
          id="quick-capture-input" 
          placeholder="Capture anything... 'Spent ₹150 on lunch', 'DBMS lecture tomorrow at 10', 'Read 20 pages daily'"
          style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px 16px; font-size: 14px; color: #F3F1EC; outline: none; font-family: 'Plus Jakarta Sans', sans-serif;"
          autocomplete="off"
        />
      </div>

      <!-- Type Badges Row -->
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;" id="quick-capture-type-pills">
        ${CAPTURE_TYPES.map(type => `
          <button 
            type="button" 
            class="capture-type-pill" 
            data-type="${type}"
            style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 6px 12px; font-size: 11px; color: #8B92A0; cursor: pointer; transition: all 0.2s;"
          >
            <span>${CAPTURE_TYPE_ICONS[type]}</span>
            <span>${CAPTURE_TYPE_LABELS[type]}</span>
          </button>
        `).join('')}
      </div>

      <!-- Live Classification & Preview Box -->
      <div id="quick-capture-preview-box" style="background: rgba(0,0,0,0.25); border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #8B92A0; display: flex; align-items: center; justify-content: space-between; min-height: 24px;">
        <span id="quick-capture-preview-text">Type your thought above to see intelligent classification</span>
        <span id="quick-capture-confidence-badge" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; display: none;"></span>
      </div>

      <!-- Action Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 11px; color: #5A6070;">Press <kbd style="background: #1D2430; padding: 2px 5px; border-radius: 4px; color: #8B92A0;">Enter</kbd> to save • <kbd style="background: #1D2430; padding: 2px 5px; border-radius: 4px; color: #8B92A0;">Esc</kbd> to close</span>
        <button 
          id="quick-capture-submit-btn" 
          style="background: #C2A878; color: #0F1115; font-weight: 700; font-size: 13px; padding: 10px 22px; border: none; border-radius: 8px; cursor: pointer; transition: opacity 0.2s;"
        >
          Capture
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);
}

function setupEventListeners() {
  const overlay = document.getElementById('quick-capture-modal-overlay');
  const input = document.getElementById('quick-capture-input');
  const closeBtn = document.getElementById('quick-capture-close-btn');
  const submitBtn = document.getElementById('quick-capture-submit-btn');
  const pillsContainer = document.getElementById('quick-capture-type-pills');

  if (!overlay || !input) return;

  // Global Keyboard Shortcut: Ctrl+Q or Cmd+Q
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
      e.preventDefault();
      openQuickCaptureModal();
    }
  });

  // Close handlers
  closeBtn.addEventListener('click', closeQuickCaptureModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeQuickCaptureModal();
  });

  // Real-time classification on input
  input.addEventListener('input', () => {
    updatePreviewState();
  });

  // Enter to submit
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  });

  // Submit button click
  submitBtn.addEventListener('click', handleSubmit);

  // Type Pills override clicks
  pillsContainer.addEventListener('click', (e) => {
    const pill = e.target.closest('.capture-type-pill');
    if (!pill) return;
    const selected = pill.dataset.type;
    activeOverrideType = activeOverrideType === selected ? null : selected;
    updatePillsVisuals();
    updatePreviewState();
  });
}

export function openQuickCaptureModal(initialText = '') {
  const overlay = document.getElementById('quick-capture-modal-overlay');
  const input = document.getElementById('quick-capture-input');
  if (!overlay || !input) return;

  activeOverrideType = null;
  input.value = initialText;
  overlay.classList.remove('hidden');
  updatePillsVisuals();
  updatePreviewState();
  setTimeout(() => input.focus(), 50);
}

export function closeQuickCaptureModal() {
  const overlay = document.getElementById('quick-capture-modal-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function updatePreviewState() {
  const input = document.getElementById('quick-capture-input');
  const previewText = document.getElementById('quick-capture-preview-text');
  const confBadge = document.getElementById('quick-capture-confidence-badge');

  if (!input || !previewText || !confBadge) return;

  const text = input.value.trim();
  if (!text) {
    previewText.textContent = "Type your thought above to see intelligent classification";
    confBadge.style.display = 'none';
    updatePillsVisuals(null);
    return;
  }

  const classification = classifyCapture(text);
  const effectiveType = activeOverrideType || classification.suggestedType;
  const fields = parseCapture(text, effectiveType);

  updatePillsVisuals(effectiveType);

  // Format intelligent preview string
  let detail = '';
  if (effectiveType === 'task') {
    detail = `[Task] "${fields.title}" • Due: ${fields.dueDate || 'Today'} • Priority: ${fields.priority}`;
  } else if (effectiveType === 'expense') {
    detail = `[Expense] ${fields.description} • ₹${fields.amount} (${fields.category})`;
  } else if (effectiveType === 'reminder') {
    detail = `[Reminder] "${fields.title}" • At: ${fields.dueDate} ${fields.dueTime || ''}`;
  } else if (effectiveType === 'habit') {
    detail = `[Habit] "${fields.name}" • Daily streak tracking`;
  } else if (effectiveType === 'calendar_event') {
    detail = `[Calendar] "${fields.title}" • ${fields.date} (${fields.startTime || 'All day'})`;
  } else if (effectiveType === 'note') {
    detail = `[Note] "${fields.title}" (${fields.subject})`;
  } else {
    detail = `[Brain Dump] Save raw thought to review later`;
  }

  previewText.textContent = detail;

  // Confidence badge
  confBadge.style.display = 'inline-block';
  const pct = Math.round(classification.confidence * 100);
  confBadge.textContent = `${pct}% Match`;
  confBadge.style.background = pct >= 80 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)';
  confBadge.style.color = pct >= 80 ? '#34d399' : '#f59e0b';
}

function updatePillsVisuals(activeType = null) {
  const pills = document.querySelectorAll('.capture-type-pill');
  pills.forEach(pill => {
    const isTarget = pill.dataset.type === (activeOverrideType || activeType);
    if (isTarget) {
      pill.style.background = 'rgba(194, 168, 120, 0.2)';
      pill.style.borderColor = '#C2A878';
      pill.style.color = '#F3F1EC';
      pill.style.fontWeight = '700';
    } else {
      pill.style.background = 'rgba(255,255,255,0.05)';
      pill.style.borderColor = 'rgba(255,255,255,0.08)';
      pill.style.color = '#8B92A0';
      pill.style.fontWeight = '400';
    }
  });
}

function handleSubmit() {
  const input = document.getElementById('quick-capture-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  const result = executeQuickCapture(val, activeOverrideType);
  if (result.success) {
    showQuickCaptureToast(`Captured as ${CAPTURE_TYPE_LABELS[result.type]}! ⚡`);
    closeQuickCaptureModal();
  } else {
    alert(result.error || 'Failed to capture');
  }
}

function showQuickCaptureToast(msg) {
  const existing = document.getElementById('quick-capture-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'quick-capture-toast';
  toast.textContent = msg;
  toast.style.position = 'fixed';
  toast.style.bottom = '90px';
  toast.style.right = '24px';
  toast.style.background = '#1D2430';
  toast.style.color = '#F3F1EC';
  toast.style.border = '1px solid #C2A878';
  toast.style.padding = '10px 18px';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '13px';
  toast.style.zIndex = '10001';
  toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
  toast.style.transition = 'opacity 0.3s';

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}


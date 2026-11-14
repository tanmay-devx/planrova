/**
 * Planrova 2.0 — Sync Transparency & Conflict Audit UI
 * Real-time bidirectional sync indicator, manual sync trigger,
 * and conflict notification audit.
 */

import { getSyncStatus, syncPendingChanges } from '../../db/syncEngine.js';
import { getStorageItem, setStorageItem } from '../../utils/storage.js';

export const CONFLICT_LOG_KEY = 'planrova_sync_conflicts';

/**
 * Initializes the Sync Status indicator in the top header.
 */
export function initSyncStatusUI() {
  const topBarRight = document.querySelector('.top-bar-right');
  if (!topBarRight) return;

  let container = document.getElementById('sync-status-indicator-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sync-status-indicator-container';
    container.style.position = 'relative';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.marginRight = '8px';
    topBarRight.insertBefore(container, topBarRight.firstChild);
  }

  // Render initial status
  renderSyncStatusPill(container, getSyncStatus());

  // Listen to custom sync status events from SyncEngine
  if (typeof window !== 'undefined') {
    window.addEventListener('planrova:sync_status', (e) => {
      renderSyncStatusPill(container, e.detail || getSyncStatus());
    });

    window.addEventListener('planrova:sync_conflict', (e) => {
      recordConflictAudit(e.detail);
      renderSyncStatusPill(container, getSyncStatus());
    });

    window.addEventListener('online', () => {
      syncPendingChanges();
    });

    window.addEventListener('offline', () => {
      renderSyncStatusPill(container, { state: 'offline', pendingCount: getSyncStatus().pendingCount });
    });
  }
}

/**
 * Records conflict audit to persistent storage.
 */
export function recordConflictAudit(detail = {}) {
  const logs = getStorageItem(CONFLICT_LOG_KEY, []);
  logs.unshift({
    key: detail.key || 'unknown',
    timestamp: detail.timestamp || Date.now(),
    message: detail.message || `Automated non-destructive merge for ${detail.key || 'record'}`
  });
  // Keep last 20 conflict audit records
  setStorageItem(CONFLICT_LOG_KEY, logs.slice(0, 20));
}

/**
 * Formats relative time (e.g., "just now", "2m ago")
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Never';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

/**
 * Renders the sync indicator badge.
 */
export function renderSyncStatusPill(container, status = {}) {
  if (!container) return;

  const isOnline = status.isOnline !== undefined
    ? status.isOnline
    : (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true);
  const state = !isOnline ? 'offline' : (status.state || 'synced');
  const pending = status.pendingCount || 0;
  const lastSyncStr = formatTimeAgo(status.lastSyncTime);

  let dotColor = '#10b981'; // Green
  let label = 'Synced';
  let badgeBorder = 'rgba(16, 185, 129, 0.3)';
  let badgeBg = 'rgba(16, 185, 129, 0.08)';

  if (state === 'syncing') {
    dotColor = '#f59e0b'; // Amber
    label = 'Syncing...';
    badgeBorder = 'rgba(245, 158, 11, 0.3)';
    badgeBg = 'rgba(245, 158, 11, 0.08)';
  } else if (state === 'offline') {
    dotColor = '#9ca3af'; // Grey
    label = pending > 0 ? `Offline (${pending})` : 'Offline';
    badgeBorder = 'rgba(156, 163, 175, 0.3)';
    badgeBg = 'rgba(156, 163, 175, 0.08)';
  } else if (state === 'error') {
    dotColor = '#ef4444'; // Red
    label = 'Sync Error';
    badgeBorder = 'rgba(239, 68, 68, 0.3)';
    badgeBg = 'rgba(239, 68, 68, 0.08)';
  }

  container.innerHTML = `
    <button id="sync-status-pill-btn" style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 12px;
      background: ${badgeBg};
      border: 1px solid ${badgeBorder};
      color: var(--text-primary);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    " title="Click to view sync details and trigger manual sync">
      <span style="
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: ${dotColor};
        display: inline-block;
        ${state === 'syncing' ? 'animation: sync-pulse 1s infinite alternate;' : ''}
      "></span>
      <span>${label}</span>
    </button>

    <div id="sync-details-dropdown" class="hidden" style="
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 260px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 14px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      z-index: 1000;
      font-size: 12px;
    ">
      <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 8px; display: flex; justify-content: space-between;">
        <span>Cloud Sync Status</span>
        <span style="color: ${dotColor}; font-weight: 800; font-size: 11px; text-transform: uppercase;">${state}</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px; color: var(--text-secondary); margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Connection:</span>
          <span style="font-weight: 600; color: var(--text-primary);">${isOnline ? 'Online 🌐' : 'Offline 🚫'}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Last sync:</span>
          <span style="font-weight: 600; color: var(--text-primary);">${lastSyncStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Pending local edits:</span>
          <span style="font-weight: 600; color: ${pending > 0 ? '#f59e0b' : 'var(--text-primary)'};">${pending}</span>
        </div>
      </div>

      <button id="sync-now-action-btn" class="btn-primary" style="
        width: 100%;
        padding: 7px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        margin-bottom: 10px;
      ">
        ↻ Sync Now
      </button>

      <div id="sync-conflict-audit-section" style="border-top: 1px solid var(--border-color); padding-top: 8px;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Recent Conflict Audits</div>
        <div id="sync-conflict-list" style="max-height: 80px; overflow-y: auto; font-size: 10px; color: var(--text-secondary);">
          ${renderConflictListHTML()}
        </div>
      </div>
    </div>
  `;

  // Toggle dropdown on button click
  const pillBtn = container.querySelector('#sync-status-pill-btn');
  const dropdown = container.querySelector('#sync-details-dropdown');
  const syncNowBtn = container.querySelector('#sync-now-action-btn');

  if (pillBtn && dropdown) {
    pillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      syncPendingChanges();
    });
  }
}

/**
 * Returns formatted HTML of recent conflict audits.
 */
function renderConflictListHTML() {
  const conflicts = getStorageItem(CONFLICT_LOG_KEY, []);
  if (conflicts.length === 0) {
    return '<span style="color: var(--text-muted);">No conflicts detected. Clean sync!</span>';
  }
  return conflicts.slice(0, 3).map(c => `
    <div style="padding: 2px 0; border-bottom: 1px dashed rgba(255,255,255,0.05);">
      <span style="color: var(--accent); font-weight: 600;">${c.key}:</span> ${c.message}
    </div>
  `).join('');
}

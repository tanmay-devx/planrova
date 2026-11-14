import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordConflictAudit,
  renderSyncStatusPill,
  CONFLICT_LOG_KEY
} from '../src/modules/sync/sync-status.ui.js';
import { resolveSyncConflict } from '../src/db/syncEngine.js';

// In-memory mock storage
const storageMap = new Map();
vi.mock('../src/utils/storage.js', () => ({
  getStorageItem: vi.fn((key, defaultValue) => {
    return storageMap.has(key) ? storageMap.get(key) : defaultValue;
  }),
  setStorageItem: vi.fn((key, value) => {
    storageMap.set(key, value);
  })
}));

// Mock syncEngine's getSyncStatus and syncPendingChanges
vi.mock('../src/db/syncEngine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSyncStatus: vi.fn(() => ({ state: 'synced', pendingCount: 0, lastSyncTime: Date.now(), lastError: null })),
    syncPendingChanges: vi.fn(async () => {})
  };
});

describe('Stage 4 — Sync Transparency & Conflict Resolution Tests', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
  });

  describe('1. Conflict Audit Logger', () => {
    it('records conflict events into persistent audit storage', () => {
      recordConflictAudit({
        key: 'tasks',
        message: 'Merged 2 concurrent edits on tasks'
      });

      const logs = storageMap.get(CONFLICT_LOG_KEY);
      expect(logs).toBeDefined();
      expect(logs.length).toBe(1);
      expect(logs[0].key).toBe('tasks');
      expect(logs[0].message).toContain('Merged 2 concurrent edits');
    });

    it('caps conflict audit history at 20 entries', () => {
      const existing = [];
      for (let i = 0; i < 25; i++) {
        existing.push({ key: `key_${i}`, timestamp: i });
      }
      storageMap.set(CONFLICT_LOG_KEY, existing);

      recordConflictAudit({ key: 'new_conflict' });

      const logs = storageMap.get(CONFLICT_LOG_KEY);
      expect(logs.length).toBe(20);
      expect(logs[0].key).toBe('new_conflict');
    });
  });

  describe('2. Sync Status Badge Renderer', () => {
    function createMockContainer() {
      return {
        innerHTML: '',
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(() => [])
      };
    }

    it('renders green Synced state correctly', () => {
      const container = createMockContainer();
      renderSyncStatusPill(container, {
        state: 'synced',
        pendingCount: 0,
        lastSyncTime: Date.now()
      });

      expect(container.innerHTML).toContain('Synced');
      expect(container.innerHTML).toContain('#10b981');
    });

    it('renders amber Syncing state correctly', () => {
      const container = createMockContainer();
      renderSyncStatusPill(container, {
        state: 'syncing',
        pendingCount: 3,
        lastSyncTime: Date.now()
      });

      expect(container.innerHTML).toContain('Syncing...');
      expect(container.innerHTML).toContain('#f59e0b');
    });

    it('renders offline state with pending mutation count', () => {
      const container = createMockContainer();
      renderSyncStatusPill(container, {
        state: 'offline',
        pendingCount: 4
      });

      expect(container.innerHTML).toContain('Offline (4)');
      expect(container.innerHTML).toContain('#9ca3af');
    });

    it('renders error state with Sync Error label', () => {
      const container = createMockContainer();
      renderSyncStatusPill(container, {
        state: 'error',
        lastError: 'Network unreachable'
      });

      expect(container.innerHTML).toContain('Sync Error');
      expect(container.innerHTML).toContain('#ef4444');
    });
  });

  describe('3. Non-Destructive Conflict Resolution Logic', () => {
    it('merges collections without losing items from either local or cloud', () => {
      const localRecord = {
        value: JSON.stringify([
          { id: 't1', title: 'Local Edited Task', completed: true, updated_at: 200 },
          { id: 't2', title: 'Local Only Task', completed: false, updated_at: 100 }
        ])
      };

      const cloudData = {
        value: JSON.stringify([
          { id: 't1', title: 'Cloud Version Task', completed: false, updated_at: 150 },
          { id: 't3', title: 'Cloud Only Task', completed: false, updated_at: 120 }
        ])
      };

      const merged = resolveSyncConflict('tasks', localRecord, cloudData);

      expect(merged.length).toBe(3);
      // t1: local has newer timestamp (200 > 150) -> local title wins, but completed is preserved
      const t1 = merged.find(i => i.id === 't1');
      expect(t1.title).toBe('Local Edited Task');
      expect(t1.completed).toBe(true);

      // t2: local only preserved
      expect(merged.some(i => i.id === 't2')).toBe(true);
      // t3: cloud only preserved
      expect(merged.some(i => i.id === 't3')).toBe(true);
    });

    it('honors tombstones to ensure deleted items are purged', () => {
      const localRecord = {
        value: JSON.stringify([
          { id: 't1', title: 'Task to delete', deleted: true, updated_at: 300 }
        ])
      };

      const cloudData = {
        value: JSON.stringify([
          { id: 't1', title: 'Task to delete', deleted: false, updated_at: 200 }
        ])
      };

      const merged = resolveSyncConflict('tasks', localRecord, cloudData);
      expect(merged.length).toBe(0); // Tombstone should filter out deleted item
    });

    it('resolves focus coins by preserving maximum earned amount', () => {
      const merged = resolveSyncConflict('focus_coins', { value: 150 }, { value: 220 });
      expect(merged).toBe(220);
    });
  });
});

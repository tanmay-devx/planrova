import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock React for non-React root environment test runner
vi.mock('react', () => ({
  useState: vi.fn((init) => [init, vi.fn()]),
  useEffect: vi.fn((fn) => { fn(); }),
  useRef: vi.fn((init) => ({ current: init })),
  useCallback: vi.fn((fn) => fn)
}));

// In-memory mock for AsyncStorage
const mockStorage = new Map();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key) => mockStorage.has(key) ? mockStorage.get(key) : null),
    setItem: vi.fn(async (key, value) => { mockStorage.set(key, String(value)); }),
    removeItem: vi.fn(async (key) => { mockStorage.delete(key); }),
    clear: vi.fn(async () => { mockStorage.clear(); })
  }
}));

// Mock Firebase Auth and DB
vi.mock('../mobile/src/firebase.js', () => ({
  auth: { currentUser: null },
  db: {}
}));

// Mock Firebase Firestore methods
let mockSetDocFailOnCount = -1;
let currentSetDocCalls = 0;
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, ...parts) => ({ path: parts.join('/') })),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(async (docRef, data) => {
    currentSetDocCalls++;
    if (mockSetDocFailOnCount > 0 && currentSetDocCalls >= mockSetDocFailOnCount) {
      throw new Error('Simulated network offline failure');
    }
    return true;
  })
}));

import {
  getLocalCacheKey,
  getPendingSyncKey,
  flushPendingSyncQueue
} from '../mobile/src/hooks/useFirestoreData.js';

describe('Stage 1.3 — Mobile Offline Data Durability & Storage Isolation', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockSetDocFailOnCount = -1;
    currentSetDocCalls = 0;
    vi.clearAllMocks();
  });

  describe('1. Storage Key Namespacing & Isolation', () => {
    it('generates account-isolated local cache keys', () => {
      const keyUserA = getLocalCacheKey('user_A', 'tasks');
      const keyUserB = getLocalCacheKey('user_B', 'tasks');

      expect(keyUserA).toBe('planrova_user_A_tasks');
      expect(keyUserB).toBe('planrova_user_B_tasks');
      expect(keyUserA).not.toBe(keyUserB);
    });

    it('generates account-isolated pending sync queue keys', () => {
      const queueKeyA = getPendingSyncKey('user_A');
      const queueKeyB = getPendingSyncKey('user_B');

      expect(queueKeyA).toBe('planrova_pending_sync_user_A');
      expect(queueKeyB).toBe('planrova_pending_sync_user_B');
      expect(queueKeyA).not.toBe(queueKeyB);
    });
  });

  describe('2. Offline Pending Sync Queue Lifecycle', () => {
    it('returns 0 if queue is empty or userId is missing', async () => {
      const resultNoUser = await flushPendingSyncQueue(null);
      expect(resultNoUser).toBe(0);

      const resultEmpty = await flushPendingSyncQueue('user_1');
      expect(resultEmpty).toBe(0);
    });

    it('flushes queued mutations to Firestore and clears queue upon success', async () => {
      const userId = 'user_123';
      const queueKey = getPendingSyncKey(userId);

      const queuedItems = [
        { storageKey: 'tasks', value: [{ id: 'task-1', title: 'Study Chem' }], timestamp: 1000 },
        { storageKey: 'expenses', value: [{ id: 'exp-1', amount: 42 }], timestamp: 2000 }
      ];
      mockStorage.set(queueKey, JSON.stringify(queuedItems));

      const flushed = await flushPendingSyncQueue(userId, {});
      expect(flushed).toBe(2);
      expect(mockStorage.has(queueKey)).toBe(false);
    });

    it('retains un-flushed items in queue if remote write fails', async () => {
      const userId = 'user_123';
      const queueKey = getPendingSyncKey(userId);

      const queuedItems = [
        { storageKey: 'tasks', value: [{ id: 'task-1' }], timestamp: 1000 },
        { storageKey: 'notes', value: [{ id: 'note-1' }], timestamp: 2000 }
      ];
      mockStorage.set(queueKey, JSON.stringify(queuedItems));

      // Fail on the 2nd write call
      mockSetDocFailOnCount = 2;

      const flushed = await flushPendingSyncQueue(userId, {});
      expect(flushed).toBe(1);

      // Remaining item must be preserved in storage
      const remainingRaw = mockStorage.get(queueKey);
      expect(remainingRaw).toBeDefined();
      const remaining = JSON.parse(remainingRaw);
      expect(remaining.length).toBe(1);
      expect(remaining[0].storageKey).toBe('notes');
    });
  });
});

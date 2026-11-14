import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { localDB } from '../src/db/database.js';
import { 
  setCurrentUserId, 
  getCurrentUserId, 
  clearMemoryCache, 
  preloadCache, 
  setStorageItem, 
  getStorageItem, 
  migrateLocalRecordsToUser 
} from '../src/utils/storage.js';

describe('Account Isolation & Cross-Account Contamination Prevention', () => {
  beforeEach(async () => {
    clearMemoryCache();
    await localDB.kv_store.clear();
  });

  it('prevents User B from accessing User A in-memory cached records on logout', async () => {
    // 1. User A logs in and saves tasks
    setCurrentUserId('user_A');
    setStorageItem('tasks', [{ id: 'task_A1', title: 'Secret Task A' }]);
    
    expect(getStorageItem('tasks')[0].title).toBe('Secret Task A');

    // 2. User A logs out
    clearMemoryCache();
    setCurrentUserId('local');

    // Memory cache should be empty
    expect(getStorageItem('tasks')).toBeNull();

    // 3. User B logs in and preloads cache
    setCurrentUserId('user_B');
    await preloadCache('user_B');

    // User B should NOT see User A's tasks
    expect(getStorageItem('tasks')).toBeNull();
  });

  it('stores partitioned records in Dexie under scoped keys', async () => {
    // User A writes data
    setCurrentUserId('user_A');
    setStorageItem('tasks', [{ id: 'task_A1', title: 'User A Task' }]);

    // User B writes data
    setCurrentUserId('user_B');
    setStorageItem('tasks', [{ id: 'task_B1', title: 'User B Task' }]);

    // Wait for async indexedDB puts
    const recordA = await localDB.kv_store.get('user_A:tasks');
    const recordB = await localDB.kv_store.get('user_B:tasks');

    expect(recordA).toBeDefined();
    expect(recordA.user_id).toBe('user_A');
    expect(JSON.parse(recordA.value)[0].title).toBe('User A Task');

    expect(recordB).toBeDefined();
    expect(recordB.user_id).toBe('user_B');
    expect(JSON.parse(recordB.value)[0].title).toBe('User B Task');

    // Verify neither overwrote the other
    expect(recordA.id).not.toBe(recordB.id);
  });

  it('ensures User B sync eligibility filters out User A pending records', async () => {
    // User A creates unsynced offline records
    setCurrentUserId('user_A');
    setStorageItem('tasks', [{ id: 'task_A1', title: 'Offline User A' }]);

    // User B logs in
    setCurrentUserId('user_B');
    setStorageItem('budget', [{ id: 'exp_B1', amount: 500 }]);

    // Query pending records in localDB
    const allPending = await localDB.kv_store.where('sync_status').equals('pending').toArray();
    expect(allPending.length).toBe(2);

    // Sync engine filter for User B
    const userBPending = allPending.filter(r => r.user_id === 'user_B');
    expect(userBPending.length).toBe(1);
    expect(userBPending[0].key).toBe('budget');

    // None of User A's records should be eligible for User B
    expect(userBPending.some(r => r.user_id === 'user_A')).toBe(false);
  });

  it('migrates unauthenticated local records to authenticated user without leaking to subsequent users', async () => {
    // 1. Unauthenticated user works offline
    setCurrentUserId('local');
    setStorageItem('tasks', [{ id: 'offline_1', title: 'Local Task' }]);

    // 2. User C signs in
    setCurrentUserId('user_C');
    await migrateLocalRecordsToUser('user_C');
    await preloadCache('user_C');

    const userCTasks = getStorageItem('tasks');
    expect(userCTasks).toBeDefined();
    expect(userCTasks[0].title).toBe('Local Task');

    const migratedRecord = await localDB.kv_store.get('user_C:tasks');
    expect(migratedRecord).toBeDefined();
    expect(migratedRecord.user_id).toBe('user_C');
    expect(migratedRecord.sync_status).toBe('pending');

    // 3. User C logs out
    clearMemoryCache();
    setCurrentUserId('local');

    // 4. User D signs in fresh
    setCurrentUserId('user_D');
    await preloadCache('user_D');

    // User D must not see User C's migrated tasks
    expect(getStorageItem('tasks')).toBeNull();
  });
});

import Dexie from 'dexie';

// Initialize Local IndexedDB Database
export const localDB = new Dexie('PlanoryLocalDB');

// Version 1 (Baseline Legacy Schema)
localDB.version(1).stores({
  kv_store: 'id, sync_status, updated_at'
});

// Version 2 (Planrova 2.0 Hardened Schema: Multi-user Scoping, Retry Backoff)
localDB.version(2).stores({
  kv_store: 'id, sync_status, updated_at, user_id, retry_count'
}).upgrade(tx => {
  return tx.table('kv_store').toCollection().modify(record => {
    if (!record.user_id) record.user_id = 'local';
    if (typeof record.retry_count !== 'number') record.retry_count = 0;
    if (!record.last_error) record.last_error = null;
  });
});

/**
 * Helper to wrap raw values into the Sync Engine format with user scoping and retry tracking
 */
export function createSyncRecord(id, value, userId = 'local') {
  return {
    id: id,
    user_id: userId,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    updated_at: Date.now(),
    sync_status: 'pending',
    retry_count: 0,
    last_error: null,
    deleted: false
  };
}

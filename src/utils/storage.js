/**
 * storage.js — Planrova Local-First Storage Layer
 *
 * Primary:  Dexie.js (IndexedDB) for instant offline reads/writes
 * Sync:     Background Sync Engine (Firebase)
 * Memory:   In-memory Cache for synchronous UI access
 */

import { localDB, createSyncRecord } from '../db/database.js';
import { syncPendingChanges } from '../db/syncEngine.js';
import { auth } from '../db/firebase.js';

const _cache = new Map();
let _cacheLoaded = false;
let _currentUserId = null;

export function getCurrentUserId() {
  if (auth && auth.currentUser) {
    return auth.currentUser.uid;
  }
  return _currentUserId || 'local';
}

export function setCurrentUserId(userId) {
  _currentUserId = userId || 'local';
}

export function getScopedRecordId(key, userId = null) {
  const uid = userId || getCurrentUserId();
  return `${uid}:${key}`;
}

// ── 1. Clear In-Memory Cache (Used on Logout / Account Switch) ─────────
export function clearMemoryCache() {
  _cache.clear();
  _cacheLoaded = false;
  _currentUserId = null;
}

// ── 2. Migrate unauthenticated local records to authenticated user ────
export async function migrateLocalRecordsToUser(targetUserId) {
  if (!targetUserId || targetUserId === 'local') return;

  try {
    const allRecords = await localDB.kv_store.toArray();
    for (const record of allRecords) {
      const isLocal = record.user_id === 'local' || (!record.user_id && !record.id.includes(':')) || record.id.startsWith('local:');
      if (isLocal && !record.deleted) {
        const itemKey = record.key || (record.id.includes(':') ? record.id.split(':')[1] : record.id);
        const userScopedId = `${targetUserId}:${itemKey}`;
        const existingRecord = await localDB.kv_store.get(userScopedId);

        // Migrate only if user has no existing record for this key
        if (!existingRecord) {
          await localDB.kv_store.put({
            ...record,
            id: userScopedId,
            key: itemKey,
            user_id: targetUserId,
            sync_status: 'pending',
            updated_at: Date.now()
          });
        }
      }
    }
  } catch (err) {
    console.error('[Storage] Error during local-to-user migration:', err);
  }
}

// ── 3. Preload Cache from Dexie on Startup ─────────────────────────────
export async function preloadCache(userId = null) {
  const activeUser = userId || getCurrentUserId();
  _currentUserId = activeUser;
  _cache.clear();

  try {
    const records = await localDB.kv_store.toArray();
    records.forEach(record => {
      // Check if record matches active user:
      // Either exact match user_id === activeUser, or scoped id starts with `${activeUser}:`
      // Or legacy unpartitioned record (no colon in id and user_id is 'local') when activeUser is 'local'
      const isScopedForActive = record.id === `${activeUser}:${record.key || record.id}` || record.user_id === activeUser;
      const isLegacyLocal = !record.id.includes(':') && (!record.user_id || record.user_id === 'local') && activeUser === 'local';

      if ((isScopedForActive || isLegacyLocal) && !record.deleted) {
        const cacheKey = record.key || (record.id.includes(':') ? record.id.split(':')[1] : record.id);
        try {
          _cache.set(cacheKey, JSON.parse(record.value));
        } catch {
          _cache.set(cacheKey, record.value);
        }
      }
    });
    _cacheLoaded = true;
    console.log(`[Storage] Preloaded ${_cache.size} keys from Dexie for user: ${activeUser}`);
  } catch (error) {
    console.error('[Storage] Failed to preload Dexie cache:', error);
    _cacheLoaded = true; // prevent infinite loading loop
  }
}

// ── 4. Listen for Cloud Updates ────────────────────────────────────────
// When Sync Engine pulls newer data from Firebase, update cache
if (typeof window !== 'undefined') {
  window.addEventListener('planrova:cloud_update', async (e) => {
    const { key } = e.detail;
    const activeUser = getCurrentUserId();
    const scopedId = getScopedRecordId(key, activeUser);

    try {
      const record = await localDB.kv_store.get(scopedId);
      if (record && !record.deleted) {
        const parsedValue = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
        _cache.set(key, parsedValue);
        window.dispatchEvent(new CustomEvent('planrova:data_changed', { detail: { key, value: parsedValue } }));
      } else if (record && record.deleted) {
        _cache.delete(key);
        window.dispatchEvent(new CustomEvent('planrova:data_changed', { detail: { key, deleted: true } }));
      }
    } catch (err) {
      console.error('[Storage] Error processing cloud update for', key, err);
    }
  });
}

// ── 5. PUBLIC API (Synchronous UI Access) ──────────────────────────────

/**
 * Read (Instant) — Returns from memory cache.
 */
export function getStorageItem(key, defaultValue = null) {
  if (_cache.has(key)) {
    return _cache.get(key);
  }
  return defaultValue;
}

/**
 * Write (Instant Local, Background Sync)
 */
export function setStorageItem(key, value) {
  // 1. Update UI Cache instantly
  _cache.set(key, value);

  // 2. Wrap payload with Sync metadata and active user scope
  const activeUser = getCurrentUserId();
  const scopedId = getScopedRecordId(key, activeUser);
  const record = createSyncRecord(scopedId, value, activeUser);
  record.key = key;

  // 3. Write to local Dexie database (Async, don't block caller)
  localDB.kv_store.put(record).then(() => {
    // 4. Tell Sync Engine to push pending changes to Firebase
    syncPendingChanges();
  }).catch(err => {
    console.error('[Storage] Failed to save to local Dexie:', err);
  });
}

/**
 * Delete (Soft Delete for Sync)
 */
export function removeStorageItem(key) {
  // 1. Remove from instant cache
  _cache.delete(key);

  // 2. Mark as deleted in local database
  const activeUser = getCurrentUserId();
  const scopedId = getScopedRecordId(key, activeUser);
  const record = createSyncRecord(scopedId, null, activeUser);
  record.key = key;
  record.deleted = true;

  localDB.kv_store.put(record).then(() => {
    syncPendingChanges();
  }).catch(err => {
    console.error('[Storage] Failed to mark as deleted in Dexie:', err);
  });
}

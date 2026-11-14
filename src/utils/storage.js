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

// ── 1. Clear In-Memory Cache (Used on Logout / Account Switch) ─────────
export function clearMemoryCache() {
  _cache.clear();
  _cacheLoaded = false;
  _currentUserId = null;
}

// ── 2. Preload Cache from Dexie on Startup ─────────────────────────────
export async function preloadCache(userId = null) {
  const activeUser = userId || getCurrentUserId();
  _currentUserId = activeUser;
  _cache.clear();

  try {
    // Read all records for active user or legacy 'local' records
    const records = await localDB.kv_store.toArray();
    records.forEach(record => {
      // Allow records matching active user or unpartitioned legacy records
      const matchesUser = !record.user_id || record.user_id === activeUser || record.user_id === 'local';
      if (matchesUser && !record.deleted) {
        try {
          _cache.set(record.id, JSON.parse(record.value));
        } catch {
          _cache.set(record.id, record.value);
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

// ── 3. Listen for Cloud Updates ────────────────────────────────────────
// When Sync Engine pulls newer data from Firebase, update cache
if (typeof window !== 'undefined') {
  window.addEventListener('planrova:cloud_update', async (e) => {
    const { key } = e.detail;
    try {
      const record = await localDB.kv_store.get(key);
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

// ── 4. PUBLIC API (Synchronous UI Access) ──────────────────────────────

/**
 * Read (Instant) — Returns from memory cache.
 */
export function getStorageItem(key, defaultValue) {
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
  const record = createSyncRecord(key, value, activeUser);

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
  const record = createSyncRecord(key, null, activeUser);
  record.deleted = true;

  localDB.kv_store.put(record).then(() => {
    syncPendingChanges();
  }).catch(err => {
    console.error('[Storage] Failed to mark as deleted in Dexie:', err);
  });
}

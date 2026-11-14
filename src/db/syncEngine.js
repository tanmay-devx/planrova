import { localDB } from './database.js';
import { db, auth } from './firebase.js';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

let _unsubscribeSync = null;
let _isSyncing = false;
let _retryTimeout = null;

// Observable Sync State
let _syncStatus = {
  state: 'idle', // 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
  pendingCount: 0,
  lastSyncTime: null,
  lastError: null
};

export function getSyncStatus() {
  return { ..._syncStatus };
}

function updateSyncStatus(newState, details = {}) {
  _syncStatus = {
    ..._syncStatus,
    state: newState,
    ...details,
    timestamp: Date.now()
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('planrova:sync_status', { 
      detail: getSyncStatus() 
    }));
  }
}

/**
 * Push local pending changes to Firebase with exponential backoff and ownership checks
 */
export async function syncPendingChanges() {
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;
  if (!isOnline) {
    updateSyncStatus('offline');
    return;
  }

  if (_isSyncing) return;
  const user = auth ? auth.currentUser : null;
  if (!user) {
    updateSyncStatus('idle', { lastError: 'No authenticated user' });
    return;
  }

  _isSyncing = true;
  updateSyncStatus('syncing');

  try {
    // 1. Query pending records for the current user
    const pendingRecords = await localDB.kv_store
      .where('sync_status')
      .equals('pending')
      .toArray();

    // Strict account isolation: only push records belonging to this authenticated user
    const eligibleRecords = pendingRecords.filter(r => r.user_id === user.uid);

    if (eligibleRecords.length === 0) {
      _isSyncing = false;
      updateSyncStatus('synced', { pendingCount: 0, lastSyncTime: Date.now(), lastError: null });
      return;
    }

    updateSyncStatus('syncing', { pendingCount: eligibleRecords.length });
    console.log(`[SyncEngine] Pushing ${eligibleRecords.length} changes to cloud for user ${user.uid}...`);

    let anyFailed = false;

    // 2. Push to Firestore
    for (const record of eligibleRecords) {
      try {
        const itemKey = record.key || (record.id.includes(':') ? record.id.split(':')[1] : record.id);
        const docRef = doc(db, 'users', user.uid, 'appData', itemKey);
        
        // Prepare clean cloud payload (strip local-only properties)
        const payload = {
          id: itemKey,
          value: record.value,
          updated_at: record.updated_at || Date.now(),
          deleted: Boolean(record.deleted)
        };

        await setDoc(docRef, payload, { merge: true });

        // 3. Update local status to synced and associate record with current user ID
        await localDB.kv_store.update(record.id, { 
          sync_status: 'synced',
          user_id: user.uid,
          retry_count: 0,
          last_error: null
        });
      } catch (err) {
        anyFailed = true;
        const currentRetry = (record.retry_count || 0) + 1;
        console.error(`[SyncEngine] Failed to sync record: ${record.id} (attempt ${currentRetry})`, err);

        await localDB.kv_store.update(record.id, {
          sync_status: 'pending',
          retry_count: currentRetry,
          last_error: err.message || String(err)
        });

        // Schedule exponential backoff with jitter (max 30s)
        const backoffMs = Math.min(30000, 1000 * Math.pow(2, currentRetry)) + Math.random() * 800;
        if (!_retryTimeout) {
          _retryTimeout = setTimeout(() => {
            _retryTimeout = null;
            syncPendingChanges();
          }, backoffMs);
        }
      }
    }

    if (anyFailed) {
      updateSyncStatus('error', { lastError: 'Some items failed to sync' });
    } else {
      updateSyncStatus('synced', { pendingCount: 0, lastSyncTime: Date.now(), lastError: null });
    }
  } catch (error) {
    console.error('[SyncEngine] Sync cycle encountered a critical error:', error);
    updateSyncStatus('error', { lastError: error.message || 'Sync cycle failed' });
  } finally {
    _isSyncing = false;
  }
}

/**
 * Start listening to Cloud changes (Pull)
 */
export function startRealtimeSync() {
  const user = auth ? auth.currentUser : null;
  if (!user) return;

  if (_unsubscribeSync) {
    _unsubscribeSync();
  }

  console.log(`[SyncEngine] Subscribing to Cloud realtime updates for ${user.uid}...`);
  const appDataRef = collection(db, 'users', user.uid, 'appData');

  _unsubscribeSync = onSnapshot(appDataRef, async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const cloudData = change.doc.data();
        const itemKey = cloudData.id || change.doc.id;
        const scopedId = `${user.uid}:${itemKey}`;
        const localRecord = await localDB.kv_store.get(scopedId);
        
        if (localRecord && localRecord.sync_status === 'pending') {
          // Conflict detected between unsynced local edit and cloud update
          console.log(`[SyncEngine] Conflict detected for key: ${itemKey}. Merging with tombstones...`);
          const mergedValue = resolveSyncConflict(itemKey, localRecord, cloudData);

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('planrova:sync_conflict', { 
              detail: { key: itemKey, timestamp: Date.now() } 
            }));
          }
          
          await localDB.kv_store.put({
            id: scopedId,
            key: itemKey,
            user_id: user.uid,
            value: typeof mergedValue === 'string' ? mergedValue : JSON.stringify(mergedValue),
            updated_at: Math.max(localRecord.updated_at || 0, cloudData.updated_at || 0) + 1,
            sync_status: 'pending',
            retry_count: 0,
            last_error: null,
            deleted: Boolean(cloudData.deleted && localRecord.deleted)
          });
          
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('planrova:cloud_update', { 
              detail: { key: itemKey } 
            }));
          }
          
          setTimeout(syncPendingChanges, 1000);
        } else if (!localRecord || (cloudData.updated_at || 0) > (localRecord.updated_at || 0)) {
          console.log(`[SyncEngine] Cloud update received for ${itemKey}`);
          await localDB.kv_store.put({
            id: scopedId,
            key: itemKey,
            user_id: user.uid,
            value: cloudData.value,
            updated_at: cloudData.updated_at || Date.now(),
            sync_status: 'synced',
            retry_count: 0,
            last_error: null,
            deleted: Boolean(cloudData.deleted)
          });
          
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('planrova:cloud_update', { 
              detail: { key: itemKey } 
            }));
          }
        }
      }
    });
  }, (err) => {
    console.error('[SyncEngine] Realtime snapshot listener error:', err);
    updateSyncStatus('error', { lastError: err.message });
  });
}

/**
 * Intelligent Conflict Resolver:
 * - Employs tombstones for deletions within arrays to prevent resurrection
 * - Merges collections by entity id and timestamps
 * - Preserves progress metrics for gamification and coins
 */
export function resolveSyncConflict(key, localRecord, cloudData) {
  let localVal = null;
  let cloudVal = null;

  try {
    localVal = typeof localRecord.value === 'string' ? JSON.parse(localRecord.value) : localRecord.value;
  } catch (e) {
    localVal = localRecord.value;
  }

  try {
    cloudVal = typeof cloudData.value === 'string' ? JSON.parse(cloudData.value) : cloudData.value;
  } catch (e) {
    cloudVal = cloudData.value;
  }

  if (localVal == null) return cloudVal;
  if (cloudVal == null) return localVal;

  const collectionKeys = [
    'tasks', 
    'user_habits', 
    'expenses', 
    'hydration_logs', 
    'notes', 
    'notes_drafts', 
    'brain_dump'
  ];

  if (collectionKeys.includes(key) && Array.isArray(localVal) && Array.isArray(cloudVal)) {
    const uniqueIdKey = (key === 'notes') ? 'date' : 'id';
    const mergedMap = new Map();

    // 1. Populate map with cloud items
    cloudVal.forEach(item => {
      if (item && item[uniqueIdKey]) {
        mergedMap.set(item[uniqueIdKey], item);
      }
    });

    // 2. Merge local items with conflict resolution
    localVal.forEach(item => {
      if (item && item[uniqueIdKey]) {
        const id = item[uniqueIdKey];
        const cloudItem = mergedMap.get(id);

        if (cloudItem) {
          // If either side explicitly marked as deleted with tombstone, keep deleted
          if (cloudItem.deleted || item.deleted) {
            mergedMap.set(id, { ...cloudItem, ...item, deleted: true });
          } else {
            // LWW per item based on updated_at
            const cloudTimestamp = cloudItem.updated_at || 0;
            const localTimestamp = item.updated_at || 0;
            const winner = localTimestamp >= cloudTimestamp ? { ...cloudItem, ...item } : { ...item, ...cloudItem };

            // Completion retention: if either side marked completed, preserve completed
            if (cloudItem.completed || item.completed) {
              winner.completed = true;
            }

            mergedMap.set(id, winner);
          }
        } else {
          // Exists locally only
          mergedMap.set(id, item);
        }
      }
    });

    // Filter out deleted tombstones before returning active collection
    return Array.from(mergedMap.values()).filter(item => !item.deleted);
  }

  // Focus coins numeric merge
  if (key === 'focus_coins') {
    return Math.max(parseInt(localVal, 10) || 0, parseInt(cloudVal, 10) || 0);
  }

  // Object-level merges for settings & metrics
  if (typeof localVal === 'object' && typeof cloudVal === 'object') {
    if (key === 'gamification') {
      const maxLvl = Math.max(localVal.level || 1, cloudVal.level || 1);
      const maxXp = Math.max(localVal.xp || 0, cloudVal.xp || 0);
      return { 
        ...cloudVal, 
        ...localVal, 
        level: maxLvl, 
        xp: maxXp 
      };
    }
    if (key === 'hydration') {
      const maxWater = Math.max(localVal.water || 0, cloudVal.water || 0);
      const maxTarget = Math.max(localVal.target || 2000, cloudVal.target || 2000);
      return { water: maxWater, target: maxTarget };
    }
    if (key === 'unlocked_seeds') {
      const localSeeds = Array.isArray(localVal) ? localVal : ['oak'];
      const cloudSeeds = Array.isArray(cloudVal) ? cloudVal : ['oak'];
      return Array.from(new Set([...localSeeds, ...cloudSeeds]));
    }
    if (key === 'focus_coins') {
      return Math.max(parseInt(localVal, 10) || 0, parseInt(cloudVal, 10) || 0);
    }
    return { ...cloudVal, ...localVal };
  }

  return (cloudData.updated_at || 0) > (localRecord.updated_at || 0) ? cloudVal : localVal;
}

/**
 * Stop Sync (on logout or user switch)
 */
export function stopRealtimeSync() {
  if (_unsubscribeSync) {
    _unsubscribeSync();
    _unsubscribeSync = null;
  }
  if (_retryTimeout) {
    clearTimeout(_retryTimeout);
    _retryTimeout = null;
  }
  _isSyncing = false;
  updateSyncStatus('idle');
}

// Auto-sync when internet reconnects
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncEngine] Internet restored. Triggering sync queue...');
    updateSyncStatus('idle');
    syncPendingChanges();
  });

  window.addEventListener('offline', () => {
    console.log('[SyncEngine] Internet disconnected.');
    updateSyncStatus('offline');
  });
}

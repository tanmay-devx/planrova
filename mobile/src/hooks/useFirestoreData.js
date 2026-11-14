import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

/**
 * Storage key prefix for account-isolated offline cache.
 */
export const getLocalCacheKey = (userId, storageKey) => `planrova_${userId}_${storageKey}`;
export const getPendingSyncKey = (userId) => `planrova_pending_sync_${userId}`;

/**
 * Flushes pending mutations queued while offline for a given user.
 * @param {string} userId
 * @param {object} firestoreDb
 * @returns {Promise<number>} Number of flushed mutations
 */
export async function flushPendingSyncQueue(userId, firestoreDb = db) {
  if (!userId) return 0;
  const queueKey = getPendingSyncKey(userId);
  try {
    const rawQueue = await AsyncStorage.getItem(queueKey);
    if (!rawQueue) return 0;
    const queue = JSON.parse(rawQueue);
    if (!Array.isArray(queue) || queue.length === 0) return 0;

    let flushedCount = 0;
    const remainingQueue = [];

    for (const item of queue) {
      try {
        const docRef = doc(firestoreDb, 'users', userId, 'appData', item.storageKey);
        await setDoc(docRef, {
          id: item.storageKey,
          value: typeof item.value === 'string' ? item.value : JSON.stringify(item.value),
          updated_at: item.timestamp || Date.now(),
          deleted: item.deleted || false
        }, { merge: true });
        flushedCount++;
      } catch (err) {
        // If network is still unavailable, keep remaining in queue
        remainingQueue.push(item);
      }
    }

    if (remainingQueue.length > 0) {
      await AsyncStorage.setItem(queueKey, JSON.stringify(remainingQueue));
    } else {
      await AsyncStorage.removeItem(queueKey);
    }

    return flushedCount;
  } catch (err) {
    console.error(`[Sync] Failed to flush offline queue for user ${userId}:`, err);
    return 0;
  }
}

/**
 * Custom hook to sync a specific storage key with Firestore and local AsyncStorage.
 * Provides offline durability, zero-latency local load, offline mutation queuing,
 * and account-isolated storage.
 *
 * @param {string} storageKey
 * @param {*} defaultValue
 * @returns {[any, (newData: any) => Promise<void>, boolean, 'synced' | 'syncing' | 'offline' | 'error']}
 */
export function useFirestoreData(storageKey, defaultValue = []) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'offline' | 'error'
  const isMountedRef = useRef(true);
  const activeUserRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      activeUserRef.current = user ? user.uid : null;

      if (!user) {
        if (isMountedRef.current) {
          setData(defaultValue);
          setLoading(false);
          setSyncStatus('synced');
        }
        return;
      }

      const userId = user.uid;
      const cacheKey = getLocalCacheKey(userId, storageKey);

      // 1. Immediate offline-first cache read (zero-latency durability)
      try {
        const cachedRaw = await AsyncStorage.getItem(cacheKey);
        if (cachedRaw !== null && activeUserRef.current === userId && isMountedRef.current) {
          try {
            const parsedCache = JSON.parse(cachedRaw);
            setData(parsedCache);
            setLoading(false);
          } catch (e) {
            console.warn(`[Sync] Failed to parse cached ${storageKey}:`, e);
          }
        }
      } catch (e) {
        console.warn(`[Sync] AsyncStorage read error for ${storageKey}:`, e);
      }

      // Flush any pending mutations in the background
      flushPendingSyncQueue(userId).catch(() => {});

      // 2. Setup real-time Firestore listener
      const docRef = doc(db, 'users', userId, 'appData', storageKey);

      unsubscribeSnapshot = onSnapshot(docRef, async (docSnap) => {
        if (!isMountedRef.current || activeUserRef.current !== userId) return;

        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          if (cloudData.value && !cloudData.deleted) {
            try {
              const parsed = typeof cloudData.value === 'string'
                ? JSON.parse(cloudData.value)
                : cloudData.value;
              setData(parsed || defaultValue);

              // Update local cache with cloud snapshot
              await AsyncStorage.setItem(cacheKey, JSON.stringify(parsed || defaultValue)).catch(() => {});
            } catch (e) {
              console.error(`[Sync] Failed to parse ${storageKey}:`, e);
            }
          } else {
            setData(defaultValue);
            await AsyncStorage.setItem(cacheKey, JSON.stringify(defaultValue)).catch(() => {});
          }
        } else {
          // Document does not exist in Firestore yet
          // Keep cached data if available, otherwise defaultValue
        }

        setLoading(false);
        setSyncStatus('synced');
      }, (err) => {
        console.error(`[Sync] Snapshot error for ${storageKey}:`, err);
        if (isMountedRef.current) {
          setLoading(false);
          setSyncStatus('offline');
        }
      });
    });

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, [storageKey]);

  // Write function that persists to local AsyncStorage immediately and syncs to Firestore
  const saveData = useCallback(async (newData) => {
    const user = auth.currentUser;
    if (!user) return;

    const userId = user.uid;
    const cacheKey = getLocalCacheKey(userId, storageKey);

    // 1. Optimistic UI update
    setData(newData);
    setSyncStatus('syncing');

    // 2. Immediate local cache write (guaranteed offline durability)
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(newData));
    } catch (err) {
      console.error(`[Sync] Failed to persist local cache for ${storageKey}:`, err);
    }

    // 3. Sync to Firestore with offline queue fallback
    try {
      const docRef = doc(db, 'users', userId, 'appData', storageKey);
      await setDoc(docRef, {
        id: storageKey,
        value: JSON.stringify(newData),
        updated_at: Date.now(),
        deleted: false
      }, { merge: true });

      if (isMountedRef.current) {
        setSyncStatus('synced');
      }
    } catch (firestoreErr) {
      console.warn(`[Sync] Remote write failed for ${storageKey}, queuing for offline sync:`, firestoreErr.message);

      // Queue write to pending sync list in AsyncStorage
      try {
        const queueKey = getPendingSyncKey(userId);
        const rawQueue = await AsyncStorage.getItem(queueKey);
        const queue = rawQueue ? JSON.parse(rawQueue) : [];

        // Replace any prior un-synced mutation for this exact storageKey or append
        const filtered = queue.filter(item => item.storageKey !== storageKey);
        filtered.push({
          storageKey,
          value: newData,
          timestamp: Date.now(),
          deleted: false
        });

        await AsyncStorage.setItem(queueKey, JSON.stringify(filtered));
      } catch (queueErr) {
        console.error(`[Sync] Failed to queue offline write:`, queueErr);
      }

      if (isMountedRef.current) {
        setSyncStatus('offline');
      }
    }
  }, [storageKey]);

  return [data, saveData, loading, syncStatus];
}

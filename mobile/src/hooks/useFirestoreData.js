import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

/**
 * Custom hook to sync a specific storage key with Firestore.
 * Matches the logic used in the web app's getStorageItem / setStorageItem.
 * Robust across React Native auth state lifecycle transitions.
 */
export function useFirestoreData(storageKey, defaultValue = []) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        setData(defaultValue);
        setLoading(false);
        return;
      }

      setLoading(true);
      const docRef = doc(db, 'users', user.uid, 'appData', storageKey);
      
      unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          if (cloudData.value && !cloudData.deleted) {
            try {
              const parsed = typeof cloudData.value === 'string' 
                ? JSON.parse(cloudData.value) 
                : cloudData.value;
              setData(parsed || defaultValue);
            } catch (e) {
              console.error(`[Sync] Failed to parse ${storageKey}:`, e);
            }
          } else {
            setData(defaultValue);
          }
        } else {
          setData(defaultValue);
        }
        setLoading(false);
      }, (err) => {
        console.error(`[Sync] Snapshot error for ${storageKey}:`, err);
        setLoading(false);
      });
    });

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, [storageKey]);

  // Write function that mimics local storage but writes to Firestore
  const saveData = async (newData) => {
    const user = auth.currentUser;
    if (!user) return;

    // Optimistic UI update
    setData(newData);

    const docRef = doc(db, 'users', user.uid, 'appData', storageKey);
    await setDoc(docRef, {
      id: storageKey,
      value: JSON.stringify(newData),
      updated_at: Date.now(),
      deleted: false
    }, { merge: true });
  };

  return [data, saveData, loading];
}

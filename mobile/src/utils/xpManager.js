import { doc, getDoc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebase';
import { calculateXPProgress } from './gamification';
import * as Haptics from 'expo-haptics';

/**
 * Centrally awards XP, logs the activity, and updates Firestore state.
 * Returns the new gamification state { level, xp, leveledUp }.
 */
export const awardXP = async (userId, currentGamification, amount, reason) => {
  const progress = calculateXPProgress(currentGamification.level || 1, currentGamification.xp || 0, amount);

  if (progress.leveledUp) {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn('[XP Manager] Haptics not supported:', e);
    }
  }

  if (userId === 'guest') return progress;

  try {
    // 1. Save new gamification state
    const gamificationRef = doc(db, 'users', userId, 'appData', 'gamification');
    await setDoc(gamificationRef, {
      id: 'gamification',
      value: JSON.stringify({ level: progress.level, xp: progress.xp }),
      updated_at: Date.now(),
      deleted: false
    }, { merge: true });

    // 2. Load and update XP history logs
    const historyRef = doc(db, 'users', userId, 'appData', 'xp_history');
    const historySnap = await getDoc(historyRef);
    let logs = [];
    if (historySnap.exists()) {
      const cloudData = historySnap.data();
      if (cloudData.value) {
        try {
          logs = typeof cloudData.value === 'string' ? JSON.parse(cloudData.value) : cloudData.value;
        } catch (e) {
          console.error('[XP Manager] Failed to parse history logs:', e);
        }
      }
    }

    const newLog = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      amount,
      reason,
      level: progress.level
    };

    logs = [newLog, ...logs].slice(0, 100); // limit to last 100 entries

    await setDoc(historyRef, {
      id: 'xp_history',
      value: JSON.stringify(logs),
      updated_at: Date.now(),
      deleted: false
    }, { merge: true });

  } catch (err) {
    if (err?.code === 'permission-denied') {
      console.warn('[XP Manager] Firestore write permission denied; XP held in local state.');
    } else {
      console.error('[XP Manager] Error awarding XP:', err);
    }
  }

  // Always persist gamification state to local AsyncStorage for offline and permission safety
  try {
    const localGamificationKey = `planrova_${userId}_gamification`;
    await AsyncStorage.setItem(localGamificationKey, JSON.stringify({ level: progress.level, xp: progress.xp }));
  } catch {
    // Non-fatal local storage error
  }

  return progress;
};

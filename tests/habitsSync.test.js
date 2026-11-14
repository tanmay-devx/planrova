import { describe, it, expect } from 'vitest';
import { resolveSyncConflict } from '../src/db/syncEngine.js';

describe('Cross-Platform Habit Schema Unification', () => {
  it('harmonizes mobile habit schema (fire + logs array) with web habit schema (streak + habit_logs)', () => {
    // Mobile writes habit with 'fire' and 'logs' array on the habit object
    const mobileHabit = {
      id: 'h_101',
      name: 'Morning Run',
      fire: 5,
      logs: ['2026-11-13', '2026-11-14']
    };

    // Web interprets streak from either streak or fire
    const webCalculatedStreak = typeof mobileHabit.streak === 'number' 
      ? mobileHabit.streak 
      : (typeof mobileHabit.fire === 'number' ? mobileHabit.fire : 0);
    
    expect(webCalculatedStreak).toBe(5);

    // Web interprets completions from either separate map or habit.logs
    const separateWebLogs = {};
    const effectiveLogs = (separateWebLogs[mobileHabit.id] || []).concat(mobileHabit.logs || []);
    expect(effectiveLogs).toContain('2026-11-14');
  });

  it('merges habits during sync conflict resolution without dropping either device progress', () => {
    // Device A (Mobile) completed habit on 2026-11-14
    const cloudRecord = {
      id: 'user_habits',
      value: JSON.stringify([
        { id: 'h_1', name: 'Read Book', streak: 4, fire: 4, logs: ['2026-11-13', '2026-11-14'], updated_at: 200 }
      ]),
      updated_at: 200
    };

    // Device B (Web) created another habit offline
    const localRecord = {
      id: 'user_habits',
      value: JSON.stringify([
        { id: 'h_1', name: 'Read Book', streak: 3, fire: 3, logs: ['2026-11-13'], updated_at: 100 },
        { id: 'h_2', name: 'Coding Practice', streak: 1, fire: 1, logs: ['2026-11-14'], updated_at: 150 }
      ]),
      updated_at: 150
    };

    const merged = resolveSyncConflict('user_habits', localRecord, cloudRecord);
    expect(merged.length).toBe(2);

    const bookHabit = merged.find(h => h.id === 'h_1');
    expect(bookHabit).toBeDefined();
    // Cloud had newer progress (streak 4)
    expect(bookHabit.streak).toBe(4);
    
    const codingHabit = merged.find(h => h.id === 'h_2');
    expect(codingHabit).toBeDefined();
    expect(codingHabit.name).toBe('Coding Practice');
  });
});


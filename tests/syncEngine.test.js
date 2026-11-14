import { describe, it, expect } from 'vitest';
import { resolveSyncConflict } from '../src/db/syncEngine.js';

describe('Sync Engine Conflict Resolution & Data Integrity', () => {
  describe('Collection Merging with Tombstones', () => {
    it('prevents deleted items from resurrecting when merged with older cloud data', () => {
      const localTasks = [
        { id: 'task_1', title: 'Active Task', completed: false, updated_at: 200 },
        { id: 'task_2', title: 'Deleted Task', completed: false, deleted: true, updated_at: 250 }
      ];

      const cloudData = {
        id: 'tasks',
        value: JSON.stringify([
          { id: 'task_1', title: 'Active Task', completed: false, updated_at: 100 },
          { id: 'task_2', title: 'Deleted Task', completed: false, updated_at: 100 }
        ]),
        updated_at: 150
      };

      const localRecord = {
        id: 'tasks',
        value: JSON.stringify(localTasks),
        updated_at: 250
      };

      const merged = resolveSyncConflict('tasks', localRecord, cloudData);

      expect(Array.isArray(merged)).toBe(true);
      expect(merged.length).toBe(1);
      expect(merged[0].id).toBe('task_1');
      // task_2 was marked with deleted tombstone and MUST NOT be in active list
      expect(merged.find(t => t.id === 'task_2')).toBeUndefined();
    });

    it('preserves completed status if either local or cloud marked task as done', () => {
      const localRecord = {
        id: 'tasks',
        value: JSON.stringify([
          { id: 't1', title: 'Math Homework', completed: true, updated_at: 300 }
        ]),
        updated_at: 300
      };

      const cloudData = {
        id: 'tasks',
        value: JSON.stringify([
          { id: 't1', title: 'Math Homework (Updated)', completed: false, updated_at: 350 }
        ]),
        updated_at: 350
      };

      const merged = resolveSyncConflict('tasks', localRecord, cloudData);
      expect(merged.length).toBe(1);
      expect(merged[0].completed).toBe(true);
      expect(merged[0].title).toBe('Math Homework (Updated)');
    });

    it('merges brain dump items cleanly without overwriting', () => {
      const localDumps = [
        { id: 'd1', text: 'Local idea 1', date: '2026-11-14', updated_at: 100 }
      ];
      const cloudDumps = [
        { id: 'd2', text: 'Cloud idea 2', date: '2026-11-14', updated_at: 200 }
      ];

      const localRecord = { id: 'brain_dump', value: JSON.stringify(localDumps), updated_at: 100 };
      const cloudData = { id: 'brain_dump', value: JSON.stringify(cloudDumps), updated_at: 200 };

      const merged = resolveSyncConflict('brain_dump', localRecord, cloudData);
      expect(merged.length).toBe(2);
      expect(merged.some(d => d.id === 'd1')).toBe(true);
      expect(merged.some(d => d.id === 'd2')).toBe(true);
    });
  });

  describe('Gamification & Progression Merging', () => {
    it('always preserves highest achieved level and xp across devices', () => {
      const localRecord = {
        id: 'gamification',
        value: JSON.stringify({ level: 4, xp: 350 }),
        updated_at: 100
      };
      const cloudData = {
        id: 'gamification',
        value: JSON.stringify({ level: 5, xp: 200 }),
        updated_at: 90
      };

      const merged = resolveSyncConflict('gamification', localRecord, cloudData);
      expect(merged.level).toBe(5);
      expect(merged.xp).toBe(350);
    });

    it('merges unlocked virtual seeds via set union', () => {
      const localRecord = {
        id: 'unlocked_seeds',
        value: JSON.stringify(['oak', 'sakura']),
        updated_at: 100
      };
      const cloudData = {
        id: 'unlocked_seeds',
        value: JSON.stringify(['oak', 'pine', 'maple']),
        updated_at: 100
      };

      const merged = resolveSyncConflict('unlocked_seeds', localRecord, cloudData);
      expect(merged).toContain('oak');
      expect(merged).toContain('sakura');
      expect(merged).toContain('pine');
      expect(merged).toContain('maple');
      expect(merged.length).toBe(4);
    });

    it('retains maximum focus coins balance', () => {
      const localRecord = { id: 'focus_coins', value: 120, updated_at: 100 };
      const cloudData = { id: 'focus_coins', value: 80, updated_at: 120 };

      const merged = resolveSyncConflict('focus_coins', localRecord, cloudData);
      expect(merged).toBe(120);
    });
  });
});


import { describe, it, expect } from 'vitest';
import { localDB, createSyncRecord } from '../src/db/database.js';

describe('Database Schema & Sync Record Generation', () => {
  it('instantiates Dexie with schema version 2', () => {
    expect(localDB.verno).toBe(2);
    expect(localDB.name).toBe('PlanoryLocalDB');
    expect(localDB.tables.some(t => t.name === 'kv_store')).toBe(true);
  });

  it('creates sync records with user scoping, retry counter and metadata', () => {
    const record = createSyncRecord('tasks', [{ id: 't1', title: 'Test Task' }], 'usr_123');

    expect(record.id).toBe('tasks');
    expect(record.user_id).toBe('usr_123');
    expect(record.sync_status).toBe('pending');
    expect(record.retry_count).toBe(0);
    expect(record.last_error).toBeNull();
    expect(record.deleted).toBe(false);
    expect(typeof record.updated_at).toBe('number');
    expect(typeof record.value).toBe('string');
  });

  it('defaults to local user scope when no user is provided', () => {
    const record = createSyncRecord('gamification', { level: 1, xp: 0 });
    expect(record.user_id).toBe('local');
  });
});


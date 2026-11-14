import { describe, it, expect } from 'vitest';
import { logger } from '../src/utils/logger.js';

describe('Centralized Logger & Observability', () => {
  it('records structured log entries', () => {
    logger.clearLogs();
    logger.info('TestModule', 'Operation succeeded', { itemId: '123' });

    const logs = logger.getRecentLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].module).toBe('TestModule');
    expect(logs[0].message).toBe('Operation succeeded');
    expect(logs[0].meta.itemId).toBe('123');
  });

  it('redacts sensitive API keys and tokens from log messages', () => {
    logger.clearLogs();
    const sensitiveMsg = 'Calling Groq with key gsk_SECRET123456789 and Bearer eyJhbGciOiJIUzI1NiJ9';
    logger.error('AuthService', sensitiveMsg);

    const logs = logger.getRecentLogs();
    expect(logs[0].message).not.toContain('gsk_SECRET123456789');
    expect(logs[0].message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(logs[0].message).toContain('[REDACTED_CREDENTIAL]');
  });
});


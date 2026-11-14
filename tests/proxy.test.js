import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../server/proxy.js';

describe('Server OCR Proxy Rate Limiter & Security', () => {
  it('allows requests within the configured rate limit', () => {
    const testIP = '192.168.1.101';
    const firstCheck = checkRateLimit(testIP);
    expect(firstCheck.allowed).toBe(true);
    expect(firstCheck.remaining).toBe(19);

    const secondCheck = checkRateLimit(testIP);
    expect(secondCheck.allowed).toBe(true);
    expect(secondCheck.remaining).toBe(18);
  });

  it('blocks client when request threshold is exceeded', () => {
    const spammerIP = '10.0.0.99';
    // Consume 20 requests
    for (let i = 0; i < 20; i++) {
      const res = checkRateLimit(spammerIP);
      expect(res.allowed).toBe(true);
    }

    // 21st request must be denied
    const blocked = checkRateLimit(spammerIP);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('maintains isolated rate limits across different IP addresses', () => {
    const ipA = '172.16.0.1';
    const ipB = '172.16.0.2';

    for (let i = 0; i < 15; i++) {
      checkRateLimit(ipA);
    }

    const checkA = checkRateLimit(ipA);
    const checkB = checkRateLimit(ipB);

    expect(checkA.remaining).toBe(4);
    expect(checkB.remaining).toBe(19);
  });
});


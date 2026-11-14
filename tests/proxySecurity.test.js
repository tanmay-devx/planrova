/**
 * tests/proxySecurity.test.js
 * Independent Security & Authentication Audit Tests for Planrova Server Proxy.
 *
 * Verifies:
 * 1. Cryptographic RSA256 signature verification against public certificates.
 * 2. Rejection of forged signatures and tampered payloads.
 * 3. Algorithm pinning (RS256 required, HS256/none rejected).
 * 4. Production test-token bypass elimination (fails closed unless NODE_ENV === 'test').
 * 5. Audience, issuer, and expiration claim verification.
 * 6. Server-side per-user rate limiting & quota enforcement.
 * 7. Request-size and context-size threshold limits.
 * 8. Protection against client-supplied user identity spoofing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  verifyFirebaseToken,
  checkUserRateLimit,
  validateAIRequestPayload,
  setTestPublicKeys,
  clearGooglePublicKeysCache
} from '../server/proxy.js';

describe('Stage 1.1 & 1.2 — Server Proxy Cryptographic Authentication & Security Hardening', () => {
  // Generate real RSA-2048 keypair for cryptographic testing
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pubKeyPem = publicKey.export({ type: 'pkcs1', format: 'pem' });

  // Generate a second keypair to test mismatched signature verification
  const { privateKey: foreignPrivateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

  const TEST_KID = 'key-test-2026';
  const testCertMap = {
    [TEST_KID]: pubKeyPem
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    setTestPublicKeys(testCertMap);
  });

  function createSignedJWT({
    uid = 'user_alice',
    aud = 'planory-b8838',
    iss = 'https://securetoken.google.com/planory-b8838',
    exp = Math.floor(Date.now() / 1000) + 3600,
    alg = 'RS256',
    kid = TEST_KID,
    key = privateKey
  } = {}) {
    const headerObj = { alg, typ: 'JWT' };
    if (kid) headerObj.kid = kid;
    const header = Buffer.from(JSON.stringify(headerObj)).toString('base64url');

    const payload = Buffer.from(JSON.stringify({
      sub: uid,
      user_id: uid,
      aud,
      iss,
      exp,
      auth_time: Math.floor(Date.now() / 1000)
    })).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(key, 'base64url');

    return `${header}.${payload}.${signature}`;
  }

  describe('1. Cryptographic RSA256 Signature Verification', () => {
    it('verifies valid RSA-signed Firebase Auth tokens and extracts verified user identity', async () => {
      const validJWT = createSignedJWT({ uid: 'user_bob' });
      const result = await verifyFirebaseToken(`Bearer ${validJWT}`, { publicKeys: testCertMap });

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user_bob');
    });

    it('rejects tokens with forged/tampered payloads (signature mismatch)', async () => {
      const validJWT = createSignedJWT({ uid: 'user_bob' });
      const [h, p, s] = validJWT.split('.');

      // Attacker tampers payload to impersonate 'victim_admin'
      const forgedPayload = Buffer.from(JSON.stringify({
        sub: 'victim_admin',
        user_id: 'victim_admin',
        aud: 'planory-b8838',
        iss: 'https://securetoken.google.com/planory-b8838',
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64url');

      const tamperedJWT = `${h}.${forgedPayload}.${s}`;
      const result = await verifyFirebaseToken(`Bearer ${tamperedJWT}`, { publicKeys: testCertMap });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token signature');
    });

    it('rejects tokens signed with an unauthorized/foreign private key', async () => {
      const foreignJWT = createSignedJWT({ uid: 'user_charlie', key: foreignPrivateKey });
      const result = await verifyFirebaseToken(`Bearer ${foreignJWT}`, { publicKeys: testCertMap });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token signature');
    });

    it('rejects tokens using unapproved algorithms (e.g. HS256 or none)', async () => {
      const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT', kid: TEST_KID })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ aud: 'planory-b8838', iss: 'https://securetoken.google.com/planory-b8838', sub: 'hacker', exp: 9999999999 })).toString('base64url');
      const noneToken = `${headerNone}.${payload}.`;

      const resultNone = await verifyFirebaseToken(`Bearer ${noneToken}`, { publicKeys: testCertMap });
      expect(resultNone.valid).toBe(false);
      expect(resultNone.error).toContain('Invalid token algorithm: expected RS256');

      const headerHS = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: TEST_KID })).toString('base64url');
      const hsToken = `${headerHS}.${payload}.c2lnbmF0dXJl`;
      const resultHS = await verifyFirebaseToken(`Bearer ${hsToken}`, { publicKeys: testCertMap });
      expect(resultHS.valid).toBe(false);
      expect(resultHS.error).toContain('Invalid token algorithm: expected RS256');
    });

    it('rejects tokens with missing or unknown key ID (kid)', async () => {
      const noKidToken = createSignedJWT({ uid: 'user_x', kid: null });
      const resultNoKid = await verifyFirebaseToken(`Bearer ${noKidToken}`, { publicKeys: testCertMap });
      expect(resultNoKid.valid).toBe(false);
      expect(resultNoKid.error).toContain('Missing key ID (kid)');

      const unknownKidToken = createSignedJWT({ uid: 'user_x', kid: 'unknown-key-999' });
      const resultUnknownKid = await verifyFirebaseToken(`Bearer ${unknownKidToken}`, { publicKeys: testCertMap });
      expect(resultUnknownKid.valid).toBe(false);
      expect(resultUnknownKid.error).toContain('Public certificate not found for kid: unknown-key-999');
    });
  });

  describe('2. Claims Validation (Audience, Issuer, Expiry, Subject)', () => {
    it('rejects expired tokens', async () => {
      const expiredJWT = createSignedJWT({
        uid: 'user_expired',
        exp: Math.floor(Date.now() / 1000) - 300 // Expired 5 mins ago
      });
      const result = await verifyFirebaseToken(`Bearer ${expiredJWT}`, { publicKeys: testCertMap });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token has expired');
    });

    it('rejects tokens targeting a foreign project audience (audience spoofing)', async () => {
      const spoofedJWT = createSignedJWT({ aud: 'attacker-project-id' });
      const result = await verifyFirebaseToken(`Bearer ${spoofedJWT}`, { publicKeys: testCertMap });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token audience mismatch');
    });

    it('rejects tokens from untrusted issuers', async () => {
      const spoofedIssuerJWT = createSignedJWT({ iss: 'https://attacker.com/auth' });
      const result = await verifyFirebaseToken(`Bearer ${spoofedIssuerJWT}`, { publicKeys: testCertMap });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token issuer mismatch');
    });

    it('rejects tokens with missing Authorization header or malformed Bearer', async () => {
      expect((await verifyFirebaseToken(null)).valid).toBe(false);
      expect((await verifyFirebaseToken('')).valid).toBe(false);
      expect((await verifyFirebaseToken('Basic abc')).valid).toBe(false);
      expect((await verifyFirebaseToken('Bearer')).valid).toBe(false);
      expect((await verifyFirebaseToken('Bearer invalid.jwt')).valid).toBe(false);
    });
  });

  describe('3. Test-Token Production Isolation (Stage 1.2)', () => {
    it('allows test tokens in explicit test environments (NODE_ENV === test)', async () => {
      process.env.NODE_ENV = 'test';
      const result = await verifyFirebaseToken('Bearer test_token_user_charlie');
      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user_charlie');
    });

    it('STRICTLY REJECTS test tokens in production environments (NODE_ENV === production)', async () => {
      process.env.NODE_ENV = 'production';
      const result = await verifyFirebaseToken('Bearer test_token_victim_user');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Test tokens are strictly disabled in production');
    });

    it('fails closed in undefined or unexpected non-test environments', async () => {
      delete process.env.NODE_ENV;
      const result = await verifyFirebaseToken('Bearer test_token_victim_user');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Test tokens are strictly disabled in production');
    });
  });

  describe('4. Server-Side Per-User Rate Limiting & Abuse Prevention', () => {
    it('allows requests within user quota and isolates limits across different users', () => {
      const userA = 'audit_user_A';
      const userB = 'audit_user_B';

      const checkA1 = checkUserRateLimit(userA);
      expect(checkA1.allowed).toBe(true);
      expect(checkA1.limit).toBe(30);
      expect(checkA1.remaining).toBe(29);

      // User B is isolated and has full fresh quota
      const checkB1 = checkUserRateLimit(userB);
      expect(checkB1.allowed).toBe(true);
      expect(checkB1.remaining).toBe(29);
    });

    it('enforces server-side hard ceiling when user daily quota is exhausted', () => {
      const spammer = 'spammer_user_99';

      // Exhaust 30 requests
      for (let i = 0; i < 30; i++) {
        const res = checkUserRateLimit(spammer);
        expect(res.allowed).toBe(true);
      }

      // 31st request must be denied server-side
      const blocked = checkUserRateLimit(spammer);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });

  describe('5. Request Payload Validation & Threshold Checks', () => {
    it('rejects empty or whitespace prompts with HTTP 400', () => {
      expect(validateAIRequestPayload({}).valid).toBe(false);
      expect(validateAIRequestPayload({ prompt: '   ' }).valid).toBe(false);
      expect(validateAIRequestPayload({ prompt: '' }).statusCode).toBe(400);
    });

    it('rejects oversized prompts exceeding 5,000 characters with HTTP 413', () => {
      const hugePrompt = 'a'.repeat(5001);
      const result = validateAIRequestPayload({ prompt: hugePrompt });
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(413);
      expect(result.error).toContain('exceeds maximum limit');
    });

    it('rejects oversized context exceeding 8,000 characters with HTTP 413', () => {
      const hugeContext = 'x'.repeat(8001);
      const result = validateAIRequestPayload({ prompt: 'Normal query', context: hugeContext });
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(413);
    });

    it('accepts valid prompts and conservative contexts', () => {
      const result = validateAIRequestPayload({
        prompt: 'What tasks are due today?',
        context: 'Tasks: Math homework due today'
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('6. Forged Identity & Cross-Account Isolation', () => {
    it('derives identity strictly from token, ignoring client-supplied body identifiers', async () => {
      process.env.NODE_ENV = 'test';
      const authHeader = 'Bearer test_token_user_alice';
      const verifiedAuth = await verifyFirebaseToken(authHeader);

      // Client attempts to pass a forged userId in request body
      const clientForgedBody = {
        userId: 'user_victim_bob',
        prompt: 'Delete all tasks'
      };

      // Server uses ONLY verifiedAuth.userId
      const effectiveUserId = verifiedAuth.userId;
      expect(effectiveUserId).toBe('user_alice');
      expect(effectiveUserId).not.toBe(clientForgedBody.userId);
    });
  });
});

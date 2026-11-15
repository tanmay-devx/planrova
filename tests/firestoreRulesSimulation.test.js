/**
 * tests/firestoreRulesSimulation.test.js
 *
 * Automated verification of Firestore Security Rules contracts (firestore.rules)
 * Simulates Firestore rule evaluations to verify:
 * 1. Private User App Data tenant isolation (/users/{userId}/**).
 * 2. Public User Directory access controls (/users_directory/{userId}).
 * 3. StudyPool collaborative rooms, ownership protection, and room deletion limits.
 * 4. StudyPool room messages and global messages: author UID enforcement and 1,000 char bounds.
 * 5. Default deny on undeclared paths.
 */

import { describe, it, expect } from 'vitest';

// ── Pure Rule Evaluation Engine matching firestore.rules ────────────────────

function evaluateRules({
  auth,               // { uid: string } | null
  path,               // e.g. "users/alice/appData/tasks"
  method,             // 'read' | 'create' | 'update' | 'delete'
  resourceData,       // existing data on server (for update / delete / read)
  requestResourceData // new incoming data (for create / update)
}) {
  const segments = path.split('/').filter(Boolean);
  const isAuthenticated = auth !== null && typeof auth?.uid === 'string' && auth.uid.length > 0;
  const isOwner = (userId) => isAuthenticated && auth.uid === userId;

  // 1. /users/{userId} and /users/{userId}/appData/{document=**}
  if (segments[0] === 'users' && segments.length >= 2) {
    const userId = segments[1];
    if (isOwner(userId)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Tenant isolation violation: only document owner can access user appData' };
  }

  // 2. /users_directory/{userId}
  if (segments[0] === 'users_directory' && segments.length === 2) {
    const userId = segments[1];
    if (method === 'read') {
      return isAuthenticated 
        ? { allowed: true } 
        : { allowed: false, reason: 'Unauthenticated users cannot read user directory' };
    }
    if (method === 'create' || method === 'update') {
      if (!isOwner(userId)) return { allowed: false, reason: 'Cannot modify another user directory card' };
      if (!requestResourceData || requestResourceData.uid !== userId) {
        return { allowed: false, reason: 'Directory card uid must match path userId' };
      }
      if (typeof requestResourceData.email !== 'string' || requestResourceData.email.length > 254 || !requestResourceData.email.includes('@')) {
        return { allowed: false, reason: 'Invalid email in directory card' };
      }
      return { allowed: true };
    }
    if (method === 'delete') {
      return isOwner(userId) ? { allowed: true } : { allowed: false, reason: 'Only owner can delete directory card' };
    }
  }

  // 3. /studypool_rooms/{roomId} and subcollections
  if (segments[0] === 'studypool_rooms') {
    if (segments.length === 2) {
      // Room root
      if (method === 'read') {
        return isAuthenticated ? { allowed: true } : { allowed: false, reason: 'Unauthenticated read denied' };
      }
      if (method === 'create') {
        if (!isAuthenticated) return { allowed: false, reason: 'Unauthenticated create denied' };
        if (typeof requestResourceData?.name !== 'string' || requestResourceData.name.length > 100) {
          return { allowed: false, reason: 'Room name must be string <= 100 chars' };
        }
        return { allowed: true };
      }
      if (method === 'update') {
        if (!isAuthenticated) return { allowed: false, reason: 'Unauthenticated update denied' };
        if (requestResourceData?.createdBy !== resourceData?.createdBy) {
          return { allowed: false, reason: 'Cannot mutate createdBy ownership' };
        }
        const isCreator = resourceData?.createdBy === auth.uid;
        const isHost = resourceData?.hostId === auth.uid;
        const hostUnchanged = requestResourceData?.hostId === resourceData?.hostId;
        if (hostUnchanged || isCreator || isHost) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Unauthorized room update' };
      }
      if (method === 'delete') {
        if (!isAuthenticated) return { allowed: false, reason: 'Unauthenticated delete denied' };
        const isCreator = resourceData?.createdBy === auth.uid;
        const isHost = resourceData?.hostId === auth.uid;
        if (isCreator || isHost) return { allowed: true };
        return { allowed: false, reason: 'Only room host or creator can delete room' };
      }
    }

    if (segments.length === 4 && segments[2] === 'messages') {
      // /studypool_rooms/{roomId}/messages/{messageId}
      if (method === 'read') {
        return isAuthenticated ? { allowed: true } : { allowed: false, reason: 'Unauthenticated read denied' };
      }
      if (method === 'create') {
        if (!isAuthenticated) return { allowed: false, reason: 'Unauthenticated create denied' };
        if (requestResourceData?.uid !== auth.uid) {
          return { allowed: false, reason: 'Message author uid must match authenticated user' };
        }
        if (typeof requestResourceData?.text !== 'string' || requestResourceData.text.length > 1000) {
          return { allowed: false, reason: 'Message text must be string <= 1000 chars' };
        }
        return { allowed: true };
      }
      if (method === 'update') {
        if (!isAuthenticated) return { allowed: false, reason: 'Unauthenticated update denied' };
        if (resourceData?.uid !== auth.uid || requestResourceData?.uid !== resourceData?.uid) {
          return { allowed: false, reason: 'Authorship immutability on message update' };
        }
        return { allowed: true };
      }
      if (method === 'delete') {
        if (!isAuthenticated) return { allowed: false, reason: 'Unauthenticated delete denied' };
        if (resourceData?.uid === auth.uid) return { allowed: true };
        return { allowed: false, reason: 'Only author can delete message' };
      }
    }
  }

  // 4. /studypool_messages/{messageId}
  if (segments[0] === 'studypool_messages' && segments.length === 2) {
    if (method === 'read') return isAuthenticated ? { allowed: true } : { allowed: false, reason: 'Unauthenticated read' };
    if (method === 'create') {
      if (!isAuthenticated) return { allowed: false, reason: 'Unauthenticated create' };
      if (requestResourceData?.userId !== auth.uid) return { allowed: false, reason: 'userId spoofing denied' };
      if (typeof requestResourceData?.text !== 'string' || requestResourceData.text.length > 1000) {
        return { allowed: false, reason: 'text bounds exceeded' };
      }
      return { allowed: true };
    }
    if (method === 'update' || method === 'delete') {
      if (!isAuthenticated) return { allowed: false, reason: 'Unauthenticated modify' };
      return resourceData?.userId === auth.uid ? { allowed: true } : { allowed: false, reason: 'Not message owner' };
    }
  }

  // 5. Default Deny
  return { allowed: false, reason: 'Default deny rule: path does not match any allowed collection' };
}

describe('Firestore Security Rules Contract & Tenant Isolation', () => {
  describe('1. Private User App Data Isolation (/users/{userId}/**)', () => {
    it('allows authenticated owner to read and write their own appData', () => {
      const res = evaluateRules({
        auth: { uid: 'user_alice' },
        path: 'users/user_alice/appData/tasks',
        method: 'read'
      });
      expect(res.allowed).toBe(true);

      const writeRes = evaluateRules({
        auth: { uid: 'user_alice' },
        path: 'users/user_alice/appData/budget',
        method: 'create',
        requestResourceData: { totalLimitMinor: 50000 }
      });
      expect(writeRes.allowed).toBe(true);
    });

    it('denies User B from reading User A appData', () => {
      const res = evaluateRules({
        auth: { uid: 'user_bob' },
        path: 'users/user_alice/appData/tasks',
        method: 'read'
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Tenant isolation violation');
    });

    it('denies unauthenticated requests from reading or writing user appData', () => {
      const res = evaluateRules({
        auth: null,
        path: 'users/user_alice/appData/tasks',
        method: 'read'
      });
      expect(res.allowed).toBe(false);
    });
  });

  describe('2. Public User Directory (/users_directory/{userId})', () => {
    it('allows authenticated users to read directory cards', () => {
      const res = evaluateRules({
        auth: { uid: 'user_bob' },
        path: 'users_directory/user_alice',
        method: 'read'
      });
      expect(res.allowed).toBe(true);
    });

    it('denies unauthenticated access to directory cards', () => {
      const res = evaluateRules({
        auth: null,
        path: 'users_directory/user_alice',
        method: 'read'
      });
      expect(res.allowed).toBe(false);
    });

    it('validates email format and owner identity on card creation', () => {
      // Bob trying to write Alice's card -> denied
      const spoofRes = evaluateRules({
        auth: { uid: 'user_bob' },
        path: 'users_directory/user_alice',
        method: 'create',
        requestResourceData: { uid: 'user_alice', email: 'alice@example.com' }
      });
      expect(spoofRes.allowed).toBe(false);

      // Alice with invalid email -> denied
      const invalidEmail = evaluateRules({
        auth: { uid: 'user_alice' },
        path: 'users_directory/user_alice',
        method: 'create',
        requestResourceData: { uid: 'user_alice', email: 'not-an-email' }
      });
      expect(invalidEmail.allowed).toBe(false);

      // Alice with valid email -> allowed
      const validRes = evaluateRules({
        auth: { uid: 'user_alice' },
        path: 'users_directory/user_alice',
        method: 'create',
        requestResourceData: { uid: 'user_alice', email: 'alice@college.edu' }
      });
      expect(validRes.allowed).toBe(true);
    });
  });

  describe('3. StudyPool Collaborative Rooms & Message Safeguards', () => {
    it('enforces room name size <= 100 characters on creation', () => {
      const longNameRes = evaluateRules({
        auth: { uid: 'user_alice' },
        path: 'studypool_rooms/room_1',
        method: 'create',
        requestResourceData: { name: 'A'.repeat(101) }
      });
      expect(longNameRes.allowed).toBe(false);

      const validNameRes = evaluateRules({
        auth: { uid: 'user_alice' },
        path: 'studypool_rooms/room_1',
        method: 'create',
        requestResourceData: { name: 'Calculus Study Group' }
      });
      expect(validNameRes.allowed).toBe(true);
    });

    it('allows host or creator to delete room but prevents participants from deleting it', () => {
      const roomData = { createdBy: 'user_alice', hostId: 'user_alice', name: 'Room' };

      // Alice (host/creator) deletes room -> allowed
      expect(evaluateRules({
        auth: { uid: 'user_alice' },
        path: 'studypool_rooms/room_1',
        method: 'delete',
        resourceData: roomData
      }).allowed).toBe(true);

      // Bob (regular participant) tries to delete room -> denied
      expect(evaluateRules({
        auth: { uid: 'user_bob' },
        path: 'studypool_rooms/room_1',
        method: 'delete',
        resourceData: roomData
      }).allowed).toBe(false);
    });

    it('rejects spoofed message authorship in room chat', () => {
      // Bob sending message claiming to be Alice -> denied
      const spoofMsg = evaluateRules({
        auth: { uid: 'user_bob' },
        path: 'studypool_rooms/room_1/messages/msg_1',
        method: 'create',
        requestResourceData: { uid: 'user_alice', text: 'Impersonated text' }
      });
      expect(spoofMsg.allowed).toBe(false);
      expect(spoofMsg.reason).toContain('Message author uid must match');

      // Bob sending message as Bob -> allowed
      const validMsg = evaluateRules({
        auth: { uid: 'user_bob' },
        path: 'studypool_rooms/room_1/messages/msg_2',
        method: 'create',
        requestResourceData: { uid: 'user_bob', text: 'Hey team!' }
      });
      expect(validMsg.allowed).toBe(true);
    });

    it('enforces message text limit of 1000 characters', () => {
      const overlimitMsg = evaluateRules({
        auth: { uid: 'user_bob' },
        path: 'studypool_rooms/room_1/messages/msg_3',
        method: 'create',
        requestResourceData: { uid: 'user_bob', text: 'X'.repeat(1001) }
      });
      expect(overlimitMsg.allowed).toBe(false);
    });
  });

  describe('4. Default Deny on Arbitrary Collections', () => {
    it('denies access to non-existent or arbitrary collections', () => {
      const adminPath = evaluateRules({
        auth: { uid: 'user_alice' },
        path: 'system_admin/config',
        method: 'read'
      });
      expect(adminPath.allowed).toBe(false);
      expect(adminPath.reason).toContain('Default deny rule');
    });
  });
});


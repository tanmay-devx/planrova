/**
 * shared/domain/ai/ai.policy.js
 * AI Policy Guardrails, Safety Checks & Anti-Prompt-Injection Engine.
 */

const SUSPICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /grant\s+(me\s+)?(all\s+)?permission/i,
  /bypass\s+(security|sandbox|permission)/i,
  /eval\s*\(/i,
  /<script\b[^>]*>/i,
  /DROP\s+TABLE/i,
  /delete\s+from\s+/i
];

export function inspectQueryForSafety(query = '') {
  const flags = [];

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(query)) {
      flags.push(`Query matched disallowed security pattern: ${pattern.source}`);
    }
  }

  return {
    isSafe: flags.length === 0,
    flags
  };
}

export function enforceActionExecutionPolicy(proposal) {
  if (!proposal) {
    return { allowed: false, reason: 'Proposal is missing' };
  }

  // Model-generated actions CANNOT self-execute
  if (proposal.approvalStatus !== 'approved') {
    return {
      allowed: false,
      reason: `Action execution rejected: Proposal status must be explicitly 'approved', currently '${proposal.approvalStatus}'.`
    };
  }

  // Check expiration
  if (proposal.expiresAt && new Date(proposal.expiresAt).getTime() < Date.now()) {
    return {
      allowed: false,
      reason: 'Action execution rejected: Proposal has expired.'
    };
  }

  return { allowed: true };
}


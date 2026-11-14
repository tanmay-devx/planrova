/**
 * shared/domain/ai/ai.usage.js
 * User-Scoped Usage Tracking & Rate-Limiting for Planrova AI.
 */

import { normalizeAIUsageRecord } from './ai.schemas.js';

export function checkUsageLimit(currentUsageRecord, permissions) {
  const usage = normalizeAIUsageRecord(currentUsageRecord);
  const dailyLimit = permissions?.dailyRequestLimit || 30;

  const isAllowed = usage.requestCount < dailyLimit;

  return {
    isAllowed,
    currentCount: usage.requestCount,
    limit: dailyLimit,
    remaining: Math.max(0, dailyLimit - usage.requestCount)
  };
}

export function recordUsageAttempt(currentUsageRecord, estimatedTokens = 150) {
  const usage = normalizeAIUsageRecord(currentUsageRecord);
  return {
    ...usage,
    requestCount: usage.requestCount + 1,
    totalTokensEstimated: usage.totalTokensEstimated + estimatedTokens,
    lastRequestAt: new Date().toISOString()
  };
}


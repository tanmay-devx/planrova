/**
 * src/modules/ai/ai-storage.js
 * User-Scoped Persistence Adapter for Planrova AI on Web.
 */

import { getStorageItem, setStorageItem, getCurrentUserId } from '../../utils/storage.js';
import {
  AI_STORAGE_KEYS,
  normalizeAIPermissions,
  normalizeAIUsageRecord
} from '../../../shared/domain/ai/index.js';

function getKey(baseKey) {
  const uid = getCurrentUserId() || 'local';
  return `${baseKey}_${uid}`;
}

export function getAIPermissions() {
  const raw = getStorageItem(getKey(AI_STORAGE_KEYS.PERMISSIONS));
  return normalizeAIPermissions(raw, getCurrentUserId() || 'local');
}

export function saveAIPermissions(permissions) {
  const normalized = normalizeAIPermissions(permissions, getCurrentUserId() || 'local');
  setStorageItem(getKey(AI_STORAGE_KEYS.PERMISSIONS), normalized);
  return normalized;
}

export function getAIConversations() {
  const raw = getStorageItem(getKey(AI_STORAGE_KEYS.CONVERSATIONS));
  return Array.isArray(raw) ? raw : [];
}

export function saveAIConversations(conversations) {
  setStorageItem(getKey(AI_STORAGE_KEYS.CONVERSATIONS), conversations);
}

export function getAIMessages(conversationId = 'default') {
  const raw = getStorageItem(`${getKey(AI_STORAGE_KEYS.MESSAGES)}_${conversationId}`);
  return Array.isArray(raw) ? raw : [];
}

export function saveAIMessages(conversationId = 'default', messages = []) {
  setStorageItem(`${getKey(AI_STORAGE_KEYS.MESSAGES)}_${conversationId}`, messages);
}

export function getAIProposals() {
  const raw = getStorageItem(getKey(AI_STORAGE_KEYS.PROPOSALS));
  return Array.isArray(raw) ? raw : [];
}

export function saveAIProposals(proposals = []) {
  setStorageItem(getKey(AI_STORAGE_KEYS.PROPOSALS), proposals);
}

export function getAIUsage() {
  const raw = getStorageItem(getKey(AI_STORAGE_KEYS.USAGE));
  return normalizeAIUsageRecord(raw, getCurrentUserId() || 'local');
}

export function saveAIUsage(usageRecord) {
  setStorageItem(getKey(AI_STORAGE_KEYS.USAGE), usageRecord);
}

export function clearAIHistory(conversationId = 'default') {
  saveAIMessages(conversationId, []);
  saveAIProposals([]);
}


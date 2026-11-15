// src/config/api.js
// Central configuration for the Planrova OCR proxy server.
//
// HOW TO SWITCH ENVIRONMENTS:
//   - Development (local PC):   Use PROXY_URLS_LOCAL  (default below)
//   - Production (cloud):       Replace CLOUD_PROXY_URL with your Railway/Render URL
//
// The app tries each URL in order and uses the first one that responds.

import { auth } from '../firebase';

// ── Dependency injection for testing / isolation ─────────────────────────
let _authInstance = auth;

export function setFirebaseAuth(customAuth) {
  _authInstance = customAuth;
}

// ── Your deployed cloud proxy URL (set this after deploying to Railway/Render) ──
// Example: 'https://planrova-proxy.up.railway.app'
export const CLOUD_PROXY_URL = 'https://planory-ocr-proxy.onrender.com';   // ← Paste your Railway URL here after deploy

// ── Fallback URLs for local development (emulator + simulator) ──
const LOCAL_PROXY_URLS = [
  'http://10.0.2.2:3001',   // Android emulator → host machine
  'http://localhost:3001',   // iOS simulator / physical device
];

// ── Build the full ordered list of proxy base URLs to try ──
export function getProxyUrls() {
  const urls = [];
  if (CLOUD_PROXY_URL && CLOUD_PROXY_URL.trim()) {
    urls.push(CLOUD_PROXY_URL.trim().replace(/\/$/, ''));  // cloud first
  }
  urls.push(...LOCAL_PROXY_URLS);  // then local fallbacks
  return urls;
}

/**
 * Retrieves the current authenticated Firebase user's ID token.
 * Automatically refreshes if expired.
 * Never logs or exposes raw tokens.
 *
 * @param {boolean} forceRefresh - Force refresh token from Firebase
 * @returns {Promise<string|null>} The ID token string or null if unauthenticated
 */
export async function getAuthToken(forceRefresh = false) {
  try {
    const activeAuth = _authInstance || auth;
    const user = activeAuth?.currentUser;
    if (user && typeof user.getIdToken === 'function') {
      return await user.getIdToken(forceRefresh);
    }
  } catch (err) {
    // Redact any credential info from log output
    console.warn('[OCR] Failed to retrieve authentication token:', err.message);
  }
  return null;
}

/**
 * Make an OCR request through any available proxy.
 * Cryptographically authenticated with Firebase ID token.
 * 
 * @param {object} payload - The Groq chat completions payload (model + messages)
 * @param {string} type - 'whiteboard' | 'calendar' | 'timetable'
 * @param {object} options - Optional overrides (e.g. { authToken })
 * @returns {Promise<Response>}
 */
export async function callOcrProxy(payload, type = 'scan', options = {}) {
  // 1. Resolve Firebase Auth token
  const token = options.authToken !== undefined ? options.authToken : await getAuthToken();

  if (!token) {
    throw new Error('Authentication required: You must be signed in to perform OCR scans.');
  }

  const proxyUrls = getProxyUrls();
  let lastError = null;

  for (const baseUrl of proxyUrls) {
    try {
      const response = await fetch(`${baseUrl}/api/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, payload }),
      });

      if (response.ok) return response;

      // Parse error body safely without exposing sensitive data
      const errBody = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error(`Authentication failed (${response.status}): ${errBody?.error || 'Invalid or expired session'}`);
      }
      if (response.status === 429) {
        throw new Error(`Usage limit exceeded (${response.status}): ${errBody?.error || 'Too many requests'}`);
      }

      throw new Error(`Server error (${response.status}): ${errBody?.error || 'Unknown server error'}`);
    } catch (err) {
      // Do not log the authorization token in logs or console
      console.warn(`[OCR] Proxy attempt failed for ${baseUrl}: ${err.message}`);
      lastError = err;

      // If the error is 401 (Authentication failed), do not retry all fallback URLs with the same invalid token
      if (err.message && err.message.includes('Authentication failed (401)')) {
        break;
      }
    }
  }

  throw lastError || new Error('All proxy endpoints unreachable');
}

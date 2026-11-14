// server/proxy.js — Planrova Multimodal Vision OCR Proxy Server
// Lightweight, zero-dependency Node.js proxy.
// Protects the Groq API key: clients never see or store the credential.

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 1. Load .env file manually (zero external dependencies) ──────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}
loadEnv();

const PORT = parseInt(process.env.PORT, 10) || 3001;
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const MAX_BODY_SIZE = 15 * 1024 * 1024; // 15MB max for base64 timetable/whiteboard photos
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 scans per minute per client IP

if (!GROQ_KEY || GROQ_KEY === 'your_groq_api_key_here') {
  console.warn('\n⚠️  WARNING: GROQ_API_KEY is not configured in server/.env');
  console.warn('   OCR vision requests will return HTTP 503 until key is set.\n');
} else {
  console.log('✅ Groq API Key loaded securely on server.');
}

// ── 2. In-Memory Sliding-Window Rate Limiter ─────────────────────────────
const rateLimitMap = new Map();

export function checkRateLimit(ip) {
  const now = Date.now();
  let clientHistory = rateLimitMap.get(ip);

  if (!clientHistory) {
    clientHistory = [];
    rateLimitMap.set(ip, clientHistory);
  }

  // Purge entries older than the window
  const validTimestamps = clientHistory.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);

  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - validTimestamps.length);
  const isAllowed = validTimestamps.length <= RATE_LIMIT_MAX_REQUESTS;

  return {
    allowed: isAllowed,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: remaining,
    resetTime: Math.ceil((now + RATE_LIMIT_WINDOW_MS) / 1000)
  };
}

// Periodic cleanup of rateLimitMap to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, valid);
    }
  }
}, 5 * 60 * 1000);

// ── 3. Helper Functions ──────────────────────────────────────────────────
function parseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function sendJSON(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Length': Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

function groqRequest(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (groqRes) => {
      let data = '';
      groqRes.on('data', (chunk) => { data += chunk; });
      groqRes.on('end', () => resolve({ status: groqRes.statusCode, body: data }));
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Upstream request timed out after 60s'));
    });
    req.write(body);
    req.end();
  });
}

// ── 4. HTTP Request Handler ──────────────────────────────────────────────
export const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

  // 1. Health Check
  if (req.method === 'GET' && req.url === '/api/health') {
    return sendJSON(res, 200, {
      status: 'ok',
      service: 'Planrova OCR Proxy',
      keyConfigured: Boolean(GROQ_KEY && GROQ_KEY !== 'your_groq_api_key_here'),
      timestamp: Date.now()
    });
  }

  // 2. OCR Vision Proxy Endpoint
  if (req.method === 'POST' && req.url === '/api/ocr') {
    // Check rate limit
    const rateLimit = checkRateLimit(clientIP);
    const rateLimitHeaders = {
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(rateLimit.resetTime)
    };

    if (!rateLimit.allowed) {
      return sendJSON(res, 429, { 
        error: 'Too many requests. Please wait a moment before trying another OCR scan.' 
      }, rateLimitHeaders);
    }

    if (!GROQ_KEY || GROQ_KEY === 'your_groq_api_key_here') {
      return sendJSON(res, 503, { 
        error: 'Groq API key not configured on server. Set GROQ_API_KEY in environment variables.' 
      }, rateLimitHeaders);
    }

    let rawBody = '';
    let bodyLength = 0;

    req.on('data', (chunk) => {
      bodyLength += chunk.length;
      if (bodyLength > MAX_BODY_SIZE) {
        req.destroy();
        return sendJSON(res, 413, { error: 'Payload size exceeds 15MB limit' }, rateLimitHeaders);
      }
      rawBody += chunk;
    });

    req.on('end', async () => {
      if (res.writableEnded) return;

      const parsed = parseJSON(rawBody);
      if (!parsed || !parsed.payload || typeof parsed.payload !== 'object') {
        return sendJSON(res, 400, { error: 'Invalid or missing "payload" in request body' }, rateLimitHeaders);
      }

      // Payload validation
      if (!Array.isArray(parsed.payload.messages) || parsed.payload.messages.length === 0) {
        return sendJSON(res, 400, { error: 'Payload must contain a non-empty "messages" array' }, rateLimitHeaders);
      }

      try {
        console.log(`[OCR Proxy] Processing ${parsed.type || 'scan'} request from ${clientIP}...`);
        const result = await groqRequest(parsed.payload);
        const parsedResult = parseJSON(result.body);
        console.log(`[OCR Proxy] Upstream status: ${result.status}`);
        sendJSON(res, result.status, parsedResult || { raw: result.body }, rateLimitHeaders);
      } catch (err) {
        console.error('[OCR Proxy] Upstream request failed:', err.message);
        sendJSON(res, 502, { error: 'Upstream OCR service failure: ' + err.message }, rateLimitHeaders);
      }
    });

    return;
  }

  // 404 Fallback
  sendJSON(res, 404, { error: 'Endpoint not found' });
});

// Start listener only when run directly (enables unit testing of server handler)
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  server.listen(PORT, () => {
    console.log(`\n🚀 [Planrova OCR Proxy] Running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   OCR:    POST http://localhost:${PORT}/api/ocr\n`);
  });

  server.on('error', (err) => {
    console.error('[OCR Proxy] Server error:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`[OCR Proxy] Port ${PORT} already in use.`);
    }
  });
}

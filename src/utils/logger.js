/**
 * logger.js — Planrova Centralized Structured Logging & Observability
 *
 * Implements structured logging, safe diagnostic buffering, sensitive token redaction,
 * and user-friendly error formatting.
 */

const MAX_LOG_BUFFER = 100;
const _logBuffer = [];

const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9_\-\.]+/gi,
  /gsk_[A-Za-z0-9]+/gi,
  /AIza[0-9A-Za-z-_]{35}/g,
  /password["':\s]+[^"',\s}]+/gi
];

function redactSensitive(data) {
  if (typeof data === 'string') {
    let cleaned = data;
    SENSITIVE_PATTERNS.forEach(pat => {
      cleaned = cleaned.replace(pat, '[REDACTED_CREDENTIAL]');
    });
    return cleaned;
  }
  if (data && typeof data === 'object') {
    try {
      const serialized = JSON.stringify(data);
      return JSON.parse(redactSensitive(serialized));
    } catch {
      return '[Unserializable Object]';
    }
  }
  return data;
}

function recordLog(level, moduleName, message, meta = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module: moduleName,
    message: redactSensitive(message),
    meta: meta ? redactSensitive(meta) : undefined
  };

  _logBuffer.push(entry);
  if (_logBuffer.length > MAX_LOG_BUFFER) {
    _logBuffer.shift();
  }

  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${moduleName}]`;
  if (level === 'error') {
    console.error(prefix, entry.message, entry.meta || '');
  } else if (level === 'warn') {
    console.warn(prefix, entry.message, entry.meta || '');
  } else if (level === 'info') {
    console.log(prefix, entry.message, entry.meta || '');
  }
}

export const logger = {
  debug: (mod, msg, meta) => recordLog('debug', mod, msg, meta),
  info: (mod, msg, meta) => recordLog('info', mod, msg, meta),
  warn: (mod, msg, meta) => recordLog('warn', mod, msg, meta),
  error: (mod, msg, meta) => recordLog('error', mod, msg, meta),

  getRecentLogs: () => [..._logBuffer],

  clearLogs: () => {
    _logBuffer.length = 0;
  },

  showUserError: (userFriendlyMsg) => {
    if (typeof document === 'undefined') return;
    const toast = document.getElementById('notif-toast');
    const msgEl = document.getElementById('notif-msg');
    if (!toast || !msgEl) return;

    msgEl.innerHTML = `<strong>⚠️ Notice</strong><br/>${userFriendlyMsg}`;
    toast.style.background = 'rgba(239, 68, 68, 0.15)';
    toast.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    toast.style.color = '#f87171';
    toast.classList.remove('hidden');

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.add('hidden');
      toast.style.background = '';
      toast.style.borderColor = '';
      toast.style.color = '';
    }, 4500);
  }
};

// Global unhandled error instrumentation for the browser
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('Window', event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Promise', 'Unhandled promise rejection', {
      reason: event.reason?.message || String(event.reason)
    });
  });
}


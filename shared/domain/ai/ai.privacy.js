/**
 * shared/domain/ai/ai.privacy.js
 * Data Redaction and Privacy Guardrails for Planrova AI.
 */

const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/g, // Google API key
  /gsk_[0-9A-Za-z]{40,}/g, // Groq API key
  /sk-[a-zA-Z0-9]{32,}/g, // Generic API secret
  /\b(?:\d[ -]*?){13,16}\b/g // Credit/debit card numbers
];

export function redactSensitiveData(text = '') {
  if (typeof text !== 'string') return '';
  let sanitized = text;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SENSITIVE_DATA]');
  }

  return sanitized;
}

export function generateContextPrivacyNotice(categoriesIncluded = [], categoriesExcluded = []) {
  return {
    included: categoriesIncluded,
    excluded: categoriesExcluded,
    summary: categoriesIncluded.length > 0
      ? `This request included minimized data from: ${categoriesIncluded.join(', ')}.`
      : 'No personal data categories were included in this request.',
    notice: 'Planrova does not transmit your personal data without your explicit category permission.'
  };
}


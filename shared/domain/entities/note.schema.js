/**
 * shared/domain/entities/note.schema.js
 * Canonical Note Schema & Validation for Planrova 2.0
 */

export const NOTE_FORMATS = Object.freeze(['html', 'markdown', 'plain']);

/**
 * Validates a canonical Note object.
 */
export function validateNote(note) {
  const errors = [];
  if (!note || typeof note !== 'object') {
    return { valid: false, errors: ['Note must be an object'] };
  }

  if (!note.id || typeof note.id !== 'string') {
    errors.push('Note id is required and must be a string');
  }

  if (typeof note.title !== 'string') {
    errors.push('Note title must be a string');
  }

  if (typeof note.content !== 'string' && typeof note.text !== 'string') {
    errors.push('Note must have content or text string');
  }

  if (note.format && !NOTE_FORMATS.includes(note.format)) {
    errors.push(`Invalid format "${note.format}". Valid: ${NOTE_FORMATS.join(', ')}`);
  }

  if (note.linkedTaskIds && !Array.isArray(note.linkedTaskIds)) {
    errors.push('linkedTaskIds must be an array of string IDs');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes any note (legacy or new) into the Canonical Note schema.
 */
export function normalizeNote(raw = {}) {
  const now = Date.now();
  const dateStr = raw.date || new Date().toISOString().split('T')[0];
  const id = raw.id || dateStr; // Preserve existing date-based or uuid format
  const title = (raw.title || 'Untitled Note').trim();
  const content = raw.content !== undefined ? raw.content : (raw.text || '');
  const text = raw.text !== undefined ? raw.text : content.replace(/<[^>]*>/g, '').trim();
  const format = raw.format || (content.includes('<') && content.includes('>') ? 'html' : 'markdown');
  const subject = raw.subject || 'General';
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  
  // Extract linked tasks from canonical linkedTaskIds or legacy linkedTasks
  const linkedTaskIds = Array.isArray(raw.linkedTaskIds)
    ? [...new Set(raw.linkedTaskIds)]
    : (Array.isArray(raw.linkedTasks) ? [...new Set(raw.linkedTasks)] : []);

  const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];

  return {
    ...raw,
    id,
    date: dateStr,
    title,
    content,
    text,
    format,
    subject,
    tags,
    linkedTaskIds,
    linkedTasks: linkedTaskIds, // preserve legacy key for notes drawer mentions
    pinned: Boolean(raw.pinned),
    color: raw.color || '#171B22',
    attachments,
    createdAt: raw.createdAt || raw.created_at || now,
    updatedAt: raw.updatedAt || raw.updated_at || now,
    lastEdited: raw.lastEdited || new Date().toISOString(),
    deleted: Boolean(raw.deleted),
    schemaVersion: 1
  };
}


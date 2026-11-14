/**
 * validation.js — Planrova Domain Entity Validation & Sanitization
 *
 * Ensures structural integrity, data cleanliness, and boundary checks
 * for all entities stored locally in IndexedDB and synchronized to Firestore.
 */

// ── 1. Monetary minor unit utilities (Paise / Cents) ─────────────────────
// Always compute money using integers (e.g. 100.50 INR -> 10050 paise)
export function toMinorUnits(amount) {
  const parsed = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function fromMinorUnits(minorUnits) {
  const parsed = parseInt(minorUnits, 10);
  if (isNaN(parsed)) return 0;
  return parsed / 100;
}

export function formatCurrency(amountOrMinorUnits, isMinorUnits = true, currencySymbol = '₹') {
  const value = isMinorUnits ? fromMinorUnits(amountOrMinorUnits) : parseFloat(amountOrMinorUnits) || 0;
  return `${currencySymbol}${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ── 2. Task Validation ──────────────────────────────────────────────────
export function validateTask(task) {
  if (!task || typeof task !== 'object') {
    throw new Error('Task must be a valid object');
  }

  const sanitized = {
    id: String(task.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
    title: String(task.title || '').trim(),
    desc: String(task.desc || '').trim(),
    date: String(task.date || '').trim(), // Expected format: YYYY-MM-DD
    startTime: String(task.startTime || '').trim(),
    endTime: String(task.endTime || '').trim(),
    category: ['work', 'study', 'health', 'personal', 'other'].includes(task.category) ? task.category : 'other',
    priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
    completed: Boolean(task.completed),
    updated_at: typeof task.updated_at === 'number' ? task.updated_at : Date.now(),
    deleted: Boolean(task.deleted)
  };

  if (!sanitized.title) {
    throw new Error('Task title cannot be empty');
  }

  return sanitized;
}

// ── 3. Habit Validation ─────────────────────────────────────────────────
export function validateHabit(habit) {
  if (!habit || typeof habit !== 'object') {
    throw new Error('Habit must be a valid object');
  }

  const sanitized = {
    id: String(habit.id || `h_${Date.now()}`),
    name: String(habit.name || '').trim(),
    streak: Math.max(0, parseInt(habit.streak ?? habit.fire, 10) || 0),
    icon: String(habit.icon || 'flame-outline'),
    logs: Array.isArray(habit.logs) ? habit.logs.map(String) : [],
    updated_at: typeof habit.updated_at === 'number' ? habit.updated_at : Date.now(),
    deleted: Boolean(habit.deleted)
  };

  if (!sanitized.name) {
    throw new Error('Habit name cannot be empty');
  }

  return sanitized;
}

// ── 4. Expense Validation ───────────────────────────────────────────────
export function validateExpense(expense) {
  if (!expense || typeof expense !== 'object') {
    throw new Error('Expense must be a valid object');
  }

  // Handle minor units / raw amount
  let amountMinor = 0;
  if (typeof expense.amount_minor === 'number') {
    amountMinor = Math.max(0, Math.round(expense.amount_minor));
  } else if (expense.amount !== undefined) {
    amountMinor = toMinorUnits(expense.amount);
  }

  const sanitized = {
    id: String(expense.id || `exp_${Date.now()}`),
    amount: fromMinorUnits(amountMinor), // backward compatibility for UI
    amount_minor: amountMinor, // integer minor units for exact math
    category: String(expense.category || 'Other').trim(),
    notes: String(expense.notes || '').trim(),
    date: String(expense.date || '').trim(), // Expected format: YYYY-MM-DD
    updated_at: typeof expense.updated_at === 'number' ? expense.updated_at : Date.now(),
    deleted: Boolean(expense.deleted)
  };

  if (amountMinor <= 0 && !sanitized.deleted) {
    throw new Error('Expense amount must be greater than zero');
  }

  return sanitized;
}

// ── 5. Note Validation ──────────────────────────────────────────────────
export function validateNote(note) {
  if (!note || typeof note !== 'object') {
    throw new Error('Note must be a valid object');
  }

  const sanitized = {
    id: String(note.id || `note_${note.date || Date.now()}`),
    date: String(note.date || '').trim(), // Primary key date string
    title: String(note.title || 'Untitled Note').trim(),
    content: String(note.content || ''),
    pinned: Boolean(note.pinned),
    tags: Array.isArray(note.tags) ? note.tags.map(String) : [],
    linkedTasks: Array.isArray(note.linkedTasks) ? note.linkedTasks.map(String) : [],
    updated_at: typeof note.updated_at === 'number' ? note.updated_at : Date.now(),
    deleted: Boolean(note.deleted)
  };

  return sanitized;
}

// ── 6. Hydration Log Validation ─────────────────────────────────────────
export function validateHydrationLog(log) {
  if (!log || typeof log !== 'object') {
    throw new Error('Hydration log must be a valid object');
  }

  const amount = parseInt(log.amount, 10);
  if (isNaN(amount)) {
    throw new Error('Hydration amount must be a number');
  }

  const sanitized = {
    id: String(log.id || `h_${Date.now()}`),
    amount: amount,
    type: String(log.type || 'Water').trim(),
    date: String(log.date || '').trim(),
    timestamp: typeof log.timestamp === 'number' ? log.timestamp : Date.now(),
    updated_at: typeof log.updated_at === 'number' ? log.updated_at : Date.now(),
    deleted: Boolean(log.deleted)
  };

  return sanitized;
}

// ── 7. User Profile Validation ──────────────────────────────────────────
export function validateUserProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('User profile must be a valid object');
  }

  return {
    name: String(profile.name || 'User').trim().substring(0, 50),
    bio: String(profile.bio || '').trim().substring(0, 160),
    timezone: String(profile.timezone || 'Asia/Kolkata').trim(),
    avatar: String(profile.avatar || '⬡'),
    onboarded: Boolean(profile.onboarded),
    college: String(profile.college || '').trim().substring(0, 100),
    branch: String(profile.branch || '').trim().substring(0, 100),
    semester: String(profile.semester || '').trim().substring(0, 20),
    updated_at: typeof profile.updated_at === 'number' ? profile.updated_at : Date.now()
  };
}

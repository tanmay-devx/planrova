/**
 * src/modules/quick-capture/capture-controller.js
 * Quick Capture State & Persistence Controller for Planrova 2.0 Web Client
 */

import { 
  classifyCapture, 
  parseCapture, 
  normalizeCaptureResult,
  CAPTURE_TYPES 
} from '../../../shared/domain/index.js';
import { getStorageItem, setStorageItem } from '../../utils/storage.js';

/**
 * Executes a capture operation, normalizes the entity, saves to local-first storage,
 * and updates relevant UI views.
 * 
 * Returns { success: boolean, type: string, entity: object, targetKey: string }
 */
export function executeQuickCapture(text, overrideType = null, referenceDate = new Date()) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { success: false, error: 'Input cannot be empty' };
  }

  const classification = classifyCapture(trimmed);
  const type = (overrideType && CAPTURE_TYPES.includes(overrideType)) 
    ? overrideType 
    : classification.suggestedType;

  const fields = parseCapture(trimmed, type, referenceDate);
  const { targetKey, entity } = normalizeCaptureResult(type, fields, trimmed);

  try {
    switch (targetKey) {
      case 'tasks': {
        const tasks = getStorageItem('tasks', []);
        tasks.push(entity);
        setStorageItem('tasks', tasks);
        import('../tasks.js').then(m => m.renderGrid && m.renderGrid());
        break;
      }

      case 'notes': {
        const notes = getStorageItem('notes', []);
        const idx = notes.findIndex(n => n.id === entity.id || n.date === entity.date);
        if (idx !== -1) {
          notes[idx] = entity;
        } else {
          notes.push(entity);
        }
        setStorageItem('notes', notes);
        import('../notes.js').then(m => m.renderNotesLibrary && m.renderNotesLibrary());
        break;
      }

      case 'user_habits': {
        const habits = getStorageItem('user_habits', []);
        habits.push(entity);
        setStorageItem('user_habits', habits);
        import('../habits.js').then(m => m.initHabits && m.initHabits());
        break;
      }

      case 'expenses': {
        // Dual storage for web budget module and mobile expenses list
        const budgetData = getStorageItem('budget', { expenses: [], limits: {} });
        if (!Array.isArray(budgetData.expenses)) budgetData.expenses = [];
        budgetData.expenses.push(entity);
        setStorageItem('budget', budgetData);

        const expList = getStorageItem('expenses', []);
        expList.push(entity);
        setStorageItem('expenses', expList);
        break;
      }

      case 'reminders': {
        const reminders = getStorageItem('reminders', []);
        reminders.push(entity);
        setStorageItem('reminders', reminders);
        break;
      }

      case 'calendar_events': {
        const events = getStorageItem('calendar_events', []);
        events.push(entity);
        setStorageItem('calendar_events', events);
        import('../monthly-cal.js').then(m => m.renderMonthlyCalendar && m.renderMonthlyCalendar());
        break;
      }

      case 'brain_dump':
      default: {
        const dumps = getStorageItem('brain_dump', []);
        dumps.unshift(entity);
        setStorageItem('brain_dump', dumps);
        import('../brain-dump.js').then(m => m.initBrainDump && m.initBrainDump());
        break;
      }
    }

    return {
      success: true,
      type,
      entity,
      targetKey,
      classification
    };
  } catch (err) {
    console.error('[QuickCapture] Execution failed:', err);
    return { success: false, error: err.message };
  }
}


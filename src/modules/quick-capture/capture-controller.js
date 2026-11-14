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
import { ACADEMIC_STORAGE_KEYS } from '../../../shared/domain/academic/academic.types.js';
import { FINANCE_STORAGE_KEYS } from '../../../shared/domain/finance/finance.types.js';
import { initHabits } from '../habits.js';
import { initBrainDump } from '../brain-dump.js';
import { renderGrid } from '../tasks.js';
import { renderNotesLibrary } from '../notes.js';
import { renderMonthlyCalendar } from '../monthly-cal.js';

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

  // Handle explicit academic prefixes (hw:, assignment:, exam:, course:)
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('hw:') || lower.startsWith('assignment:')) {
    const title = trimmed.replace(/^(hw:|assignment:)\s*/i, '').trim();
    const todayStr = new Date(referenceDate).toISOString().split('T')[0];
    const assignmentEntity = {
      id: 'ass_' + Date.now(),
      title,
      dueDate: todayStr,
      status: 'pending',
      created_at: Date.now()
    };
    const assignments = getStorageItem(ACADEMIC_STORAGE_KEYS.ASSIGNMENTS, []);
    assignments.push(assignmentEntity);
    setStorageItem(ACADEMIC_STORAGE_KEYS.ASSIGNMENTS, assignments);

    // Also mirror as task
    const tasks = getStorageItem('tasks', []);
    tasks.push({
      id: 'task_ass_' + Date.now(),
      title: `[HW] ${title}`,
      date: todayStr,
      category: 'academic',
      priority: 'high',
      completed: false
    });
    setStorageItem('tasks', tasks);
    if (typeof renderGrid === 'function') renderGrid();

    return {
      success: true,
      type: 'academic_assignment',
      entity: assignmentEntity,
      targetKey: ACADEMIC_STORAGE_KEYS.ASSIGNMENTS
    };
  }

  if (lower.startsWith('exam:') || lower.startsWith('assessment:')) {
    const title = trimmed.replace(/^(exam:|assessment:)\s*/i, '').trim();
    const todayStr = new Date(referenceDate).toISOString().split('T')[0];
    const assessmentEntity = {
      id: 'exam_' + Date.now(),
      title,
      dueDate: todayStr,
      type: 'exam',
      status: 'pending',
      created_at: Date.now()
    };
    const assessments = getStorageItem(ACADEMIC_STORAGE_KEYS.ASSESSMENTS, []);
    assessments.push(assessmentEntity);
    setStorageItem(ACADEMIC_STORAGE_KEYS.ASSESSMENTS, assessments);

    // Also mirror as critical task
    const tasks = getStorageItem('tasks', []);
    tasks.push({
      id: 'task_exam_' + Date.now(),
      title: `[EXAM] ${title}`,
      date: todayStr,
      category: 'academic',
      priority: 'critical',
      completed: false
    });
    setStorageItem('tasks', tasks);
    if (typeof renderGrid === 'function') renderGrid();

    return {
      success: true,
      type: 'academic_assessment',
      entity: assessmentEntity,
      targetKey: ACADEMIC_STORAGE_KEYS.ASSESSMENTS
    };
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
        if (typeof renderGrid === 'function') renderGrid();
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
        if (typeof renderNotesLibrary === 'function') renderNotesLibrary();
        break;
      }

      case 'user_habits': {
        const habits = getStorageItem('user_habits', []);
        habits.push(entity);
        setStorageItem('user_habits', habits);
        if (typeof initHabits === 'function') initHabits();
        break;
      }

      case 'expenses': {
        // Dual storage for web budget module, mobile expenses list, and finance workspace
        const budgetData = getStorageItem('budget', { expenses: [], limits: {} });
        if (!Array.isArray(budgetData.expenses)) budgetData.expenses = [];
        budgetData.expenses.push(entity);
        setStorageItem('budget', budgetData);

        const expList = getStorageItem('expenses', []);
        expList.push(entity);
        setStorageItem('expenses', expList);

        // Sync to canonical finance transactions
        const txns = getStorageItem(FINANCE_STORAGE_KEYS.TRANSACTIONS, []);
        txns.push({
          id: entity.id || 'txn_' + Date.now(),
          type: 'expense',
          amount: entity.amount || (entity.amountMinor ? entity.amountMinor / 100 : 0),
          title: entity.description || trimmed,
          description: entity.description || trimmed,
          category: entity.category || 'General',
          date: entity.date || new Date().toISOString().split('T')[0],
          created_at: Date.now()
        });
        setStorageItem(FINANCE_STORAGE_KEYS.TRANSACTIONS, txns);
        break;
      }

      case 'finance_transactions': {
        const txns = getStorageItem(FINANCE_STORAGE_KEYS.TRANSACTIONS, []);
        txns.push(entity);
        setStorageItem(FINANCE_STORAGE_KEYS.TRANSACTIONS, txns);

        // Mirror to expenses if expense
        if (entity.type === 'expense') {
          const expList = getStorageItem('expenses', []);
          expList.push({
            id: entity.id,
            amount: entity.amount,
            description: entity.title || entity.description,
            category: entity.category,
            date: entity.date || entity.transactionDate
          });
          setStorageItem('expenses', expList);
        }
        break;
      }

      case 'finance_budgets': {
        const budgets = getStorageItem(FINANCE_STORAGE_KEYS.BUDGETS, []);
        budgets.push(entity);
        setStorageItem(FINANCE_STORAGE_KEYS.BUDGETS, budgets);
        break;
      }

      case 'finance_savings_goals': {
        const goals = getStorageItem(FINANCE_STORAGE_KEYS.SAVINGS_GOALS, []);
        goals.push(entity);
        setStorageItem(FINANCE_STORAGE_KEYS.SAVINGS_GOALS, goals);
        break;
      }

      case 'hydration_logs': {
        const logs = getStorageItem('hydration_logs', []);
        logs.push(entity);
        setStorageItem('hydration_logs', logs);

        // Update daily hydration status
        const hydration = getStorageItem('hydration', { water: 0, target: 2000 });
        hydration.water = (Number(hydration.water) || 0) + (Number(entity.amountMl) || 250);
        setStorageItem('hydration', hydration);
        break;
      }

      case 'wellbeing_routines': {
        const routines = getStorageItem('wellbeing_routines', []);
        routines.push(entity);
        setStorageItem('wellbeing_routines', routines);
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
        if (typeof renderMonthlyCalendar === 'function') renderMonthlyCalendar();
        break;
      }

      case 'brain_dump':
      default: {
        const dumps = getStorageItem('brain_dump', []);
        dumps.unshift(entity);
        setStorageItem('brain_dump', dumps);
        if (typeof initBrainDump === 'function') initBrainDump();
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

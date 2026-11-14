/**
 * shared/domain/capture/capture.normalizer.js
 * Transforms parsed capture fields into valid Canonical Entities for Planrova 2.0
 */

import { normalizeTask } from '../entities/task.schema.js';
import { normalizeNote } from '../entities/note.schema.js';
import { normalizeHabit } from '../entities/habit.schema.js';
import { normalizeExpense } from '../entities/expense.schema.js';
import { normalizeReminder } from '../entities/reminder.schema.js';
import { normalizeCalendarEvent } from '../entities/calendar-event.schema.js';
import { normalizeTransaction, normalizeBudget, normalizeSavingsGoal } from '../finance/finance.schemas.js';
import { normalizeHydrationLog, normalizeRoutine } from '../wellbeing/wellbeing.schemas.js';

/**
 * Normalizes capture output into a canonical entity payload and target storage key.
 * Returns: { targetKey: string, entity: object }
 */
export function normalizeCaptureResult(type, fields = {}, originalText = '') {
  switch (type) {
    case 'task':
      return {
        targetKey: 'tasks',
        entity: normalizeTask({
          title: fields.title || originalText,
          dueDate: fields.dueDate,
          startTime: fields.startTime,
          endTime: fields.endTime,
          priority: fields.priority,
          category: fields.category
        })
      };

    case 'note':
      return {
        targetKey: 'notes',
        entity: normalizeNote({
          title: fields.title,
          content: fields.content || originalText,
          text: fields.text || originalText,
          subject: fields.subject,
          date: fields.date
        })
      };

    case 'habit':
      return {
        targetKey: 'user_habits',
        entity: normalizeHabit({
          name: fields.name || originalText,
          icon: fields.icon,
          frequency: fields.frequency
        })
      };

    case 'expense':
      return {
        targetKey: 'expenses',
        entity: normalizeExpense({
          amountMinor: fields.amountMinor,
          amount: fields.amount,
          currency: fields.currency,
          category: fields.category,
          description: fields.description || originalText,
          date: fields.date
        })
      };

    case 'income':
      return {
        targetKey: 'finance_transactions',
        entity: normalizeTransaction({
          type: 'income',
          amountMinor: fields.amountMinor,
          amount: fields.amount,
          currency: fields.currency,
          title: fields.title || originalText,
          description: fields.description || originalText,
          transactionDate: fields.date
        })
      };

    case 'budget':
      return {
        targetKey: 'finance_budgets',
        entity: normalizeBudget({
          limitMinor: fields.limitMinor,
          limit: fields.limit,
          currency: fields.currency,
          period: fields.period,
          category: fields.category,
          name: fields.name || originalText
        })
      };

    case 'savings_goal':
      return {
        targetKey: 'finance_savings_goals',
        entity: normalizeSavingsGoal({
          title: fields.title || originalText,
          targetAmountMinor: fields.targetAmountMinor,
          targetAmount: fields.targetAmount,
          currency: fields.currency,
          contributionFrequency: fields.contributionFrequency
        })
      };

    case 'hydration':
      return {
        targetKey: 'hydration_logs',
        entity: normalizeHydrationLog({
          amountMl: fields.amountMl,
          beverageType: fields.beverageType,
          dateKey: fields.dateKey || fields.date
        })
      };

    case 'routine':
      return {
        targetKey: 'wellbeing_routines',
        entity: normalizeRoutine({
          title: fields.title || originalText,
          type: fields.type,
          estimatedDurationMinutes: fields.estimatedDurationMinutes
        })
      };

    case 'reminder':
      return {
        targetKey: 'reminders',
        entity: normalizeReminder({
          title: fields.title || originalText,
          dueDate: fields.dueDate,
          dueTime: fields.dueTime,
          priority: fields.priority
        })
      };

    case 'calendar_event':
      return {
        targetKey: 'calendar_events',
        entity: normalizeCalendarEvent({
          title: fields.title || originalText,
          date: fields.date,
          startTime: fields.startTime,
          endTime: fields.endTime,
          category: fields.category
        })
      };

    case 'brain_dump':
    default:
      return {
        targetKey: 'brain_dump',
        entity: {
          id: `d_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          text: fields.text || originalText,
          date: fields.date || new Date().toISOString()
        }
      };
  }
}

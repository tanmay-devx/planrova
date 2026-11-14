/**
 * shared/domain/wellbeing/wellbeing-scheduler.adapter.js
 * Adaptive Scheduling Adapter for Planrova 2.0 Wellbeing Domain.
 *
 * Transforms habits, routines, and hydration intervals into canonical
 * scheduling inputs for Phase 3's Adaptive Planning Engine.
 *
 * Invariants:
 * 1. Habits and routines map to flexible tasks with user-defined durations and time windows.
 * 2. Fixed events and locked blocks are never overwritten or silently moved.
 * 3. Proposal freshness and user acceptance workflows are strictly honored.
 */

import { generateScheduleProposal } from '../scheduling/scheduling.engine.js';
import { isHabitScheduledForDay } from './habit.engine.js';

/**
 * Transforms wellbeing entities into canonical scheduling inputs.
 */
export function transformWellbeingEntitiesToSchedulingInputs({
  targetDateStr = new Date().toISOString().slice(0, 10),
  habits = [],
  routines = [],
  existingTasks = [],
  fixedEvents = [],
  includeHabits = true,
  includeRoutines = true,
  defaultHabitMinutes = 20
} = {}) {
  const targetDateObj = new Date(`${targetDateStr}T00:00:00Z`);
  const dayOfWeek = targetDateObj.getUTCDay();

  const flexibleTasks = [...(existingTasks || [])];
  const existingWellbeingLinkIds = new Set(
    flexibleTasks.map(t => t.linkedWellbeingId || t.sourceEntityId).filter(Boolean)
  );

  // 1. Map Habits scheduled for target date
  if (includeHabits) {
    for (const habit of habits) {
      if (habit.isPaused || habit.isArchived) continue;
      
      // Check if already completed on target date
      const isCompleted = Array.isArray(habit.completionDates) && habit.completionDates.includes(targetDateStr);
      if (isCompleted) continue;

      if (isHabitScheduledForDay(habit, dayOfWeek)) {
        const linkId = `habit_${habit.id}_${targetDateStr}`;
        if (!existingWellbeingLinkIds.has(linkId)) {
          const duration = habit.estimatedMinutes || defaultHabitMinutes;
          flexibleTasks.push({
            id: `task_${linkId}`,
            title: `Habit: ${habit.name || habit.title}`,
            estimatedMinutes: duration,
            priority: habit.priority || 'medium',
            type: 'habit_session',
            linkedWellbeingId: linkId,
            sourceDomain: 'wellbeing',
            preferredTime: habit.preferredTime || null,
            isFixed: false
          });
          existingWellbeingLinkIds.add(linkId);
        }
      }
    }
  }

  // 2. Map Routines scheduled for target date
  if (includeRoutines) {
    for (const routine of routines) {
      if (!routine.isActive) continue;
      
      const isScheduledToday = Array.isArray(routine.daysOfWeek)
        ? routine.daysOfWeek.includes(dayOfWeek)
        : true;

      if (isScheduledToday) {
        const linkId = `routine_${routine.id}_${targetDateStr}`;
        if (!existingWellbeingLinkIds.has(linkId)) {
          flexibleTasks.push({
            id: `task_${linkId}`,
            title: `Routine: ${routine.title}`,
            estimatedMinutes: routine.estimatedDurationMinutes || 20,
            priority: 'high',
            type: 'routine_block',
            linkedWellbeingId: linkId,
            sourceDomain: 'wellbeing',
            preferredTime: routine.preferredTime || null,
            isFixed: false
          });
          existingWellbeingLinkIds.add(linkId);
        }
      }
    }
  }

  return {
    tasks: flexibleTasks,
    fixedEvents: [...(fixedEvents || [])]
  };
}

/**
 * Generates an adaptive schedule proposal incorporating wellbeing habits and routines.
 */
export function generateWellbeingAwareScheduleProposal({
  targetDateStr = new Date().toISOString().slice(0, 10),
  fixedEvents = [],
  existingTasks = [],
  habits = [],
  routines = [],
  availabilityConfig = null,
  userAvailability = null,
  options = {}
} = {}) {
  const { tasks } = transformWellbeingEntitiesToSchedulingInputs({
    targetDateStr,
    habits,
    routines,
    existingTasks,
    fixedEvents
  });

  return generateScheduleProposal({
    targetDate: targetDateStr,
    fixedEvents,
    tasks,
    userAvailability: userAvailability || availabilityConfig || {},
    ...options
  });
}

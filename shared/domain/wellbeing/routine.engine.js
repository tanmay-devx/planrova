/**
 * shared/domain/wellbeing/routine.engine.js
 * Routine Execution & Step Progress Engine for Planrova 2.0.
 *
 * Invariants:
 * 1. Routines represent reusable structured personal rituals (e.g. morning, study prep, workout).
 * 2. Steps maintain deterministic ordering and durations.
 */

/**
 * Calculates routine completion metrics.
 */
export function evaluateRoutineProgress(routine) {
  const steps = Array.isArray(routine.steps) ? routine.steps : [];
  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.isCompleted).length;
  const progressPercentage = totalSteps > 0
    ? Math.round((completedSteps / totalSteps) * 100)
    : 0;

  const totalDurationMinutes = steps.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const remainingDurationMinutes = steps
    .filter(s => !s.isCompleted)
    .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  return {
    routineId: routine.id,
    title: routine.title,
    type: routine.type,
    totalSteps,
    completedSteps,
    progressPercentage,
    isCompleted: totalSteps > 0 && completedSteps === totalSteps,
    totalDurationMinutes,
    remainingDurationMinutes
  };
}

/**
 * Toggles a step completion within a routine.
 */
export function toggleRoutineStep(routine, stepId) {
  const steps = (routine.steps || []).map(s => {
    if (s.id === stepId) {
      return { ...s, isCompleted: !s.isCompleted };
    }
    return s;
  });

  return {
    ...routine,
    steps,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Resets all steps in a routine (e.g. at the start of a new day).
 */
export function resetRoutineSteps(routine) {
  const steps = (routine.steps || []).map(s => ({ ...s, isCompleted: false }));
  return {
    ...routine,
    steps,
    updatedAt: new Date().toISOString()
  };
}


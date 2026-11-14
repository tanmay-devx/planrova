/**
 * shared/domain/projects/project.engine.js
 * Pure Business Logic Engine for Planrova 2.0 Projects Workspace
 */

import { PROJECT_HEALTH } from './projects.types.js';

/**
 * Computes consolidated progress percentage for a project based on its milestones and linked tasks.
 * Milestones carry higher weight (2x) than individual checklist tasks.
 */
export function computeProjectProgress(project = {}, milestones = [], tasks = []) {
  if (project.status === 'completed') return 100;

  const projMilestones = milestones.filter(m => !m.deleted && m.project_id === project.id);
  const projTasks = tasks.filter(t => !t.deleted && (t.projectId === project.id || t.project_id === project.id));

  const totalPoints = (projMilestones.length * 2) + projTasks.length;
  if (totalPoints === 0) return 0;

  const completedMilestonePoints = projMilestones.filter(m => m.status === 'completed').length * 2;
  const completedTaskPoints = projTasks.filter(t => t.completed).length;

  const earnedPoints = completedMilestonePoints + completedTaskPoints;
  return Math.min(100, Math.round((earnedPoints / totalPoints) * 100));
}

/**
 * Computes project health status ('on_track', 'at_risk', 'overdue', 'completed').
 */
export function computeProjectHealth(project = {}, milestones = [], todayStr) {
  if (project.status === 'completed') return PROJECT_HEALTH.COMPLETED;
  if (project.status === 'on_hold') return 'on_hold';

  const safeToday = todayStr || new Date().toISOString().split('T')[0];

  // Check if project target date is in the past
  if (project.targetDate && project.targetDate < safeToday) {
    return PROJECT_HEALTH.OVERDUE;
  }

  // Check open milestones for overdue status
  const projMilestones = milestones.filter(m => !m.deleted && m.project_id === project.id);
  const hasOverdueMilestone = projMilestones.some(m =>
    m.status !== 'completed' && m.dueDate && m.dueDate < safeToday
  );

  if (hasOverdueMilestone) {
    return PROJECT_HEALTH.AT_RISK;
  }

  // Check if target date is imminent (within 7 days) and incomplete milestones remain
  if (project.targetDate) {
    const diffMs = new Date(project.targetDate).getTime() - new Date(safeToday).getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const incompleteMilestones = projMilestones.filter(m => m.status !== 'completed').length;

    if (diffDays <= 7 && incompleteMilestones > 0) {
      return PROJECT_HEALTH.AT_RISK;
    }
  }

  return PROJECT_HEALTH.ON_TRACK;
}

/**
 * Groups tasks by project ID for quick lookups.
 */
export function groupTasksByProject(projects = [], tasks = []) {
  const result = {};
  projects.forEach(p => {
    result[p.id] = [];
  });

  result['unassigned'] = [];

  tasks.forEach(t => {
    if (t.deleted) return;
    const pId = t.projectId || t.project_id;
    if (pId && result[pId]) {
      result[pId].push(t);
    } else {
      result['unassigned'].push(t);
    }
  });

  return result;
}


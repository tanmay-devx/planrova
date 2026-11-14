/**
 * shared/domain/projects/projects.types.js
 * Canonical Constants & Enums for Planrova 2.0 Projects Workspace
 */

export const PROJECTS_STORAGE_KEYS = Object.freeze({
  PROJECTS: 'planrova_projects',
  MILESTONES: 'planrova_project_milestones'
});

export const PROJECT_STATUSES = Object.freeze([
  'active',
  'on_hold',
  'completed',
  'archived'
]);

export const MILESTONE_STATUSES = Object.freeze([
  'pending',
  'in_progress',
  'completed'
]);

export const PROJECT_HEALTH = Object.freeze({
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  OVERDUE: 'overdue',
  COMPLETED: 'completed'
});


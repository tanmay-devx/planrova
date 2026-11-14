/**
 * shared/domain/projects/milestone.schema.js
 * Canonical Milestone Schema & Normalizer for Planrova 2.0
 */

import { MILESTONE_STATUSES } from './projects.types.js';

export function normalizeMilestone(input = {}) {
  const id = input.id || 'mile_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const project_id = input.project_id || '';
  const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'Untitled Milestone';
  const dueDate = input.dueDate || '';
  const status = MILESTONE_STATUSES.includes(input.status) ? input.status : 'pending';
  const order = Number.isInteger(input.order) ? input.order : 0;
  const created_at = input.created_at || Date.now();
  const updated_at = input.updated_at || Date.now();
  const deleted = Boolean(input.deleted);

  return {
    id,
    project_id,
    title,
    dueDate,
    status,
    order,
    created_at,
    updated_at,
    deleted
  };
}


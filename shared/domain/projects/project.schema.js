/**
 * shared/domain/projects/project.schema.js
 * Canonical Project Schema & Normalizer for Planrova 2.0
 */

import { PROJECT_STATUSES } from './projects.types.js';

export function normalizeProject(input = {}) {
  const id = input.id || 'proj_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Untitled Project';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const category = typeof input.category === 'string' && input.category.trim() ? input.category.trim() : 'General';
  const status = PROJECT_STATUSES.includes(input.status) ? input.status : 'active';
  const color = input.color || '#3b82f6';
  const startDate = input.startDate || new Date().toISOString().split('T')[0];
  const targetDate = input.targetDate || '';
  const created_at = input.created_at || Date.now();
  const updated_at = input.updated_at || Date.now();
  const deleted = Boolean(input.deleted);

  return {
    id,
    name,
    description,
    category,
    status,
    color,
    startDate,
    targetDate,
    created_at,
    updated_at,
    deleted
  };
}


import { describe, it, expect } from 'vitest';
import {
  normalizeProject,
  normalizeMilestone,
  computeProjectProgress,
  computeProjectHealth,
  groupTasksByProject,
  PROJECT_HEALTH
} from '../shared/domain/projects/index.js';

describe('Stage 5 — Professional Projects Workspace Domain Tests', () => {
  describe('1. Schema Normalization & Validation', () => {
    it('normalizes project with sensible defaults', () => {
      const proj = normalizeProject({
        name: 'Mobile App Redesign',
        category: 'Client Work'
      });

      expect(proj.id).toMatch(/^proj_/);
      expect(proj.name).toBe('Mobile App Redesign');
      expect(proj.category).toBe('Client Work');
      expect(proj.status).toBe('active');
      expect(proj.color).toBe('#3b82f6');
      expect(proj.deleted).toBe(false);
      expect(typeof proj.created_at).toBe('number');
    });

    it('falls back to Untitled Project when name is blank or missing', () => {
      const emptyProj = normalizeProject({});
      expect(emptyProj.name).toBe('Untitled Project');
    });

    it('normalizes milestone linked to a project', () => {
      const milestone = normalizeMilestone({
        project_id: 'proj_123',
        title: 'Complete Figma Wireframes',
        dueDate: '2026-11-20'
      });

      expect(milestone.id).toMatch(/^mile_/);
      expect(milestone.project_id).toBe('proj_123');
      expect(milestone.title).toBe('Complete Figma Wireframes');
      expect(milestone.status).toBe('pending');
      expect(milestone.deleted).toBe(false);
    });
  });

  describe('2. Project Progress Computation Engine', () => {
    const project = { id: 'p1', status: 'active' };

    it('returns 0% when no milestones or tasks exist', () => {
      expect(computeProjectProgress(project, [], [])).toBe(0);
    });

    it('returns 100% when project is explicitly marked completed', () => {
      expect(computeProjectProgress({ id: 'p1', status: 'completed' }, [], [])).toBe(100);
    });

    it('weights milestones at 2x and tasks at 1x in progress rollups', () => {
      const milestones = [
        { id: 'm1', project_id: 'p1', status: 'completed' }, // 2 pts
        { id: 'm2', project_id: 'p1', status: 'pending' }     // 2 pts (total: 4 pts)
      ];

      const tasks = [
        { id: 't1', projectId: 'p1', completed: true },       // 1 pt
        { id: 't2', projectId: 'p1', completed: false }       // 1 pt (total: 2 pts, overall: 6 pts)
      ];

      // Earned: 2 + 1 = 3 pts out of 6 total pts = 50%
      const progress = computeProjectProgress(project, milestones, tasks);
      expect(progress).toBe(50);
    });

    it('ignores deleted milestones and tasks in calculation', () => {
      const milestones = [
        { id: 'm1', project_id: 'p1', status: 'completed' },
        { id: 'm2', project_id: 'p1', status: 'pending', deleted: true }
      ];

      // Only m1 counts: 2 earned out of 2 total = 100%
      const progress = computeProjectProgress(project, milestones, []);
      expect(progress).toBe(100);
    });
  });

  describe('3. Project Health Diagnostic Engine', () => {
    const todayStr = '2026-11-15';

    it('marks project as COMPLETED if status is completed', () => {
      const health = computeProjectHealth({ id: 'p1', status: 'completed' }, [], todayStr);
      expect(health).toBe(PROJECT_HEALTH.COMPLETED);
    });

    it('marks project as OVERDUE if target date is in the past', () => {
      const health = computeProjectHealth(
        { id: 'p1', status: 'active', targetDate: '2026-11-10' },
        [],
        todayStr
      );
      expect(health).toBe(PROJECT_HEALTH.OVERDUE);
    });

    it('marks project as AT_RISK if any open milestone is past its due date', () => {
      const milestones = [
        { id: 'm1', project_id: 'p1', status: 'pending', dueDate: '2026-11-14' } // overdue
      ];

      const health = computeProjectHealth(
        { id: 'p1', status: 'active', targetDate: '2026-11-30' },
        milestones,
        todayStr
      );
      expect(health).toBe(PROJECT_HEALTH.AT_RISK);
    });

    it('marks project as AT_RISK if target date is within 7 days and milestones remain open', () => {
      const milestones = [
        { id: 'm1', project_id: 'p1', status: 'pending', dueDate: '2026-11-18' }
      ];

      const health = computeProjectHealth(
        { id: 'p1', status: 'active', targetDate: '2026-11-19' }, // 4 days away
        milestones,
        todayStr
      );
      expect(health).toBe(PROJECT_HEALTH.AT_RISK);
    });

    it('marks project as ON_TRACK when deadlines and milestones are healthy', () => {
      const milestones = [
        { id: 'm1', project_id: 'p1', status: 'pending', dueDate: '2026-12-01' }
      ];

      const health = computeProjectHealth(
        { id: 'p1', status: 'active', targetDate: '2026-12-15' },
        milestones,
        todayStr
      );
      expect(health).toBe(PROJECT_HEALTH.ON_TRACK);
    });
  });

  describe('4. Task Grouping by Project', () => {
    it('associates tasks with projects and isolates unassigned tasks', () => {
      const projects = [{ id: 'p1' }, { id: 'p2' }];
      const tasks = [
        { id: 't1', projectId: 'p1', title: 'Task 1' },
        { id: 't2', projectId: 'p2', title: 'Task 2' },
        { id: 't3', projectId: 'p1', title: 'Task 3' },
        { id: 't4', title: 'Ad-hoc Task' }
      ];

      const grouped = groupTasksByProject(projects, tasks);
      expect(grouped['p1'].length).toBe(2);
      expect(grouped['p2'].length).toBe(1);
      expect(grouped['unassigned'].length).toBe(1);
    });
  });
});


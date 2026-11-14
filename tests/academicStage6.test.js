/**
 * tests/academicStage6.test.js
 * Stage 6: Assignment Dependency DAG Engine Verification
 */

import { describe, it, expect } from 'vitest';
import {
  validateAssignmentDAG,
  topologicalSortAssignments,
  resolveAssignmentStates,
  computeCriticalPath,
  syncAssignmentWithTasks,
  ASSIGNMENT_STATUSES
} from '../shared/domain/academic/index.js';

describe('Academic Domain - Stage 6: Assignment Dependency DAG Engine', () => {
  const sampleProject = [
    { id: 'asgn_1', title: '1. Topic Proposal', dependencyIds: [], estimatedMinutes: 60, status: ASSIGNMENT_STATUSES.COMPLETED },
    { id: 'asgn_2', title: '2. Literature Review', dependencyIds: ['asgn_1'], estimatedMinutes: 180, status: ASSIGNMENT_STATUSES.IN_PROGRESS },
    { id: 'asgn_3', title: '3. Data Collection', dependencyIds: ['asgn_1'], estimatedMinutes: 120, status: ASSIGNMENT_STATUSES.NOT_STARTED },
    { id: 'asgn_4', title: '4. Analysis & Synthesis', dependencyIds: ['asgn_2', 'asgn_3'], estimatedMinutes: 240, status: ASSIGNMENT_STATUSES.NOT_STARTED },
    { id: 'asgn_5', title: '5. Final Paper & Submission', dependencyIds: ['asgn_4'], estimatedMinutes: 120, status: ASSIGNMENT_STATUSES.NOT_STARTED }
  ];

  describe('validateAssignmentDAG', () => {
    it('validates a correct acyclic project graph', () => {
      const res = validateAssignmentDAG(sampleProject);
      expect(res.valid).toBe(true);
      expect(res.hasCycles).toBe(false);
      expect(res.errors).toHaveLength(0);
    });

    it('detects direct self-dependencies', () => {
      const selfDep = [{ id: 'a1', title: 'Self', dependencyIds: ['a1'] }];
      const res = validateAssignmentDAG(selfDep);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('cannot depend on itself');
    });

    it('detects mutual and transitive cycles', () => {
      const cyclic = [
        { id: 'a1', title: 'A1', dependencyIds: ['a2'] },
        { id: 'a2', title: 'A2', dependencyIds: ['a3'] },
        { id: 'a3', title: 'A3', dependencyIds: ['a1'] }
      ];
      const res = validateAssignmentDAG(cyclic);
      expect(res.valid).toBe(false);
      expect(res.hasCycles).toBe(true);
      expect(res.cyclePath).toBeDefined();
    });
  });

  describe('topologicalSortAssignments', () => {
    it('sorts assignments such that prerequisites always come before dependents', () => {
      const sorted = topologicalSortAssignments(sampleProject);
      const sortedIds = sorted.map(a => a.id);

      expect(sortedIds.indexOf('asgn_1')).toBeLessThan(sortedIds.indexOf('asgn_2'));
      expect(sortedIds.indexOf('asgn_1')).toBeLessThan(sortedIds.indexOf('asgn_3'));
      expect(sortedIds.indexOf('asgn_2')).toBeLessThan(sortedIds.indexOf('asgn_4'));
      expect(sortedIds.indexOf('asgn_3')).toBeLessThan(sortedIds.indexOf('asgn_4'));
      expect(sortedIds.indexOf('asgn_4')).toBeLessThan(sortedIds.indexOf('asgn_5'));
    });
  });

  describe('resolveAssignmentStates', () => {
    it('correctly determines ready vs blocked states', () => {
      const resolved = resolveAssignmentStates(sampleProject);
      const asgn1 = resolved.find(a => a.id === 'asgn_1');
      const asgn2 = resolved.find(a => a.id === 'asgn_2');
      const asgn3 = resolved.find(a => a.id === 'asgn_3');
      const asgn4 = resolved.find(a => a.id === 'asgn_4');

      // asgn_1 is completed
      expect(asgn1.isCompleted).toBe(true);
      expect(asgn1.isBlocked).toBe(false);

      // asgn_2 & asgn_3 depend on asgn_1 (which is completed) -> so they are ready
      expect(asgn2.isReady).toBe(true);
      expect(asgn2.isBlocked).toBe(false);
      expect(asgn3.isReady).toBe(true);
      expect(asgn3.isBlocked).toBe(false);

      // asgn_4 depends on asgn_2 & asgn_3 (which are NOT completed) -> so asgn_4 is blocked
      expect(asgn4.isBlocked).toBe(true);
      expect(asgn4.isReady).toBe(false);
      expect(asgn4.status).toBe(ASSIGNMENT_STATUSES.BLOCKED);
      expect(asgn4.blockedBy.map(b => b.id)).toEqual(['asgn_2', 'asgn_3']);
    });
  });

  describe('computeCriticalPath', () => {
    it('computes longest duration path through project dependencies', () => {
      // Path 1: asgn_1 (60) -> asgn_2 (180) -> asgn_4 (240) -> asgn_5 (120) = 600 mins
      // Path 2: asgn_1 (60) -> asgn_3 (120) -> asgn_4 (240) -> asgn_5 (120) = 540 mins
      // Critical path is Path 1 with 600 mins
      const cp = computeCriticalPath(sampleProject);
      expect(cp.totalDurationMinutes).toBe(600);
      expect(cp.pathAssignmentIds).toEqual(['asgn_1', 'asgn_2', 'asgn_4', 'asgn_5']);
    });
  });

  describe('syncAssignmentWithTasks', () => {
    it('updates progress percentage and completes assignment when all linked tasks complete', () => {
      const assignment = {
        id: 'asgn_lab',
        title: 'Physics Lab Report',
        status: ASSIGNMENT_STATUSES.IN_PROGRESS,
        actualMinutes: 0
      };

      const partialTasks = [
        { id: 'task_1', title: 'Data tables', completed: true, actualDuration: 45 },
        { id: 'task_2', title: 'Error calculation', completed: false, actualDuration: 0 }
      ];

      const resPartial = syncAssignmentWithTasks(assignment, partialTasks);
      expect(resPartial.progressPercentage).toBe(50);
      expect(resPartial.allCompleted).toBe(false);
      expect(resPartial.assignment.status).toBe(ASSIGNMENT_STATUSES.IN_PROGRESS);
      expect(resPartial.assignment.actualMinutes).toBe(45);

      const allFinishedTasks = [
        { id: 'task_1', title: 'Data tables', completed: true, actualDuration: 45 },
        { id: 'task_2', title: 'Error calculation', completed: true, actualDuration: 30 }
      ];

      const resFinished = syncAssignmentWithTasks(assignment, allFinishedTasks);
      expect(resFinished.progressPercentage).toBe(100);
      expect(resFinished.allCompleted).toBe(true);
      expect(resFinished.assignment.status).toBe(ASSIGNMENT_STATUSES.COMPLETED);
      expect(resFinished.assignment.actualMinutes).toBe(75);
    });
  });
});


/**
 * shared/domain/academic/assignment-dependency.js
 * Directed Acyclic Graph (DAG) Engine for Academic Assignments in Planrova 2.0.
 *
 * Implements cycle detection, topological sorting, blocked/ready state resolution,
 * critical path analysis, and canonical Task store synchronization.
 * 100% platform-independent; zero external dependencies.
 */

import { ASSIGNMENT_STATUSES } from './assignment.schema.js';

/**
 * Validates assignment dependencies, detecting cycles and dangling references.
 */
export function validateAssignmentDAG(assignments = []) {
  const active = (assignments || []).filter(a => a && !a.deleted);
  const assignmentMap = new Map();
  const adjList = new Map();
  const errors = [];

  for (const a of active) {
    const id = String(a.id);
    assignmentMap.set(id, a);
    const deps = Array.isArray(a.dependencyIds) ? a.dependencyIds.map(String) : [];
    
    // Check self-dependency
    if (deps.includes(id)) {
      errors.push(`Assignment "${a.title || id}" cannot depend on itself.`);
    }

    adjList.set(id, deps);
  }

  // Check dangling references
  for (const [id, deps] of adjList.entries()) {
    for (const depId of deps) {
      if (!assignmentMap.has(depId)) {
        errors.push(`Assignment "${assignmentMap.get(id)?.title || id}" depends on non-existent assignment ID: "${depId}".`);
      }
    }
  }

  // 3-color DFS Cycle Detection (0 = white/unvisited, 1 = gray/visiting, 2 = black/visited)
  const color = new Map();
  const parent = new Map();
  let hasCycles = false;
  let cyclePath = null;

  for (const id of adjList.keys()) {
    color.set(id, 0);
  }

  function dfs(u) {
    color.set(u, 1);
    const neighbors = adjList.get(u) || [];

    for (const v of neighbors) {
      if (!assignmentMap.has(v)) continue;

      if (color.get(v) === 1) {
        // Cycle detected
        hasCycles = true;
        cyclePath = [u, v];
        errors.push(`Cyclic dependency detected involving assignments "${assignmentMap.get(u)?.title || u}" and "${assignmentMap.get(v)?.title || v}".`);
        return true;
      }

      if (color.get(v) === 0) {
        parent.set(v, u);
        if (dfs(v)) return true;
      }
    }

    color.set(u, 2);
    return false;
  }

  for (const id of adjList.keys()) {
    if (color.get(id) === 0) {
      if (dfs(id)) break;
    }
  }

  return {
    valid: errors.length === 0 && !hasCycles,
    hasCycles,
    cyclePath,
    errors
  };
}

/**
 * Topologically sorts assignments so prerequisites always precede dependents.
 * Returns sorted array of assignments.
 */
export function topologicalSortAssignments(assignments = [], { ignoreDangling = true } = {}) {
  const validation = validateAssignmentDAG(assignments);
  if (!validation.valid) {
    if (validation.hasCycles || !ignoreDangling) {
      throw new Error(`Cannot topologically sort cyclic or invalid assignment DAG: ${validation.errors.join('; ')}`);
    }
  }

  const active = (assignments || []).filter(a => a && !a.deleted);
  const assignmentMap = new Map();
  const inDegree = new Map();
  const dependentsMap = new Map(); // prereq -> dependents

  for (const a of active) {
    const id = String(a.id);
    assignmentMap.set(id, a);
    inDegree.set(id, 0);
    dependentsMap.set(id, []);
  }

  // Build in-degree counts and reverse adjacency (prereq -> dependent)
  for (const a of active) {
    const id = String(a.id);
    const deps = Array.isArray(a.dependencyIds) ? a.dependencyIds.map(String) : [];
    for (const depId of deps) {
      if (assignmentMap.has(depId)) {
        inDegree.set(id, inDegree.get(id) + 1);
        dependentsMap.get(depId).push(id);
      }
    }
  }

  // Kahn's Algorithm
  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  // Stable secondary sorting by due date or order in queue
  queue.sort((a, b) => {
    const dateA = assignmentMap.get(a)?.dueDate || '9999-99-99';
    const dateB = assignmentMap.get(b)?.dueDate || '9999-99-99';
    return dateA.localeCompare(dateB);
  });

  const sorted = [];

  while (queue.length > 0) {
    const u = queue.shift();
    sorted.push(assignmentMap.get(u));

    const dependents = dependentsMap.get(u) || [];
    for (const v of dependents) {
      inDegree.set(v, inDegree.get(v) - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  return sorted;
}

/**
 * Resolves blocked vs ready states for all assignments based on prerequisite completion.
 */
export function resolveAssignmentStates(assignments = []) {
  const active = (assignments || []).filter(a => a && !a.deleted);
  const assignmentMap = new Map();

  for (const a of active) {
    assignmentMap.set(String(a.id), a);
  }

  return active.map(a => {
    const id = String(a.id);
    const isCompleted = a.status === ASSIGNMENT_STATUSES.COMPLETED || Boolean(a.completed);
    const deps = Array.isArray(a.dependencyIds) ? a.dependencyIds.map(String) : [];

    const blockedBy = [];
    for (const depId of deps) {
      const prereq = assignmentMap.get(depId);
      if (prereq && prereq.status !== ASSIGNMENT_STATUSES.COMPLETED && !prereq.completed) {
        blockedBy.push({
          id: depId,
          title: prereq.title || depId,
          status: prereq.status
        });
      }
    }

    const isBlocked = !isCompleted && blockedBy.length > 0;
    const isReady = !isCompleted && blockedBy.length === 0;

    let computedStatus = a.status;
    if (!isCompleted) {
      computedStatus = isBlocked ? ASSIGNMENT_STATUSES.BLOCKED : (a.status === ASSIGNMENT_STATUSES.IN_PROGRESS ? ASSIGNMENT_STATUSES.IN_PROGRESS : ASSIGNMENT_STATUSES.NOT_STARTED);
    }

    return {
      ...a,
      status: computedStatus,
      isCompleted,
      isBlocked,
      isReady,
      blockedBy
    };
  });
}

/**
 * Computes Critical Path: the sequence of dependent assignments that represents
 * the longest estimated work duration to the final deliverable.
 */
export function computeCriticalPath(assignments = []) {
  const sorted = topologicalSortAssignments(assignments);
  const durationMap = new Map();
  const prevMap = new Map();

  for (const a of sorted) {
    const id = String(a.id);
    const est = typeof a.estimatedMinutes === 'number' && a.estimatedMinutes > 0 ? a.estimatedMinutes : 60;
    durationMap.set(id, est);
    prevMap.set(id, null);
  }

  // Dynamic programming over topologically sorted nodes
  for (const a of sorted) {
    const id = String(a.id);
    const currentDuration = durationMap.get(id);
    const deps = Array.isArray(a.dependencyIds) ? a.dependencyIds.map(String) : [];

    let maxPrereqDuration = 0;
    let bestPrereq = null;

    for (const depId of deps) {
      if (durationMap.has(depId)) {
        const d = durationMap.get(depId);
        if (d > maxPrereqDuration) {
          maxPrereqDuration = d;
          bestPrereq = depId;
        }
      }
    }

    if (bestPrereq) {
      durationMap.set(id, maxPrereqDuration + (a.estimatedMinutes || 60));
      prevMap.set(id, bestPrereq);
    }
  }

  // Find node with maximum cumulative duration
  let maxTotalDuration = 0;
  let endNodeId = null;

  for (const [id, dur] of durationMap.entries()) {
    if (dur > maxTotalDuration) {
      maxTotalDuration = dur;
      endNodeId = id;
    }
  }

  // Reconstruct path
  const path = [];
  let curr = endNodeId;
  const assignmentMap = new Map(sorted.map(a => [String(a.id), a]));

  while (curr) {
    path.unshift(assignmentMap.get(curr));
    curr = prevMap.get(curr);
  }

  return {
    totalDurationMinutes: maxTotalDuration,
    path,
    pathAssignmentIds: path.map(a => a.id)
  };
}

/**
 * Synchronizes an assignment with its linked canonical Task entities.
 * Bridges Academic Assignments with Planrova's Task domain.
 */
export function syncAssignmentWithTasks(assignment, linkedTasks = []) {
  if (!assignment) return null;

  const validTasks = (linkedTasks || []).filter(t => t && !t.deleted);
  const totalTasks = validTasks.length;

  if (totalTasks === 0) {
    return {
      assignment,
      tasksCount: 0,
      completedTasksCount: 0,
      progressPercentage: assignment.status === ASSIGNMENT_STATUSES.COMPLETED ? 100 : 0
    };
  }

  let completedCount = 0;
  let actualMinutes = 0;

  for (const t of validTasks) {
    const isCompleted = t.completed || t.status === 'completed';
    if (isCompleted) {
      completedCount++;
    }
    const duration = typeof t.actualDuration === 'number' ? t.actualDuration : (typeof t.duration === 'number' ? t.duration : 0);
    actualMinutes += duration;
  }

  const allCompleted = completedCount === totalTasks;
  const progressPercentage = Number(((completedCount / totalTasks) * 100).toFixed(1));

  const updatedStatus = allCompleted 
    ? ASSIGNMENT_STATUSES.COMPLETED 
    : (completedCount > 0 ? ASSIGNMENT_STATUSES.IN_PROGRESS : assignment.status);

  const updatedAssignment = {
    ...assignment,
    status: updatedStatus,
    actualMinutes,
    completedAt: allCompleted ? (assignment.completedAt || Date.now()) : null,
    updatedAt: Date.now()
  };

  return {
    assignment: updatedAssignment,
    tasksCount: totalTasks,
    completedTasksCount: completedCount,
    progressPercentage,
    allCompleted
  };
}


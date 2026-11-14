/**
 * scripts/benchmark-scheduling.js
 * Benchmarks the deterministic adaptive scheduling engine at 10, 50, 100, and 250 task scales.
 */

import { performance } from 'perf_hooks';
import { generateScheduleProposal } from '../shared/domain/scheduling/index.js';

function createMockTasks(count) {
  const priorities = ['urgent', 'high', 'medium', 'low'];
  const tasks = [];
  for (let i = 0; i < count; i++) {
    tasks.push({
      id: `task_bench_${i}`,
      title: `Benchmark Task ${i}`,
      estimatedMinutes: 30 + ((i * 15) % 90),
      priority: priorities[i % priorities.length],
      dueDate: '2026-11-20',
      deadlineTime: '18:00',
      allowSplit: i % 3 === 0,
      createdAt: 1000 + i
    });
  }
  return tasks;
}

const mockAvailability = {
  defaultWorkingHours: { start: '08:00', end: '19:00' },
  preferences: {
    focusHours: { start: '10:00', end: '12:00' },
    lunchBreak: { start: '13:00', end: '14:00', enabled: true },
    minSessionMinutes: 25,
    maxSessionMinutes: 120,
    allowTaskSplitting: true
  }
};

const mockFixedEvents = [
  { id: 'ev1', title: 'Daily Standup', startTime: '09:00', endTime: '09:30', isFixed: true },
  { id: 'ev2', title: 'Tech Architecture Sync', startTime: '14:00', endTime: '15:00', isFixed: true }
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('⚡ PLANROVA 2.0 — ADAPTIVE PLANNING ENGINE BENCHMARKS');
console.log('═══════════════════════════════════════════════════════════════');

const scales = [10, 50, 100, 250];
const results = [];

for (const scale of scales) {
  const tasks = createMockTasks(scale);
  const iterations = 50;
  
  // Warmup
  for (let w = 0; w < 5; w++) {
    generateScheduleProposal({
      targetDate: '2026-11-20',
      tasks,
      fixedEvents: mockFixedEvents,
      userAvailability: mockAvailability
    });
  }

  const start = performance.now();
  let lastProposal = null;
  for (let iter = 0; iter < iterations; iter++) {
    lastProposal = generateScheduleProposal({
      targetDate: '2026-11-20',
      tasks,
      fixedEvents: mockFixedEvents,
      userAvailability: mockAvailability
    });
  }
  const end = performance.now();
  const avgMs = (end - start) / iterations;

  const placedCount = lastProposal.proposedBlocks.filter(b => b.blockType === 'task').length;
  const unscheduledCount = lastProposal.unscheduledTasks.length;

  results.push({
    scale,
    avgMs: Number(avgMs.toFixed(3)),
    placedCount,
    unscheduledCount,
    utilization: Math.round(lastProposal.workload.capacityUtilization * 100)
  });

  console.log(`• Scale ${scale.toString().padEnd(3)} tasks: ${avgMs.toFixed(3).padStart(6)} ms / run | Placed: ${placedCount} | Unscheduled: ${unscheduledCount} | Util: ${Math.round(lastProposal.workload.capacityUtilization * 100)}%`);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('Benchmark completed successfully with zero unhandled exceptions.');


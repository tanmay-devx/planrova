/**
 * tests/academicStage9.test.js
 * Stage 9: Adaptive Planning Engine Integration Verification
 */

import { describe, it, expect } from 'vitest';
import {
  transformAcademicEntitiesToSchedulingInputs,
  generateAcademicScheduleProposal,
  ASSESSMENT_TYPES,
  TOPIC_MASTERY_LEVELS
} from '../shared/domain/academic/index.js';

describe('Academic Domain - Stage 9: Adaptive Planning Integration', () => {
  const targetDateStr = '2026-11-16'; // Monday

  const mockCourses = [
    { id: 'cs101', name: 'Algorithms', courseCode: 'CS 101' },
    { id: 'math201', name: 'Linear Algebra', courseCode: 'MATH 201' }
  ];

  const mockLectureSchedule = [
    // CS 101 lecture on Mondays 09:00 - 10:30
    { id: 'lec_cs', courseId: 'cs101', dayOfWeek: 'monday', startTime: '09:00', endTime: '10:30', room: 'Hall A' }
  ];

  const mockAssessments = [
    // Midterm on targetDateStr 14:00 - 16:00
    { id: 'exam_math', courseId: 'math201', title: 'Midterm', type: ASSESSMENT_TYPES.MIDTERM, examDate: targetDateStr, startTime: '14:00', durationMinutes: 120 }
  ];

  const mockTopics = [
    { id: 'top_1', courseId: 'cs101', title: 'Graph Theory', estimatedMinutes: 60, masteryLevel: TOPIC_MASTERY_LEVELS.LEARNING }
  ];

  const mockAssignments = [
    { id: 'asgn_1', courseId: 'cs101', title: 'Problem Set 5', estimatedMinutes: 90, priority: 'urgent', dueDate: targetDateStr }
  ];

  const mockFlashcards = [
    { id: 'c1', courseId: 'cs101', box: 1, nextReviewDate: targetDateStr }
  ];

  const userAvailability = {
    defaultWorkingHours: { start: '08:00', end: '20:00' },
    weekdayRules: {
      1: { active: true, start: '08:00', end: '20:00' }
    }
  };

  describe('transformAcademicEntitiesToSchedulingInputs', () => {
    it('maps lectures and exams with buffers to fixed events, and assignments/topics/flashcards to flexible tasks', () => {
      const inputs = transformAcademicEntitiesToSchedulingInputs({
        targetDateStr,
        courses: mockCourses,
        topics: mockTopics,
        assignments: mockAssignments,
        assessments: mockAssessments,
        flashcards: mockFlashcards,
        lectureSchedule: mockLectureSchedule,
        examBufferMinutes: 30
      });

      expect(inputs.targetDate).toBe(targetDateStr);

      // Fixed events:
      // 1. CS 101 Lecture (09:00 - 10:30)
      // 2. Exam (14:00 - 16:00)
      // 3. Pre-Exam Buffer (13:30 - 14:00)
      expect(inputs.fixedEvents).toHaveLength(3);
      const lec = inputs.fixedEvents.find(e => e.type === 'lecture');
      expect(lec).toBeDefined();
      expect(lec.startTime).toBe('09:00');
      expect(lec.endTime).toBe('10:30');

      const exam = inputs.fixedEvents.find(e => e.type === 'examination');
      expect(exam).toBeDefined();
      expect(exam.startTime).toBe('14:00');
      expect(exam.endTime).toBe('16:00');

      const buf = inputs.fixedEvents.find(e => e.type === 'buffer');
      expect(buf).toBeDefined();
      expect(buf.startTime).toBe('13:30');
      expect(buf.endTime).toBe('14:00');

      // Flexible tasks:
      // 1. Assignment (Problem Set 5, 90 mins)
      // 2. Syllabus study task (Graph Theory, 60 mins)
      // 3. Spaced repetition review task
      expect(inputs.flexibleTasks.length).toBeGreaterThanOrEqual(3);
      const asgnTask = inputs.flexibleTasks.find(t => t.id === 'asgn_1');
      expect(asgnTask).toBeDefined();
      expect(asgnTask.durationMinutes).toBe(90);

      const studyTask = inputs.flexibleTasks.find(t => t.metadata?.academicType === 'syllabus_topic');
      expect(studyTask).toBeDefined();
      expect(studyTask.durationMinutes).toBe(60);

      const srTask = inputs.flexibleTasks.find(t => t.metadata?.academicType === 'flashcards');
      expect(srTask).toBeDefined();
    });
  });

  describe('generateAcademicScheduleProposal (Phase 3 Integration)', () => {
    it('seamlessly calls Phase 3 Adaptive Scheduling Engine and produces a valid proposal', () => {
      const proposal = generateAcademicScheduleProposal({
        targetDateStr,
        userAvailability,
        courses: mockCourses,
        topics: mockTopics,
        assignments: mockAssignments,
        assessments: mockAssessments,
        flashcards: mockFlashcards,
        lectureSchedule: mockLectureSchedule
      });

      expect(proposal).toBeDefined();
      expect(proposal.id).toBeDefined();
      expect(proposal.targetDate).toBe(targetDateStr);
      expect(['draft', 'proposed']).toContain(proposal.status);

      // Proposal must contain scheduled blocks that fit around the lecture (09:00 - 10:30) and exam buffer/exam (13:30 - 16:00)
      expect(proposal.proposedBlocks.length).toBeGreaterThan(0);

      // Verify fixed commitments exist in the proposal
      const lectureBlock = proposal.proposedBlocks.find(b => b.startTime === '09:00' && b.endTime === '10:30');
      expect(lectureBlock).toBeDefined();
      expect(lectureBlock.isFixed).toBe(true);

      const examBlock = proposal.proposedBlocks.find(b => b.startTime === '14:00' && b.endTime === '16:00');
      expect(examBlock).toBeDefined();
      expect(examBlock.isFixed).toBe(true);

      // Verify flexible task blocks do NOT collide with lecture or exam/buffer
      const flexibleBlocks = proposal.proposedBlocks.filter(b => !b.isFixed);
      expect(flexibleBlocks.length).toBeGreaterThan(0);

      for (const block of flexibleBlocks) {
        // Assert no task blocks collide with lecture 09:00 - 10:30
        const isDuringLecture = (block.startTime < '10:30' && block.endTime > '09:00');
        expect(isDuringLecture).toBe(false);

        // Assert no task blocks collide with exam + buffer 13:30 - 16:00
        const isDuringExam = (block.startTime < '16:00' && block.endTime > '13:30');
        expect(isDuringExam).toBe(false);
      }

      // Workload analysis is populated
      expect(proposal.workload).toBeDefined();
      expect(proposal.workload.capacityUtilization).toBeTypeOf('number');
      expect(proposal.workload.classification).toBeDefined();
    });
  });
});

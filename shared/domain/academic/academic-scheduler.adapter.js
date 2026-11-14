/**
 * shared/domain/academic/academic-scheduler.adapter.js
 * Adaptive Scheduling Adapter for Planrova 2.0 Academic Workspaces.
 *
 * Bridges the Academic Domain with Phase 3's Deterministic Adaptive Scheduling Engine.
 * Converts academic commitments, exams, syllabus study sessions, assignments,
 * and flashcard review queues into canonical scheduling inputs.
 *
 * 100% platform-independent; zero external dependencies.
 */

import { generateScheduleProposal } from '../scheduling/scheduling.engine.js';
import { getNextRecommendedTopics } from './syllabus.engine.js';
import { getDueFlashcards } from './academic.utils.js';
import { ASSESSMENT_TYPES } from './academic.types.js';

/**
 * Transforms Academic entities into canonical inputs for the Phase 3 Scheduling Engine.
 */
export function transformAcademicEntitiesToSchedulingInputs({
  targetDateStr = new Date().toISOString().slice(0, 10),
  courses = [],
  topics = [],
  assignments = [],
  assessments = [],
  flashcards = [],
  lectureSchedule = [], // array of { courseId, title, dayOfWeek (0-6 or string), startTime, endTime, room }
  existingTasks = [],
  includeSyllabusStudy = true,
  includeFlashcardReviews = true,
  maxRecommendedTopics = 2,
  examBufferMinutes = 30
} = {}) {
  const targetDayOfWeek = new Date(`${targetDateStr}T00:00:00Z`).getUTCDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDayName = dayNames[targetDayOfWeek];

  const courseMap = new Map((courses || []).map(c => [String(c.id), c]));
  const fixedEvents = [];
  const flexibleTasks = [...(existingTasks || [])];

  // 1. Map Lecture Schedule for target date into Fixed Commitments
  for (const lec of lectureSchedule || []) {
    let matchesDay = false;
    if (typeof lec.dayOfWeek === 'number') {
      matchesDay = lec.dayOfWeek === targetDayOfWeek;
    } else if (typeof lec.dayOfWeek === 'string') {
      matchesDay = lec.dayOfWeek.toLowerCase() === targetDayName;
    } else if (lec.date) {
      matchesDay = lec.date === targetDateStr;
    }

    if (matchesDay && lec.startTime && lec.endTime) {
      const course = courseMap.get(String(lec.courseId));
      const courseName = course ? (course.name || course.title) : 'Class';
      fixedEvents.push({
        id: lec.id || `lec_${lec.courseId}_${lec.startTime}`,
        title: lec.title || `${courseName} Lecture`,
        date: targetDateStr,
        startTime: lec.startTime,
        endTime: lec.endTime,
        isFixed: true,
        type: 'lecture',
        courseId: lec.courseId,
        room: lec.room || null
      });
    }
  }

  // 2. Map Target-Date Exams into Fixed Commitments (+ Pre-Exam Buffer)
  const targetExams = (assessments || []).filter(a => {
    if (!a || a.deleted || a.status === 'graded' || a.status === 'excused') return false;
    const date = a.examDate || a.dueDate;
    return date === targetDateStr;
  });

  for (const exam of targetExams) {
    const startTime = exam.startTime || '10:00';
    const durationMin = typeof exam.durationMinutes === 'number' && exam.durationMinutes > 0 ? exam.durationMinutes : 120;
    
    // Compute endTime
    const [sH, sM] = startTime.split(':').map(Number);
    const endTotalMin = sH * 60 + sM + durationMin;
    const endH = String(Math.floor(endTotalMin / 60)).padStart(2, '0');
    const endM = String(endTotalMin % 60).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    const course = courseMap.get(String(exam.courseId));
    const courseName = course ? (course.name || course.title) : 'Course';

    // Add Exam Block
    fixedEvents.push({
      id: `exam_${exam.id}`,
      title: `${courseName}: ${exam.title}`,
      date: targetDateStr,
      startTime,
      endTime,
      isFixed: true,
      type: 'examination',
      courseId: exam.courseId
    });

    // Add Pre-Exam Buffer if requested
    if (examBufferMinutes > 0) {
      const bufTotalMin = sH * 60 + sM - examBufferMinutes;
      if (bufTotalMin >= 0) {
        const bufH = String(Math.floor(bufTotalMin / 60)).padStart(2, '0');
        const bufM = String(bufTotalMin % 60).padStart(2, '0');
        const bufStartTime = `${bufH}:${bufM}`;
        fixedEvents.push({
          id: `buf_pre_${exam.id}`,
          title: `Exam Prep: ${exam.title}`,
          date: targetDateStr,
          startTime: bufStartTime,
          endTime: startTime,
          isFixed: true,
          type: 'buffer',
          courseId: exam.courseId
        });
      }
    }
  }

  // 3. Map Academic Assignments into Flexible Tasks
  const activeAssignments = (assignments || []).filter(a => {
    if (!a || a.deleted) return false;
    if (a.status === 'completed' || Boolean(a.completed)) return false;
    return true;
  });

  for (const asgn of activeAssignments) {
    const course = courseMap.get(String(asgn.courseId));
    const courseName = course ? (course.name || course.title) : 'Course';
    const duration = typeof asgn.estimatedMinutes === 'number' && asgn.estimatedMinutes > 0 ? asgn.estimatedMinutes : 60;

    flexibleTasks.push({
      id: asgn.id,
      title: `Assignment: ${asgn.title} (${courseName})`,
      duration,
      durationMinutes: duration,
      estimatedMinutes: duration,
      dueDate: asgn.dueDate || null,
      priority: asgn.priority || 'high',
      dependencyIds: asgn.dependencyIds || [],
      metadata: {
        academicType: 'assignment',
        assignmentId: asgn.id,
        courseId: asgn.courseId
      }
    });
  }

  // 4. Map Next Recommended Syllabus Topics into Flexible Study Tasks
  if (includeSyllabusStudy) {
    const recommendedTopics = getNextRecommendedTopics({
      topics,
      maxCount: maxRecommendedTopics,
      leafOnly: true
    });

    for (const topic of recommendedTopics) {
      const course = courseMap.get(String(topic.courseId));
      const courseName = course ? (course.name || course.title) : 'Course';
      const duration = typeof topic.estimatedMinutes === 'number' && topic.estimatedMinutes > 0 ? topic.estimatedMinutes : 45;

      flexibleTasks.push({
        id: `study_topic_${topic.id}`,
        title: `Study: ${topic.title} (${courseName})`,
        duration,
        durationMinutes: duration,
        estimatedMinutes: duration,
        priority: 'medium',
        metadata: {
          academicType: 'syllabus_topic',
          topicId: topic.id,
          courseId: topic.courseId
        }
      });
    }
  }

  // 5. Map Due Flashcards into Spaced Repetition Review Task
  if (includeFlashcardReviews) {
    const dueCards = getDueFlashcards(flashcards, targetDateStr);
    if (dueCards.length > 0) {
      const estMinutes = Math.min(30, Math.max(15, Math.ceil((dueCards.length * 30) / 60)));
      flexibleTasks.push({
        id: `sr_review_${targetDateStr}`,
        title: `Spaced Repetition: Review ${dueCards.length} Flashcard(s)`,
        duration: estMinutes,
        durationMinutes: estMinutes,
        estimatedMinutes: estMinutes,
        priority: 'high',
        metadata: {
          academicType: 'flashcards',
          cardCount: dueCards.length
        }
      });
    }
  }

  return {
    targetDate: targetDateStr,
    fixedEvents,
    flexibleTasks
  };
}

/**
 * High-level scheduler coordinator:
 * Generates an adaptive schedule proposal for an academic day using Phase 3's engine.
 */
export function generateAcademicScheduleProposal({
  targetDateStr = new Date().toISOString().slice(0, 10),
  userAvailability = {},
  courses = [],
  topics = [],
  assignments = [],
  assessments = [],
  flashcards = [],
  lectureSchedule = [],
  existingTasks = [],
  acceptedBlocks = [],
  lockedBlocks = [],
  preferences = {},
  examBufferMinutes = 30
} = {}) {
  // 1. Convert academic entities to scheduling inputs
  const inputs = transformAcademicEntitiesToSchedulingInputs({
    targetDateStr,
    courses,
    topics,
    assignments,
    assessments,
    flashcards,
    lectureSchedule,
    existingTasks,
    examBufferMinutes
  });

  // 2. Delegate to Phase 3 Adaptive Scheduling Engine
  return generateScheduleProposal({
    targetDate: targetDateStr,
    tasks: inputs.flexibleTasks,
    fixedEvents: inputs.fixedEvents,
    userAvailability,
    acceptedBlocks,
    lockedBlocks,
    preferences
  });
}

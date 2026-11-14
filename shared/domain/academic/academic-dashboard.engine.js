/**
 * shared/domain/academic/academic-dashboard.engine.js
 * Unified Academic Intelligence Dashboard Engine for Planrova 2.0.
 *
 * Aggregates cross-course standings, urgent deliverables, upcoming exams,
 * spaced repetition review queues, and evidence-based weak topics.
 * 100% platform-independent; zero external dependencies.
 */

import { computeSemesterSummary } from './course.engine.js';
import { getDueFlashcards } from './academic.utils.js';
import { ASSESSMENT_TYPES, TOPIC_MASTERY_LEVELS } from './academic.types.js';

/**
 * Computes complete high-level academic intelligence dashboard.
 */
export function computeAcademicDashboard({
  semester,
  courses = [],
  topics = [],
  assessments = [],
  assignments = [],
  flashcards = [],
  referenceDateStr = new Date().toISOString().slice(0, 10)
} = {}) {
  // 1. Semester & Course Workspaces Summary
  const semesterSummary = computeSemesterSummary({
    semester,
    courses,
    topics,
    assessments,
    assignments,
    referenceDateStr
  });

  // 2. Urgent Deliverables (overdue or due within 48 hours / 2 days)
  const refDate = new Date(referenceDateStr);
  const twoDaysLater = new Date(refDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const activeAssignments = (assignments || []).filter(a => a && !a.deleted && a.status !== 'completed' && !a.completed);
  const urgentDeliverables = activeAssignments.filter(a => {
    if (!a.dueDate) return false;
    return a.dueDate <= twoDaysLater;
  }).sort((a, b) => {
    if (a.dueDate !== b.dueDate) return (a.dueDate || '').localeCompare(b.dueDate || '');
    const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };
    return (priorityWeights[b.priority] || 2) - (priorityWeights[a.priority] || 2);
  }).map(a => {
    const isOverdue = a.dueDate < referenceDateStr;
    return {
      ...a,
      isOverdue
    };
  });

  // 3. Upcoming Exams with Days Remaining countdown
  const examTypes = [ASSESSMENT_TYPES.MIDTERM, ASSESSMENT_TYPES.FINAL, ASSESSMENT_TYPES.QUIZ, ASSESSMENT_TYPES.PRACTICAL];
  const upcomingExams = (assessments || [])
    .filter(a => a && !a.deleted && a.status !== 'graded' && a.status !== 'excused')
    .filter(a => examTypes.includes(a.type) || Boolean(a.examDate))
    .filter(a => {
      const date = a.examDate || a.dueDate;
      return date && date >= referenceDateStr;
    })
    .map(a => {
      const date = a.examDate || a.dueDate;
      const targetTime = new Date(`${date}T00:00:00Z`).getTime();
      const currTime = new Date(`${referenceDateStr}T00:00:00Z`).getTime();
      const daysRemaining = Math.max(0, Math.round((targetTime - currTime) / (24 * 60 * 60 * 1000)));

      const course = (courses || []).find(c => String(c.id) === String(a.courseId));
      return {
        ...a,
        courseName: course ? (course.name || course.title) : 'Course',
        courseCode: course ? (course.courseCode || course.code) : '',
        daysRemaining
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  // 4. Spaced Repetition Flashcards Summary
  const activeFlashcards = (flashcards || []).filter(f => f && !f.deleted);
  const dueFlashcards = getDueFlashcards(activeFlashcards, referenceDateStr);
  
  const dueByCourse = {};
  for (const card of dueFlashcards) {
    const cId = card.courseId || 'general';
    dueByCourse[cId] = (dueByCourse[cId] || 0) + 1;
  }

  const flashcardsSummary = {
    totalDue: dueFlashcards.length,
    totalCards: activeFlashcards.length,
    dueByCourse,
    estimatedMinutes: Math.ceil((dueFlashcards.length * 30) / 60)
  };

  // 5. Evidence-based Weak Topics Detection
  // Detect topics where:
  // (a) Linked flashcards have high struggle rate (e.g. box 1 with multiple reviews), or
  // (b) Topic is unstarted/learning and an exam in this course is within 7 days
  const weakTopics = [];
  const topicMap = new Map((topics || []).map(t => [String(t.id), t]));

  // Check flashcard struggle
  const box1CardsByTopic = new Map();
  for (const f of activeFlashcards) {
    if (f.topicId && f.box === 1 && (f.reviewCount || 0) >= 2) {
      const count = box1CardsByTopic.get(String(f.topicId)) || 0;
      box1CardsByTopic.set(String(f.topicId), count + 1);
    }
  }

  for (const [topicId, count] of box1CardsByTopic.entries()) {
    const topic = topicMap.get(topicId);
    if (topic && !topic.deleted) {
      const course = (courses || []).find(c => String(c.id) === String(topic.courseId));
      weakTopics.push({
        topicId: topic.id,
        topicTitle: topic.title,
        courseId: topic.courseId,
        courseName: course ? (course.name || course.title) : '',
        reason: `${count} flashcard(s) repeatedly failing in Box 1`,
        severity: 'high'
      });
    }
  }

  // Check imminent exams with unmastered topics
  for (const exam of upcomingExams) {
    if (exam.daysRemaining <= 7) {
      const courseTopics = (topics || []).filter(t => 
        t && !t.deleted && 
        String(t.courseId) === String(exam.courseId) && 
        t.masteryLevel !== TOPIC_MASTERY_LEVELS.MASTERED && 
        !t.completed
      );

      for (const t of courseTopics) {
        // avoid duplicate entry if already listed via flashcards
        if (!weakTopics.some(w => String(w.topicId) === String(t.id))) {
          weakTopics.push({
            topicId: t.id,
            topicTitle: t.title,
            courseId: t.courseId,
            courseName: exam.courseName,
            reason: `Upcoming ${exam.title} in ${exam.daysRemaining} day(s); topic is ${t.masteryLevel}`,
            severity: exam.daysRemaining <= 3 ? 'urgent' : 'medium'
          });
        }
      }
    }
  }

  return {
    semesterSummary,
    courseCards: semesterSummary.courseMetrics,
    urgentDeliverables,
    urgentDeliverablesCount: urgentDeliverables.length,
    upcomingExams,
    upcomingExamsCount: upcomingExams.length,
    flashcardsSummary,
    weakTopics,
    weakTopicsCount: weakTopics.length,
    totalWorkloadMinutes: semesterSummary.totalEstimatedWorkMinutes + flashcardsSummary.estimatedMinutes
  };
}


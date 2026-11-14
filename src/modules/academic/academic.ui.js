/**
 * src/modules/academic/academic.ui.js
 * Master Academic Workspace UI Controller for Planrova 2.0 Web Application.
 */

import {
  computeAcademicDashboard,
  computeCourseMetrics,
  buildCourseSyllabusTree,
  updateTopicMastery,
  TOPIC_MASTERY_LEVELS,
  COURSE_STATUSES,
  SEMESTER_STATUSES,
  ASSESSMENT_TYPES
} from '../../../shared/domain/academic/index.js';

import {
  getSemesters,
  saveSemester,
  getActiveSemester,
  getCourses,
  saveCourse,
  deleteCourse,
  getSyllabusTopics,
  saveTopic,
  saveSyllabusTopics,
  getAssessments,
  saveAssessment,
  getAssignments,
  saveAssignment,
  getFlashcards,
  saveFlashcard
} from './academic-storage.js';

import { openGpaSimulatorModal } from './gpa.ui.js';
import { openFlashcardReviewPlayer } from './flashcard.ui.js';

export function initAcademicWorkspace() {
  const container = document.getElementById('academic-workspace-view');
  if (!container) return;

  renderAcademicWorkspace();
}

export function renderAcademicWorkspace() {
  const container = document.getElementById('academic-workspace-view');
  if (!container) return;

  const semesters = getSemesters();
  let activeSemester = getActiveSemester();

  // If no semesters exist, seed a clean default one
  if (!activeSemester && semesters.length === 0) {
    activeSemester = saveSemester({
      name: 'Fall 2026',
      status: SEMESTER_STATUSES.ACTIVE,
      targetSGPA: 3.8
    });
  }

  const courses = getCourses();
  const topics = getSyllabusTopics();
  const assessments = getAssessments();
  const assignments = getAssignments();
  const flashcards = getFlashcards();
  const todayStr = new Date().toISOString().slice(0, 10);

  const dashboard = computeAcademicDashboard({
    semester: activeSemester,
    courses,
    topics,
    assessments,
    assignments,
    flashcards,
    referenceDateStr: todayStr
  });

  const semSummary = dashboard.semesterSummary;

  container.innerHTML = `
    <div style="padding: 24px 32px; max-width: 1280px; margin: 0 auto; color: #fff;">
      <!-- TOP ACTION BAR -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap: 16px;">
        <div>
          <div style="display:flex; align-items:center; gap: 12px;">
            <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #C2A878;">Academic Workspace</h1>
            <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; padding: 4px 10px; border-radius: 20px; background: rgba(194, 168, 120, 0.15); color: #C2A878; border: 1px solid rgba(194, 168, 120, 0.3);">
              ${activeSemester ? activeSemester.name : 'No Semester'}
            </span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary, #a8a29e); margin: 4px 0 0 0;">
            Unified curriculum intelligence, weighted grading, syllabus tracking & spaced repetition
          </p>
        </div>

        <div style="display:flex; align-items:center; gap: 10px; flex-wrap:wrap;">
          <button id="academic-gpa-sim-btn" class="btn-secondary" style="padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.12); cursor:pointer;">
            🎯 GPA Simulator
          </button>
          <button id="academic-review-cards-btn" class="btn-secondary" style="padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); cursor:pointer;">
            🗂️ Review Due Cards (${dashboard.flashcardsSummary.totalDue})
          </button>
          <button id="academic-add-course-btn" class="btn-primary" style="padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; background: #C2A878; color: #000; border: none; cursor:pointer;">
            + Add Course
          </button>
        </div>
      </div>

      <!-- KEY METRICS ROW -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 28px;">
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700;">Current SGPA</div>
          <div style="font-size: 28px; font-weight: 800; color: #C2A878; margin-top: 4px;">
            ${semSummary.currentSGPA > 0 ? semSummary.currentSGPA.toFixed(2) : '—'}
          </div>
          <div style="font-size: 11px; color: #a8a29e; margin-top: 4px;">Target: ${semSummary.targetSGPA ? semSummary.targetSGPA.toFixed(2) : 'Not set'}</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700;">Credit Load</div>
          <div style="font-size: 28px; font-weight: 800; color: #fff; margin-top: 4px;">
            ${semSummary.totalCredits} <span style="font-size: 13px; font-weight: 500; color: #a8a29e;">Credits</span>
          </div>
          <div style="font-size: 11px; color: #a8a29e; margin-top: 4px;">Across ${semSummary.courseCount} enrolled course(s)</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700;">Syllabus Progress</div>
          <div style="font-size: 28px; font-weight: 800; color: #3b82f6; margin-top: 4px;">
            ${semSummary.overallSyllabusPercentage}%
          </div>
          <div style="font-size: 11px; color: #a8a29e; margin-top: 4px;">Credit-weighted completion</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700;">Pending Deliverables</div>
          <div style="font-size: 28px; font-weight: 800; color: ${semSummary.totalOverdueAssignments > 0 ? '#ef4444' : '#10b981'}; margin-top: 4px;">
            ${semSummary.totalPendingAssignments}
          </div>
          <div style="font-size: 11px; color: ${semSummary.totalOverdueAssignments > 0 ? '#ef4444' : '#a8a29e'}; margin-top: 4px;">
            ${semSummary.totalOverdueAssignments} overdue assignments
          </div>
        </div>
      </div>

      <!-- INTELLIGENCE BANNER: URGENT & WEAK TOPICS -->
      ${(dashboard.urgentDeliverables.length > 0 || dashboard.weakTopics.length > 0 || dashboard.upcomingExams.length > 0) ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 28px;">
          <!-- Upcoming Exams Countdown -->
          ${dashboard.upcomingExams.length > 0 ? `
            <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 16px; padding: 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
                <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #f59e0b; letter-spacing: 0.05em;">⏳ Imminent Examinations</span>
                <span style="font-size: 11px; color: #a8a29e;">${dashboard.upcomingExams.length} upcoming</span>
              </div>
              <div style="display:flex; flex-direction:column; gap: 10px;">
                ${dashboard.upcomingExams.slice(0, 3).map(exam => `
                  <div style="display:flex; justify-content:space-between; align-items:center; background: rgba(0,0,0,0.2); padding: 10px 14px; border-radius: 10px;">
                    <div>
                      <div style="font-weight: 700; font-size: 13px;">${exam.title}</div>
                      <div style="font-size: 11px; color: #a8a29e;">${exam.courseName} (${exam.courseCode})</div>
                    </div>
                    <div style="text-align:right;">
                      <span style="font-size: 14px; font-weight: 800; color: ${exam.daysRemaining <= 3 ? '#ef4444' : '#f59e0b'};">
                        ${exam.daysRemaining === 0 ? 'Today!' : `${exam.daysRemaining}d left`}
                      </span>
                      <div style="font-size: 10px; color: #a8a29e;">${exam.examDate || exam.dueDate}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Evidence-based Weak Topics -->
          ${dashboard.weakTopics.length > 0 ? `
            <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 16px; padding: 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
                <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #ef4444; letter-spacing: 0.05em;">⚠️ Focus Needed (Weak Topics)</span>
                <span style="font-size: 11px; color: #a8a29e;">${dashboard.weakTopics.length} detected</span>
              </div>
              <div style="display:flex; flex-direction:column; gap: 10px;">
                ${dashboard.weakTopics.slice(0, 3).map(wt => `
                  <div style="background: rgba(0,0,0,0.2); padding: 10px 14px; border-radius: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <div style="font-weight: 700; font-size: 13px;">${wt.topicTitle}</div>
                      <span style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: rgba(239, 68, 68, 0.2); color: #ef4444;">${wt.severity}</span>
                    </div>
                    <div style="font-size: 11px; color: #f87171; margin-top: 2px;">${wt.reason}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- ENROLLED COURSES SECTION -->
      <div style="margin-top: 12px;">
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 18px; color: #fff;">Enrolled Courses (${courses.length})</h2>

        ${courses.length === 0 ? `
          <div style="text-align:center; padding: 60px 20px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 20px;">
            <div style="font-size: 36px; margin-bottom: 12px;">📚</div>
            <h3 style="font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 6px 0;">No courses added yet</h3>
            <p style="font-size: 13px; color: #a8a29e; margin: 0 0 20px 0;">Create your first course workspace to track syllabus progress, assignments, and grades.</p>
            <button id="empty-add-course-btn" class="btn-primary" style="padding: 10px 20px; border-radius: 10px; font-weight: 700; background: #C2A878; color: #000; border:none; cursor:pointer;">
              + Create First Course
            </button>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px;">
            ${courses.map(course => renderCourseCard(course, topics, assessments, assignments)).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Bind global buttons
  container.querySelector('#academic-gpa-sim-btn')?.addEventListener('click', () => {
    openGpaSimulatorModal({
      currentCGPA: semSummary.currentSGPA || 3.2,
      completedCredits: 45,
      upcomingCredits: semSummary.totalCredits || 15,
      targetCGPA: semSummary.targetSGPA || 3.8,
      onSaveTarget: (reqSGPA, tgtCGPA) => {
        if (activeSemester) {
          saveSemester({ ...activeSemester, targetSGPA: tgtCGPA });
          renderAcademicWorkspace();
        }
      }
    });
  });

  container.querySelector('#academic-review-cards-btn')?.addEventListener('click', () => {
    const due = dashboard.flashcardsSummary.totalDue > 0
      ? flashcards.filter(f => f && !f.deleted)
      : flashcards;
    openFlashcardReviewPlayer({
      flashcards: due,
      deckTitle: 'Daily Leitner Review',
      onFinish: () => renderAcademicWorkspace()
    });
  });

  const triggerAddCourse = () => openCourseModal({
    semesterId: activeSemester ? activeSemester.id : null,
    onSave: () => renderAcademicWorkspace()
  });

  container.querySelector('#academic-add-course-btn')?.addEventListener('click', triggerAddCourse);
  container.querySelector('#empty-add-course-btn')?.addEventListener('click', triggerAddCourse);

  // Bind Course Card Action Toggles
  container.querySelectorAll('.course-card-wrap').forEach(cardEl => {
    const courseId = cardEl.getAttribute('data-course-id');

    cardEl.querySelector('.btn-add-topic')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openTopicModal(courseId, () => renderAcademicWorkspace());
    });

    cardEl.querySelector('.btn-add-assessment')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openAssessmentModal(courseId, () => renderAcademicWorkspace());
    });

    cardEl.querySelectorAll('.topic-check-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const topicId = btn.getAttribute('data-topic-id');
        const currentCompleted = btn.getAttribute('data-completed') === 'true';
        const allTopics = getSyllabusTopics();
        const updated = updateTopicMastery(
          allTopics,
          topicId,
          currentCompleted ? TOPIC_MASTERY_LEVELS.UNSTARTED : TOPIC_MASTERY_LEVELS.MASTERED
        );
        saveSyllabusTopics(updated);
        renderAcademicWorkspace();
      });
    });
  });
}

function renderCourseCard(course, topics, assessments, assignments) {
  const metrics = computeCourseMetrics({
    course,
    topics,
    assessments,
    assignments
  });

  const courseTopics = (topics || []).filter(t => t && !t.deleted && String(t.courseId) === String(course.id));
  const syllabusTree = buildCourseSyllabusTree(courseTopics);

  return `
    <div class="course-card-wrap" data-course-id="${course.id}" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 22px; display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden;">
      <div style="position:absolute; top:0; left:0; right:0; height:4px; background: ${course.color || '#C2A878'};"></div>

      <!-- Course Header -->
      <div style="margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: ${course.color || '#C2A878'}; text-transform:uppercase; letter-spacing:0.05em;">
              ${course.courseCode || 'COURSE'} • ${course.credits} Credits
            </span>
            <h3 style="font-size: 17px; font-weight: 700; color: #fff; margin: 4px 0 0 0;">
              ${course.name || course.title}
            </h3>
          </div>
          <div style="text-align:right;">
            <div style="font-size: 20px; font-weight: 800; color: #C2A878;">
              ${metrics.currentLetter}
            </div>
            <div style="font-size: 11px; color: #a8a29e;">
              ${metrics.currentScorePercent !== null ? `${metrics.currentScorePercent}%` : 'No grades'}
            </div>
          </div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div style="margin-bottom: 18px;">
        <div style="display:flex; justify-content:space-between; font-size: 11px; color: #a8a29e; margin-bottom: 6px;">
          <span>Syllabus Mastered</span>
          <span style="font-weight: 700; color: #fff;">${metrics.syllabusCompletionPercentage}% (${metrics.masteredTopics}/${metrics.totalTopics})</span>
        </div>
        <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow:hidden;">
          <div style="width: ${metrics.syllabusCompletionPercentage}%; height: 100%; background: ${course.color || '#C2A878'}; border-radius: 4px;"></div>
        </div>
      </div>

      <!-- Syllabus Preview Section -->
      <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 12px; margin-bottom: 18px; max-height: 160px; overflow-y: auto;">
        <div style="font-size: 11px; text-transform:uppercase; font-weight:700; color: #a8a29e; margin-bottom: 8px;">Syllabus Topics</div>
        ${courseTopics.length === 0 ? `
          <div style="font-size: 11px; color: #78716c; font-style:italic;">No syllabus topics added yet.</div>
        ` : `
          <div style="display:flex; flex-direction:column; gap: 6px;">
            ${courseTopics.slice(0, 5).map(t => `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size: 12px;">
                <div style="display:flex; align-items:center; gap: 6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  <button class="topic-check-btn" data-topic-id="${t.id}" data-completed="${Boolean(t.completed)}" style="background:none; border:none; cursor:pointer; font-size:12px; padding:0;">
                    ${t.completed ? '✅' : '⚪'}
                  </button>
                  <span style="color: ${t.completed ? '#a8a29e' : '#fff'}; ${t.completed ? 'text-decoration: line-through;' : ''}">${t.title}</span>
                </div>
                <span style="font-size: 10px; color: #a8a29e;">${t.estimatedMinutes || 45}m</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Footer Action Buttons -->
      <div style="display:flex; justify-content:space-between; align-items:center; pt: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
        <button class="btn-add-topic" style="background:none; border:none; color:#C2A878; font-size: 12px; font-weight: 700; cursor:pointer;">
          + Add Topic
        </button>
        <button class="btn-add-assessment" style="background:none; border:none; color:#a8a29e; font-size: 12px; font-weight: 600; cursor:pointer;">
          + Assessment
        </button>
      </div>
    </div>
  `;
}

// ── Modals for Adding Entities ──────────────────────────────────────────

function openCourseModal({ semesterId, onSave }) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'z-index: 2500; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; position: fixed; inset: 0;';

  modal.innerHTML = `
    <div style="background: #181512; border: 1px solid rgba(194,168,120,0.25); border-radius: 20px; width: 90%; max-width: 460px; padding: 26px; color: #fff;">
      <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 16px 0; color: #C2A878;">Add New Course Workspace</h2>
      
      <div style="margin-bottom: 14px;">
        <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Course Name</label>
        <input type="text" id="course-name-input" placeholder="e.g. Data Structures and Algorithms" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px;">
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <div>
          <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Course Code</label>
          <input type="text" id="course-code-input" placeholder="e.g. CS 201" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px;">
        </div>
        <div>
          <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Credits</label>
          <input type="number" id="course-credits-input" value="3" min="0" max="12" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px;">
        </div>
      </div>

      <div style="margin-bottom: 22px;">
        <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Color Theme</label>
        <input type="color" id="course-color-input" value="#C2A878" style="width: 100%; height: 38px; border-radius: 8px; border:none; background:transparent; cursor:pointer;">
      </div>

      <div style="display:flex; justify-content:flex-end; gap: 10px;">
        <button id="cancel-course-modal-btn" style="padding: 10px 16px; border-radius: 10px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); font-weight:600; cursor:pointer;">Cancel</button>
        <button id="save-course-modal-btn" style="padding: 10px 20px; border-radius: 10px; background: #C2A878; color: #000; border: none; font-weight: 700; cursor:pointer;">Save Course</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#cancel-course-modal-btn')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#save-course-modal-btn')?.addEventListener('click', () => {
    const name = modal.querySelector('#course-name-input').value.trim();
    const code = modal.querySelector('#course-code-input').value.trim();
    const credits = parseFloat(modal.querySelector('#course-credits-input').value) || 3;
    const color = modal.querySelector('#course-color-input').value;

    if (!name) {
      alert('Please enter a course name');
      return;
    }

    saveCourse({
      semesterId,
      name,
      courseCode: code,
      credits,
      color,
      status: COURSE_STATUSES.ACTIVE
    });

    modal.remove();
    if (onSave) onSave();
  });
}

function openTopicModal(courseId, onSave) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'z-index: 2500; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; position: fixed; inset: 0;';

  modal.innerHTML = `
    <div style="background: #181512; border: 1px solid rgba(194,168,120,0.25); border-radius: 20px; width: 90%; max-width: 440px; padding: 26px; color: #fff;">
      <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 16px 0; color: #C2A878;">Add Syllabus Topic</h2>
      
      <div style="margin-bottom: 14px;">
        <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Topic Title</label>
        <input type="text" id="topic-title-input" placeholder="e.g. Graph Search & Dijkstra" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px;">
      </div>

      <div style="margin-bottom: 22px;">
        <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Estimated Study Minutes</label>
        <input type="number" id="topic-minutes-input" value="45" min="15" step="15" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px;">
      </div>

      <div style="display:flex; justify-content:flex-end; gap: 10px;">
        <button id="cancel-topic-btn" style="padding: 10px 16px; border-radius: 10px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); font-weight:600; cursor:pointer;">Cancel</button>
        <button id="save-topic-btn" style="padding: 10px 20px; border-radius: 10px; background: #C2A878; color: #000; border: none; font-weight: 700; cursor:pointer;">Save Topic</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#cancel-topic-btn')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#save-topic-btn')?.addEventListener('click', () => {
    const title = modal.querySelector('#topic-title-input').value.trim();
    const estimatedMinutes = parseInt(modal.querySelector('#topic-minutes-input').value, 10) || 45;

    if (!title) {
      alert('Please enter a topic title');
      return;
    }

    saveTopic({
      courseId,
      title,
      estimatedMinutes,
      masteryLevel: TOPIC_MASTERY_LEVELS.UNSTARTED
    });

    modal.remove();
    if (onSave) onSave();
  });
}

function openAssessmentModal(courseId, onSave) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'z-index: 2500; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; position: fixed; inset: 0;';

  modal.innerHTML = `
    <div style="background: #181512; border: 1px solid rgba(194,168,120,0.25); border-radius: 20px; width: 90%; max-width: 460px; padding: 26px; color: #fff;">
      <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 16px 0; color: #C2A878;">Add Assessment</h2>
      
      <div style="margin-bottom: 14px;">
        <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Assessment Title</label>
        <input type="text" id="asm-title-input" placeholder="e.g. Midterm Exam" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px;">
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <div>
          <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Type</label>
          <select id="asm-type-select" style="width: 100%; background: #222; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px;">
            <option value="assignment">Assignment</option>
            <option value="quiz">Quiz</option>
            <option value="midterm" selected>Midterm</option>
            <option value="final">Final Exam</option>
            <option value="project">Project</option>
          </select>
        </div>
        <div>
          <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Weight (%)</label>
          <input type="number" id="asm-weight-input" value="25" min="1" max="100" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px;">
        </div>
      </div>

      <div style="margin-bottom: 22px;">
        <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700; display:block; margin-bottom: 6px;">Date (YYYY-MM-DD)</label>
        <input type="date" id="asm-date-input" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px;">
      </div>

      <div style="display:flex; justify-content:flex-end; gap: 10px;">
        <button id="cancel-asm-btn" style="padding: 10px 16px; border-radius: 10px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); font-weight:600; cursor:pointer;">Cancel</button>
        <button id="save-asm-btn" style="padding: 10px 20px; border-radius: 10px; background: #C2A878; color: #000; border: none; font-weight: 700; cursor:pointer;">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#cancel-asm-btn')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#save-asm-btn')?.addEventListener('click', () => {
    const title = modal.querySelector('#asm-title-input').value.trim();
    const type = modal.querySelector('#asm-type-select').value;
    const weight = parseFloat(modal.querySelector('#asm-weight-input').value) || 20;
    const examDate = modal.querySelector('#asm-date-input').value;

    if (!title) {
      alert('Please enter assessment title');
      return;
    }

    saveAssessment({
      courseId,
      title,
      type,
      weightPercentage: weight,
      examDate: examDate || null,
      dueDate: examDate || null,
      status: 'pending'
    });

    modal.remove();
    if (onSave) onSave();
  });
}


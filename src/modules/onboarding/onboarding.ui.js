/**
 * Planrova 2.0 — Guided Onboarding Experience
 * Non-intrusive, elegant 3-step personalization modal on first launch.
 */

import { getStorageItem, setStorageItem } from '../../utils/storage.js';
import { ACADEMIC_STORAGE_KEYS } from '../../../shared/domain/academic/academic.types.js';
import { renderCommandCenter } from '../command-center/command-center.ui.js';

export const ONBOARDING_STORAGE_KEY = 'has_completed_onboarding';

/**
 * Initializes the guided onboarding experience if not previously completed.
 */
export function initOnboarding() {
  const completed = getStorageItem(ONBOARDING_STORAGE_KEY, false);
  if (completed) return;

  showOnboardingModal();
}

/**
 * Seeds starter records according to chosen persona to avoid an empty-slate UX.
 */
export function seedStarterData(persona = 'student') {
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Starter Habits
  const existingHabits = getStorageItem('user_habits', []);
  if (existingHabits.length === 0) {
    const starterHabits = [
      { id: 'habit_seed_1', name: 'Drink 2L Water', icon: '💧', category: 'Health', frequency: 'daily' },
      { id: 'habit_seed_2', name: 'Deep Work Focus', icon: '⚡', category: 'Productivity', frequency: 'daily' }
    ];
    setStorageItem('user_habits', starterHabits);
  }

  // 2. Persona Specific Data
  if (persona === 'student') {
    const courses = getStorageItem(ACADEMIC_STORAGE_KEYS.COURSES, []);
    if (courses.length === 0) {
      setStorageItem(ACADEMIC_STORAGE_KEYS.COURSES, [
        {
          id: 'course_seed_1',
          code: 'CS101',
          name: 'Computer Science Core',
          instructor: 'Dr. Turing',
          credits: 4,
          color: '#3b82f6',
          status: 'active'
        }
      ]);
      setStorageItem(ACADEMIC_STORAGE_KEYS.ASSESSMENTS, [
        {
          id: 'ass_seed_1',
          courseCode: 'CS101',
          title: 'Algorithms & Data Structures Lab',
          type: 'assignment',
          dueDate: todayStr,
          weightPercent: 20,
          status: 'pending'
        }
      ]);
    }
  } else {
    // Professional / Builder
    const tasks = getStorageItem('tasks', []);
    if (tasks.length === 0) {
      setStorageItem('tasks', [
        {
          id: 'task_seed_1',
          title: 'Review System Architecture Specs',
          date: todayStr,
          priority: 'high',
          category: 'work',
          completed: false
        },
        {
          id: 'task_seed_2',
          title: 'Plan Sprint Deliverables & Milestones',
          date: todayStr,
          priority: 'medium',
          category: 'work',
          completed: false
        }
      ]);
    }
  }
}

/**
 * Builds and renders the 3-step onboarding modal.
 */
export function showOnboardingModal() {
  let existingOverlay = document.getElementById('onboarding-modal-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  let currentStep = 1;
  let selectedPersona = 'student';
  let selectedName = 'Builder';
  let waterTarget = 2000;

  function renderStep() {
    overlay.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; width: 90%; max-width: 520px; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); position: relative;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">✨</span>
            <span style="font-size: 12px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em;">
              Welcome to Planrova 2.0 · Step ${currentStep} of 3
            </span>
          </div>
          <button id="ob-skip-btn" style="background: none; border: none; color: var(--text-muted); font-size: 12px; cursor: pointer;">
            Skip Setup ✕
          </button>
        </div>

        <!-- Progress Indicators -->
        <div style="display: flex; gap: 6px; margin-bottom: 24px;">
          <div style="flex: 1; height: 4px; border-radius: 2px; background: ${currentStep >= 1 ? 'var(--accent)' : 'rgba(255,255,255,0.1)'};"></div>
          <div style="flex: 1; height: 4px; border-radius: 2px; background: ${currentStep >= 2 ? 'var(--accent)' : 'rgba(255,255,255,0.1)'};"></div>
          <div style="flex: 1; height: 4px; border-radius: 2px; background: ${currentStep >= 3 ? 'var(--accent)' : 'rgba(255,255,255,0.1)'};"></div>
        </div>

        <!-- STEP 1: Persona Selection -->
        ${currentStep === 1 ? `
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0 0 8px 0;">
              What brings you to Planrova?
            </h2>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 20px 0;">
              We’ll tailor your default workspace and priorities to your lifestyle.
            </p>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;">
              <label class="ob-persona-card" style="display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 10px; background: ${selectedPersona === 'student' ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${selectedPersona === 'student' ? 'var(--accent)' : 'var(--border-color)'}; cursor: pointer;">
                <input type="radio" name="ob-persona" value="student" ${selectedPersona === 'student' ? 'checked' : ''} style="accent-color: var(--accent);">
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: var(--text-primary);">🎓 Student & Academic</div>
                  <div style="font-size: 11px; color: var(--text-secondary);">Classes, assignments, exams, GPA tracking, flashcards</div>
                </div>
              </label>

              <label class="ob-persona-card" style="display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 10px; background: ${selectedPersona === 'professional' ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${selectedPersona === 'professional' ? 'var(--accent)' : 'var(--border-color)'}; cursor: pointer;">
                <input type="radio" name="ob-persona" value="professional" ${selectedPersona === 'professional' ? 'checked' : ''} style="accent-color: var(--accent);">
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: var(--text-primary);">💼 Professional & Builder</div>
                  <div style="font-size: 11px; color: var(--text-secondary);">Projects, deep work focus blocks, meetings, task execution</div>
                </div>
              </label>

              <label class="ob-persona-card" style="display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 10px; background: ${selectedPersona === 'learner' ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${selectedPersona === 'learner' ? 'var(--accent)' : 'var(--border-color)'}; cursor: pointer;">
                <input type="radio" name="ob-persona" value="learner" ${selectedPersona === 'learner' ? 'checked' : ''} style="accent-color: var(--accent);">
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: var(--text-primary);">🌿 Lifelong Learner & Freelancer</div>
                  <div style="font-size: 11px; color: var(--text-secondary);">Habits, hydration, reading notes, daily balance</div>
                </div>
              </label>
            </div>
          </div>
        ` : ''}

        <!-- STEP 2: Active Modules -->
        ${currentStep === 2 ? `
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0 0 8px 0;">
              Select Your Focus Areas
            </h2>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 20px 0;">
              All features stay available anytime from the sidebar.
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px;">
              <div style="padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" checked disabled style="accent-color: var(--accent);">
                <div>
                  <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Command Center</div>
                  <div style="font-size: 10px; color: var(--text-secondary);">Daily cockpit</div>
                </div>
              </div>

              <div style="padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="ob-mod-academic" ${selectedPersona === 'student' ? 'checked' : ''} style="accent-color: var(--accent);">
                <div>
                  <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Academic</div>
                  <div style="font-size: 10px; color: var(--text-secondary);">Courses & GPA</div>
                </div>
              </div>

              <div style="padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="ob-mod-finance" checked style="accent-color: var(--accent);">
                <div>
                  <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Finance</div>
                  <div style="font-size: 10px; color: var(--text-secondary);">Budgets & Goals</div>
                </div>
              </div>

              <div style="padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="ob-mod-wellbeing" checked style="accent-color: var(--accent);">
                <div>
                  <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Wellbeing</div>
                  <div style="font-size: 10px; color: var(--text-secondary);">Habits & Hydration</div>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- STEP 3: Quick Personalization -->
        ${currentStep === 3 ? `
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0 0 8px 0;">
              Personalize Your Profile
            </h2>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 20px 0;">
              Fine-tune your daily defaults.
            </p>

            <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
              <div>
                <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 6px;">Your Name or Handle</label>
                <input type="text" id="ob-name-input" value="${selectedName}" style="width: 100%; padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 14px;">
              </div>

              <div>
                <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 6px;">Daily Water Target (ml)</label>
                <input type="number" id="ob-water-input" value="${waterTarget}" step="250" min="500" max="5000" style="width: 100%; padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 14px;">
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Navigation Buttons -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
          ${currentStep > 1 ? `
            <button id="ob-prev-btn" style="background: none; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">
              ← Back
            </button>
          ` : '<div></div>'}

          <button id="ob-next-btn" class="btn-primary" style="padding: 9px 24px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">
            ${currentStep === 3 ? 'Launch Planrova 🚀' : 'Continue →'}
          </button>
        </div>
      </div>
    `;

    // Event Bindings
    const skipBtn = overlay.querySelector('#ob-skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        setStorageItem(ONBOARDING_STORAGE_KEY, true);
        overlay.remove();
      });
    }

    const prevBtn = overlay.querySelector('#ob-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
          currentStep--;
          renderStep();
        }
      });
    }

    const nextBtn = overlay.querySelector('#ob-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentStep === 1) {
          const checked = overlay.querySelector('input[name="ob-persona"]:checked');
          if (checked) selectedPersona = checked.value;
          currentStep++;
          renderStep();
        } else if (currentStep === 2) {
          currentStep++;
          renderStep();
        } else if (currentStep === 3) {
          const nameInput = overlay.querySelector('#ob-name-input');
          const waterInput = overlay.querySelector('#ob-water-input');
          if (nameInput && nameInput.value.trim()) selectedName = nameInput.value.trim();
          if (waterInput && Number(waterInput.value)) waterTarget = Number(waterInput.value);

          // Save settings
          setStorageItem(ONBOARDING_STORAGE_KEY, true);
          setStorageItem('user_profile', {
            name: selectedName,
            persona: selectedPersona,
            bio: selectedPersona === 'student' ? 'Student' : 'Builder'
          });
          const hydration = getStorageItem('hydration', { water: 0, target: 2000 });
          hydration.target = waterTarget;
          setStorageItem('hydration', hydration);

          // Seed sample data
          seedStarterData(selectedPersona);

          overlay.remove();

          // Refresh command center
          if (typeof renderCommandCenter === 'function') renderCommandCenter();
        }
      });
    }

    // Persona Radio click handlers
    overlay.querySelectorAll('input[name="ob-persona"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        selectedPersona = e.target.value;
        renderStep();
      });
    });
  }

  document.body.appendChild(overlay);
  renderStep();
}

/**
 * src/modules/academic/gpa.ui.js
 * Interactive GPA Calculator & Multi-Semester Target Simulator UI for Planrova 2.0.
 */

import {
  computeSemesterGPA,
  computeCumulativeGPA,
  simulateMultiSemesterTarget,
  DEFAULT_GRADING_SCALES,
  GRADING_SCALE_TYPES
} from '../../../shared/domain/academic/index.js';

export function openGpaSimulatorModal({
  currentCGPA = 3.2,
  completedCredits = 45,
  upcomingCredits = 15,
  targetCGPA = 3.5,
  gradingScaleId = GRADING_SCALE_TYPES.LETTER_4_0,
  onSaveTarget = null
} = {}) {
  let modal = document.getElementById('gpa-simulator-modal-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'gpa-simulator-modal-overlay';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'z-index: 2500; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; position: fixed; inset: 0;';
    document.body.appendChild(modal);
  }

  let state = {
    currentCGPA,
    completedCredits,
    upcomingCredits,
    targetCGPA,
    gradingScaleId
  };

  function render() {
    const scale = DEFAULT_GRADING_SCALES[state.gradingScaleId] || DEFAULT_GRADING_SCALES[GRADING_SCALE_TYPES.LETTER_4_0];
    const sim = simulateMultiSemesterTarget({
      currentCGPA: state.currentCGPA,
      completedCredits: state.completedCredits,
      upcomingSemesters: state.upcomingCredits,
      targetCGPA: state.targetCGPA,
      gradingScale: scale
    });

    const isFeasible = sim.isFeasible;
    const badgeBg = isFeasible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
    const badgeColor = isFeasible ? '#10b981' : '#ef4444';
    const badgeText = isFeasible ? 'Target Feasible' : 'Mathematically Impossible';

    modal.innerHTML = `
      <div style="background: #181512; border: 1px solid rgba(194,168,120,0.2); border-radius: 20px; width: 90%; max-width: 520px; padding: 28px; color: #fff; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 700; margin: 0; color: #C2A878;">GPA Calculator & Target Simulator</h2>
            <p style="font-size: 12px; color: var(--text-secondary, #a8a29e); margin: 4px 0 0 0;">Simulate required SGPA to reach your target CGPA</p>
          </div>
          <button id="close-gpa-modal-btn" style="background:none; border:none; color:#a8a29e; font-size: 24px; cursor:pointer;">×</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px;">
          <div>
            <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 600; display:block; margin-bottom: 6px;">Current CGPA</label>
            <input type="number" step="0.01" min="0" max="${scale.maxGradePoint}" id="sim-current-cgpa" value="${state.currentCGPA}" 
              style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 14px; font-weight: 600;">
          </div>
          <div>
            <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 600; display:block; margin-bottom: 6px;">Completed Credits</label>
            <input type="number" step="1" min="0" max="300" id="sim-completed-credits" value="${state.completedCredits}"
              style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 14px; font-weight: 600;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 22px;">
          <div>
            <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 600; display:block; margin-bottom: 6px;">Target CGPA</label>
            <input type="number" step="0.01" min="0" max="${scale.maxGradePoint}" id="sim-target-cgpa" value="${state.targetCGPA}"
              style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 14px; font-weight: 600;">
          </div>
          <div>
            <label style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 600; display:block; margin-bottom: 6px;">Upcoming Credits</label>
            <input type="number" step="1" min="1" max="100" id="sim-upcoming-credits" value="${state.upcomingCredits}"
              style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; color: #fff; font-size: 14px; font-weight: 600;">
          </div>
        </div>

        <!-- Result Card -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #a8a29e;">Required Performance</span>
            <span style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}33;">
              ${badgeText}
            </span>
          </div>

          <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 32px; font-weight: 800; color: ${isFeasible ? '#C2A878' : '#ef4444'};">
              ${sim.requiredSGPA !== null ? sim.requiredSGPA.toFixed(2) : 'N/A'}
            </span>
            <span style="font-size: 13px; color: #a8a29e;">Required SGPA (Scale 0.0 - ${scale.maxGradePoint.toFixed(1)})</span>
          </div>

          <p style="font-size: 12px; line-height: 1.5; color: #d6d3d1; margin: 0;">
            ${sim.reason}
          </p>

          ${!isFeasible ? `
            <div style="margin-top: 10px; font-size: 12px; color: #f59e0b;">
              Maximum achievable CGPA across ${state.completedCredits + state.upcomingCredits} total credits is <strong>${sim.maxPossibleCGPA.toFixed(2)}</strong>.
            </div>
          ` : ''}
        </div>

        <div style="display:flex; justify-content:flex-end; gap: 10px;">
          <button id="cancel-gpa-modal-btn" class="btn-secondary" style="padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); cursor:pointer;">
            Close
          </button>
          ${isFeasible ? `
            <button id="save-gpa-target-btn" class="btn-primary" style="padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; background: #C2A878; color: #000; border: none; cursor:pointer;">
              Save Target SGPA
            </button>
          ` : ''}
        </div>
      </div>
    `;

    // Bind inputs
    const currentInput = modal.querySelector('#sim-current-cgpa');
    const compInput = modal.querySelector('#sim-completed-credits');
    const targetInput = modal.querySelector('#sim-target-cgpa');
    const upInput = modal.querySelector('#sim-upcoming-credits');

    const updateState = () => {
      state.currentCGPA = parseFloat(currentInput.value) || 0;
      state.completedCredits = parseInt(compInput.value, 10) || 0;
      state.targetCGPA = parseFloat(targetInput.value) || 0;
      state.upcomingCredits = parseInt(upInput.value, 10) || 1;
      render();
    };

    currentInput?.addEventListener('input', updateState);
    compInput?.addEventListener('input', updateState);
    targetInput?.addEventListener('input', updateState);
    upInput?.addEventListener('input', updateState);

    modal.querySelector('#close-gpa-modal-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#cancel-gpa-modal-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#save-gpa-target-btn')?.addEventListener('click', () => {
      if (onSaveTarget && sim.requiredSGPA) {
        onSaveTarget(sim.requiredSGPA, state.targetCGPA);
      }
      modal.remove();
    });
  }

  render();
}


/**
 * Planrova 2.0 — Professional Projects Workspace UI
 * Comprehensive multi-project tracking, milestone timelines,
 * health status indicators, and progress rollups.
 */

import { getStorageItem, setStorageItem } from '../../utils/storage.js';
import {
  PROJECTS_STORAGE_KEYS,
  normalizeProject,
  normalizeMilestone,
  computeProjectProgress,
  computeProjectHealth
} from '../../../shared/domain/projects/index.js';
import { addXP, logDailyActivity } from '../gamification.js';

export function initProjectsWorkspace() {
  const container = document.getElementById('projects-workspace-view');
  if (!container) return;

  renderProjectsWorkspace();
}

export function renderProjectsWorkspace() {
  const container = document.getElementById('projects-workspace-view');
  if (!container) return;

  const projects = getStorageItem(PROJECTS_STORAGE_KEYS.PROJECTS, []);
  const milestones = getStorageItem(PROJECTS_STORAGE_KEYS.MILESTONES, []);
  const tasks = getStorageItem('tasks', []);
  const todayStr = new Date().toISOString().split('T')[0];

  const activeProjects = projects.filter(p => !p.deleted && p.status !== 'archived');
  const archivedProjects = projects.filter(p => !p.deleted && p.status === 'archived');

  container.innerHTML = `
    <!-- Projects Workspace Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
      <div>
        <div style="font-size: 13px; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">
          Workspace · Deliverables & Milestones
        </div>
        <h1 style="font-size: 26px; font-weight: 800; margin: 0; color: var(--text-primary); letter-spacing: -0.02em;">
          Projects Workspace
        </h1>
        <p style="font-size: 13px; color: var(--text-secondary); margin: 6px 0 0 0;">
          Organize client deliverables, engineering sprints, and long-term milestones.
        </p>
      </div>

      <button id="proj-add-btn" class="btn-primary" style="padding: 9px 18px; font-size: 13px; font-weight: 700; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
        <span>+</span> New Project
      </button>
    </div>

    <!-- Active Projects Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 18px; margin-bottom: 32px;">
      ${activeProjects.length === 0 ? `
        <div style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: 14px;">
          <div style="font-size: 32px; margin-bottom: 12px;">📁</div>
          <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px 0;">No Active Projects</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">Create a project to track milestones, tasks, and deliverables.</p>
          <button id="proj-empty-add-btn" class="btn-primary" style="padding: 8px 16px; font-size: 12px; font-weight: 700; border-radius: 8px; cursor: pointer;">
            + Create First Project
          </button>
        </div>
      ` : activeProjects.map(proj => {
        const progress = computeProjectProgress(proj, milestones, tasks);
        const health = computeProjectHealth(proj, milestones, todayStr);
        const projMilestones = milestones.filter(m => !m.deleted && m.project_id === proj.id);

        let healthColor = '#10b981';
        let healthLabel = 'On Track';
        if (health === 'at_risk') {
          healthColor = '#f59e0b';
          healthLabel = 'At Risk';
        } else if (health === 'overdue') {
          healthColor = '#ef4444';
          healthLabel = 'Overdue';
        } else if (health === 'completed') {
          healthColor = 'var(--accent)';
          healthLabel = 'Completed';
        }

        return `
          <div class="card" style="padding: 20px; border-radius: 14px; background: var(--bg-card); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <!-- Header Row -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                  <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">
                    ${proj.category || 'General'}
                  </span>
                  <h3 style="font-size: 17px; font-weight: 700; margin: 4px 0 0 0; color: var(--text-primary);">
                    ${proj.name}
                  </h3>
                </div>
                <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: ${healthColor}22; color: ${healthColor};">
                  ${healthLabel}
                </span>
              </div>

              ${proj.description ? `
                <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 14px 0; line-height: 1.4;">
                  ${proj.description}
                </p>
              ` : ''}

              <!-- Progress Bar -->
              <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
                  <span>Progress</span>
                  <span style="color: var(--text-primary);">${progress}%</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                  <div style="height: 100%; width: ${progress}%; background: ${proj.color || 'var(--accent)'}; transition: width 0.3s ease;"></div>
                </div>
              </div>

              <!-- Milestones Section -->
              <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                    Milestones (${projMilestones.filter(m => m.status === 'completed').length}/${projMilestones.length})
                  </span>
                  <button class="proj-add-milestone-btn" data-project-id="${proj.id}" style="background: none; border: none; color: var(--accent); font-size: 11px; font-weight: 700; cursor: pointer;">
                    + Add
                  </button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${projMilestones.length === 0 ? `
                    <div style="font-size: 11px; color: var(--text-muted); font-style: italic;">No milestones yet.</div>
                  ` : projMilestones.map(m => `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,0.02); font-size: 12px;">
                      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; min-width: 0;">
                        <input type="checkbox" class="proj-milestone-checkbox" data-id="${m.id}" ${m.status === 'completed' ? 'checked' : ''} style="accent-color: var(--accent);">
                        <span style="color: ${m.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${m.status === 'completed' ? 'line-through' : 'none'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${m.title}
                        </span>
                      </label>
                      ${m.dueDate ? `
                        <span style="font-size: 10px; color: ${m.dueDate < todayStr && m.status !== 'completed' ? '#ef4444' : 'var(--text-muted)'}; margin-left: 8px; flex-shrink: 0;">
                          ${m.dueDate}
                        </span>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Footer: Target Date & Actions -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px; font-size: 11px; color: var(--text-muted);">
              <span>Target: ${proj.targetDate || 'Ongoing'}</span>
              <button class="proj-complete-btn" data-id="${proj.id}" style="background: none; border: 1px solid var(--border-color); color: var(--text-secondary); border-radius: 6px; padding: 3px 8px; cursor: pointer;">
                ${proj.status === 'completed' ? 'Reopen' : '✓ Mark Complete'}
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  attachProjectsEvents(container, projects, milestones);
}

function attachProjectsEvents(container, projects, milestones) {
  const addBtn = container.querySelector('#proj-add-btn');
  const emptyAddBtn = container.querySelector('#proj-empty-add-btn');

  const openModal = () => showCreateProjectModal();
  if (addBtn) addBtn.addEventListener('click', openModal);
  if (emptyAddBtn) emptyAddBtn.addEventListener('click', openModal);

  // Milestone checkboxes
  container.querySelectorAll('.proj-milestone-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      const allMilestones = getStorageItem(PROJECTS_STORAGE_KEYS.MILESTONES, []);
      const milestone = allMilestones.find(m => m.id === id);
      if (milestone) {
        milestone.status = cb.checked ? 'completed' : 'pending';
        milestone.updated_at = Date.now();
        setStorageItem(PROJECTS_STORAGE_KEYS.MILESTONES, allMilestones);

        if (cb.checked) {
          addXP(25);
          logDailyActivity('task', 1);
        }

        renderProjectsWorkspace();
      }
    });
  });

  // Add Milestone buttons
  container.querySelectorAll('.proj-add-milestone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const projectId = btn.dataset.projectId;
      const title = prompt('Enter Milestone Title:');
      if (title && title.trim()) {
        const dueDate = prompt('Enter Due Date (YYYY-MM-DD) or leave empty:', new Date().toISOString().split('T')[0]);
        const allMilestones = getStorageItem(PROJECTS_STORAGE_KEYS.MILESTONES, []);
        allMilestones.push(normalizeMilestone({
          project_id: projectId,
          title: title.trim(),
          dueDate: dueDate ? dueDate.trim() : ''
        }));
        setStorageItem(PROJECTS_STORAGE_KEYS.MILESTONES, allMilestones);
        renderProjectsWorkspace();
      }
    });
  });

  // Mark project complete buttons
  container.querySelectorAll('.proj-complete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const allProjects = getStorageItem(PROJECTS_STORAGE_KEYS.PROJECTS, []);
      const project = allProjects.find(p => p.id === id);
      if (project) {
        project.status = project.status === 'completed' ? 'active' : 'completed';
        project.updated_at = Date.now();
        setStorageItem(PROJECTS_STORAGE_KEYS.PROJECTS, allProjects);
        if (project.status === 'completed') {
          addXP(50);
        }
        renderProjectsWorkspace();
      }
    });
  });
}

function showCreateProjectModal() {
  let existingModal = document.getElementById('proj-create-modal-overlay');
  if (existingModal) existingModal.remove();

  const overlay = document.createElement('div');
  overlay.id = 'proj-create-modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  overlay.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; width: 90%; max-width: 480px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
      <h3 style="font-size: 18px; font-weight: 700; margin: 0 0 16px 0; color: var(--text-primary);">Create New Project</h3>

      <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
        <div>
          <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Project Name</label>
          <input type="text" id="new-proj-name" placeholder="e.g. Mobile App Redesign" style="width: 100%; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 13px;">
        </div>

        <div>
          <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Category</label>
          <input type="text" id="new-proj-cat" placeholder="e.g. Engineering, Client Work, Research" value="Engineering" style="width: 100%; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 13px;">
        </div>

        <div>
          <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Description</label>
          <textarea id="new-proj-desc" placeholder="Scope, key goals, deliverables..." rows="3" style="width: 100%; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 13px;"></textarea>
        </div>

        <div>
          <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Target Completion Date</label>
          <input type="date" id="new-proj-date" style="width: 100%; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 13px;">
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button id="new-proj-cancel-btn" style="background: none; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Cancel
        </button>
        <button id="new-proj-save-btn" class="btn-primary" style="padding: 8px 20px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
          Create Project
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#new-proj-cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#new-proj-save-btn').addEventListener('click', () => {
    const name = overlay.querySelector('#new-proj-name').value.trim();
    if (!name) return;

    const category = overlay.querySelector('#new-proj-cat').value.trim();
    const description = overlay.querySelector('#new-proj-desc').value.trim();
    const targetDate = overlay.querySelector('#new-proj-date').value;

    const allProjects = getStorageItem(PROJECTS_STORAGE_KEYS.PROJECTS, []);
    allProjects.push(normalizeProject({
      name,
      category,
      description,
      targetDate
    }));

    setStorageItem(PROJECTS_STORAGE_KEYS.PROJECTS, allProjects);
    overlay.remove();
    renderProjectsWorkspace();
  });
}


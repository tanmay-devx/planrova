import { getStorageItem } from '../utils/storage.js';
import { searchUniversal } from './search/search.engine.js';
import { ACADEMIC_STORAGE_KEYS } from '../../shared/domain/academic/academic.types.js';
import { renderNotesLibrary, openNotesDrawer } from './notes.js';

export function initCommandPalette() {
  const overlay = document.getElementById('command-palette-overlay');
  const input = document.getElementById('command-palette-input');
  const results = document.getElementById('command-palette-results');
  
  if (!overlay || !input || !results) return;
  
  let selectedIndex = 0;
  let currentItems = [];
  
  input.addEventListener('input', () => {
    selectedIndex = 0;
    renderResults();
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentItems.length > 0) {
        selectedIndex = (selectedIndex + 1) % currentItems.length;
        updateActiveItem();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentItems.length > 0) {
        selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
        updateActiveItem();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentItems[selectedIndex]) {
        executeItem(currentItems[selectedIndex]);
      }
    }
  });
  
  // Close when clicking outside card
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
    }
  });
  
  function getSystemActions() {
    return [
      { id: 'act_command_center', type: 'action', icon: '⚡', title: 'Go to Command Center', desc: 'Switch to Daily Command Center home view', action: () => { const btn = document.getElementById('view-command-center-btn'); if (btn) btn.click(); } },
      { id: 'act_weekly', type: 'action', icon: '🗓️', title: 'Go to Weekly Timetable', desc: 'Switch to Weekly schedule view', action: () => { const btn = document.getElementById('view-weekly-btn'); if (btn) btn.click(); } },
      { id: 'act_cal', type: 'action', icon: '📅', title: 'Go to Calendar', desc: 'Switch to Month Calendar view', action: () => { const btn = document.getElementById('view-calendar-btn'); if (btn) btn.click(); } },
      { id: 'act_plan', type: 'action', icon: '⏱️', title: 'Go to Today Plan', desc: 'Open adaptive daily planning timeline', action: () => { const btn = document.getElementById('view-plan-btn'); if (btn) btn.click(); } },
      { id: 'act_academic', type: 'action', icon: '🎓', title: 'Go to Academic Workspace', desc: 'Courses, syllabus, GPA, flashcards', action: () => { const btn = document.getElementById('view-academic-btn'); if (btn) btn.click(); } },
      { id: 'act_projects', type: 'action', icon: '📁', title: 'Go to Projects Workspace', desc: 'Projects, milestones, and deliverables', action: () => { const btn = document.getElementById('view-projects-btn'); if (btn) btn.click(); } },
      { id: 'act_finance', type: 'action', icon: '💰', title: 'Go to Finance Workspace', desc: 'Budgets, transactions, savings velocity', action: () => { const btn = document.getElementById('view-finance-btn'); if (btn) btn.click(); } },
      { id: 'act_wellbeing', type: 'action', icon: '🌿', title: 'Go to Wellbeing Workspace', desc: 'Habits, hydration, energy check-ins', action: () => { const btn = document.getElementById('view-wellbeing-btn'); if (btn) btn.click(); } },
      { id: 'act_ai', type: 'action', icon: '✨', title: 'Go to AI Assistant', desc: 'Privacy-first contextual assistant', action: () => { const btn = document.getElementById('view-ai-btn'); if (btn) btn.click(); } },
      { id: 'act_add_task', type: 'action', icon: '+', title: '+ Add Task', desc: 'Create a new task in your planner', action: () => document.getElementById('add-task-btn').click() },
      { id: 'act_pomo', type: 'action', icon: '⏱️', title: 'Start Focus Session', desc: 'Launch pomodoro focus timer session', action: () => document.getElementById('pomodoro-modal-overlay').classList.remove('hidden') },
      { id: 'act_water', type: 'action', icon: '💧', title: 'Log Water Intake', desc: 'Log water intake or update target', action: () => document.getElementById('water-modal-overlay').classList.remove('hidden') },
      { id: 'act_notes', type: 'action', icon: '📝', title: 'Open Subject Notes', desc: 'Search and author markdown notes', action: () => { document.getElementById('notes-library-modal-overlay').classList.remove('hidden'); if (typeof renderNotesLibrary === 'function') renderNotesLibrary(); } }
    ];
  }
  
  function getItems() {
    const query = input.value;
    const tasks = getStorageItem('tasks', []);
    const notes = getStorageItem('notes', []);
    const courses = getStorageItem(ACADEMIC_STORAGE_KEYS.COURSES, []);
    const assessments = getStorageItem(ACADEMIC_STORAGE_KEYS.ASSESSMENTS, []);
    const syllabusTopics = getStorageItem(ACADEMIC_STORAGE_KEYS.SYLLABUS_TOPICS, []);
    const expenses = getStorageItem('expenses', []);
    const transactions = getStorageItem('planrova_finance_transactions', []);
    const combinedTxns = [...expenses, ...transactions];
    const budgets = getStorageItem('planrova_finance_budgets', []);
    const habits = getStorageItem('user_habits', []);
    const actions = getSystemActions();

    return searchUniversal({
      query,
      tasks,
      notes,
      courses,
      assessments,
      syllabusTopics,
      transactions: combinedTxns,
      budgets,
      habits,
      actions
    });
  }
  
  function renderResults() {
    currentItems = getItems();
    results.innerHTML = '';
    
    if (currentItems.length === 0) {
      results.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">No matching results across your life OS.</div>`;
      return;
    }
    
    let lastCategory = null;

    currentItems.forEach((item, idx) => {
      // Group header by category
      if (item.category && item.category !== lastCategory) {
        lastCategory = item.category;
        const catHeader = document.createElement('div');
        catHeader.style.padding = '8px 16px 4px 16px';
        catHeader.style.fontSize = '11px';
        catHeader.style.fontWeight = '700';
        catHeader.style.color = 'var(--accent)';
        catHeader.style.textTransform = 'uppercase';
        catHeader.style.letterSpacing = '0.06em';
        catHeader.textContent = item.category;
        results.appendChild(catHeader);
      }

      const row = document.createElement('div');
      row.className = `command-palette-item ${idx === selectedIndex ? 'active' : ''}`;
      row.style.padding = '8px 16px';
      row.style.cursor = 'pointer';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '12px';
      row.style.borderRadius = '6px';
      row.style.margin = '2px 8px';
      
      row.innerHTML = `
        <span style="font-size: 16px; width: 22px; text-align: center; color: var(--accent); flex-shrink: 0;">${item.icon || '•'}</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
          <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.desc}</div>
        </div>
      `;
      
      row.addEventListener('click', () => {
        executeItem(item);
      });
      
      results.appendChild(row);
    });
  }
  
  function updateActiveItem() {
    const rows = results.querySelectorAll('.command-palette-item');
    rows.forEach((row, idx) => {
      if (idx === selectedIndex) {
        row.classList.add('active');
        row.style.background = 'rgba(255, 255, 255, 0.08)';
        row.scrollIntoView({ block: 'nearest' });
      } else {
        row.classList.remove('active');
        row.style.background = 'transparent';
      }
    });
  }
  
  function executeItem(item) {
    overlay.classList.add('hidden');
    input.value = '';

    if (typeof item.action === 'function') {
      item.action();
      return;
    }

    if (item.targetView) {
      if (item.targetView === 'academic') {
        if (typeof window.switchMainView === 'function') window.switchMainView('academic');
      } else if (item.targetView === 'finance') {
        if (typeof window.switchMainView === 'function') window.switchMainView('finance');
      } else if (item.targetView === 'wellbeing') {
        if (typeof window.switchMainView === 'function') window.switchMainView('wellbeing');
      } else if (item.targetView === 'weekly') {
        if (typeof window.switchMainView === 'function') window.switchMainView('weekly');
      } else if (item.targetView === 'notes') {
        const modal = document.getElementById('notes-library-modal-overlay');
        if (modal) modal.classList.remove('hidden');
        if (item.rawId && typeof openNotesDrawer === 'function') {
          openNotesDrawer(item.rawId);
        }
      }
    }
  }
  
  // Expose it on the search button too if user clicks
  const searchBtn = document.getElementById('global-search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      overlay.classList.remove('hidden');
      input.focus();
      selectedIndex = 0;
      renderResults();
    });
  }
}

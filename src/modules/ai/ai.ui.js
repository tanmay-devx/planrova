/**
 * src/modules/ai/ai.ui.js
 * Planrova 2.0 Privacy-First AI Assistant Web Workspace.
 *
 * Implements:
 * 1. Opt-In & Privacy Settings Interface.
 * 2. Daily Intelligence Briefing display.
 * 3. Chat conversation feed.
 * 4. Action Proposal Cards with explicit Approve/Reject controls.
 * 5. Data minimization context pill indicators.
 */

import {
  getAIPermissions,
  saveAIPermissions,
  getAIMessages,
  saveAIMessages,
  getAIProposals,
  saveAIProposals,
  getAIUsage,
  saveAIUsage,
  clearAIHistory
} from './ai-storage.js';
import {
  processAIQuery,
  approveAndExecuteProposal,
  rejectProposal,
  generateDailyBriefing,
  explainDomainPrivacy,
  AI_CONTEXT_CATEGORIES,
  AI_PROPOSAL_STATUSES,
  AI_ACTION_TYPES,
  enableAI,
  disableAI,
  updateDomainPermission,
  BackendAIProxyProvider,
  MockAIProvider
} from '../../../shared/domain/ai/index.js';
import { getStorageItem, setStorageItem } from '../../utils/storage.js';

let isInitialized = false;
let currentConversationId = 'default';
const provider = new BackendAIProxyProvider();

export function initAIWorkspace() {
  renderAIWorkspace();
  if (!isInitialized) {
    setupAIEventListeners();
    isInitialized = true;
  }
}

export function renderAIWorkspace() {
  const container = document.getElementById('ai-workspace-content');
  if (!container) return;

  const permissions = getAIPermissions();
  const messages = getAIMessages(currentConversationId);
  const proposals = getAIProposals();
  const usage = getAIUsage();

  const isEnabled = permissions.enabled;

  container.innerHTML = `
    <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
      
      <!-- Workspace Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1 style="font-family: var(--font-display, 'Plus Jakarta Sans'); font-size: 24px; font-weight: 800; color: #C2A878; margin: 0;">AI Assistant</h1>
            <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; ${isEnabled ? 'background: rgba(16, 185, 129, 0.15); color: #10b981;' : 'background: rgba(239, 68, 68, 0.15); color: #ef4444;'}">
              ${isEnabled ? '● Active' : '○ Disabled (Opt-In)'}
            </span>
          </div>
          <p style="font-size: 12px; color: #a8a29e; margin: 4px 0 0 0;">
            Privacy-first intelligence. Deterministic domain engines remain authoritative.
          </p>
        </div>

        <div style="display: flex; gap: 10px;">
          <button id="ai-settings-btn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            ⚙ Privacy & Permissions
          </button>
        </div>
      </div>

      <!-- Domain Permission Pills Bar -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #78716c; font-weight: 700;">Authorized Context Categories</span>
          <span style="font-size: 11px; color: #a8a29e;">Usage Today: ${usage.requestCount}/${permissions.dailyRequestLimit} requests</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="ai-context-pills-bar">
          ${renderContextPills(permissions)}
        </div>
      </div>

      <!-- Daily Intelligence Briefing Card -->
      <div style="background: rgba(194, 168, 120, 0.04); border: 1px solid rgba(194, 168, 120, 0.2); border-radius: 12px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 13px; font-weight: 700; color: #C2A878; display: flex; align-items: center; gap: 6px;">
            ⚡ Daily Intelligence Briefing
          </span>
          <button id="refresh-briefing-btn" style="background: none; border: none; color: #a8a29e; font-size: 12px; cursor: pointer; text-decoration: underline;">
            Refresh
          </button>
        </div>
        <div id="daily-briefing-text" style="font-size: 13px; color: #d6d3d1; line-height: 1.6; white-space: pre-wrap;">
          ${isEnabled ? 'Loading your daily briefing...' : 'Planrova AI is disabled. Enable AI in Privacy & Permissions to view your briefing.'}
        </div>
      </div>

      <!-- Chat Feed -->
      <div id="ai-chat-feed" style="min-height: 280px; max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 8px 0;">
        ${messages.length === 0 ? `
          <div style="text-align: center; padding: 40px 20px; color: #78716c;">
            <div style="font-size: 32px; margin-bottom: 8px;">✦</div>
            <div style="font-size: 14px; font-weight: 600; color: #a8a29e;">Ask Planrova Assistant anything</div>
            <div style="font-size: 12px; margin-top: 4px;">"What should I focus on today?", "Remind me to finish DBMS lab tomorrow", or "Explain my academic progress"</div>
          </div>
        ` : messages.map(m => renderChatMessage(m, proposals)).join('')}
      </div>

      <!-- Input Bar -->
      <div style="display: flex; gap: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 8px 12px;">
        <input 
          type="text" 
          id="ai-user-input" 
          placeholder="${isEnabled ? 'Ask question or plan a task...' : 'Enable AI in settings to start chatting...'}"
          ${isEnabled ? '' : 'disabled'}
          style="flex: 1; background: transparent; border: none; color: #fff; font-size: 14px; outline: none;"
        />
        <button 
          id="ai-send-btn" 
          ${isEnabled ? '' : 'disabled'}
          style="background: #C2A878; border: none; color: #000; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;"
        >
          Send
        </button>
      </div>

    </div>

    <!-- AI Privacy & Permissions Modal -->
    <div id="ai-settings-modal" class="hidden modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div style="background: #181B20; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; width: 500px; max-width: 90vw; padding: 24px; max-height: 85vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 700; color: #C2A878; margin: 0;">AI Privacy & Permissions</h2>
          <button id="close-ai-settings-btn" style="background: none; border: none; color: #a8a29e; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <div style="margin-bottom: 20px; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-size: 14px; font-weight: 700; color: #fff;">Enable Planrova AI</div>
              <div style="font-size: 11px; color: #a8a29e;">Master switch for AI assistance features.</div>
            </div>
            <input type="checkbox" id="ai-toggle-master" ${isEnabled ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;" />
          </label>
        </div>

        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #78716c; margin-bottom: 10px;">
          Category Permissions (Data Minimization)
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;">
          ${Object.values(AI_CONTEXT_CATEGORIES).map(cat => {
            const isGranted = Boolean(permissions.domains[cat]);
            const isSensitive = ['finance', 'wellbeing', 'notes'].includes(cat);
            return `
              <div style="padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;">
                <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                  <div>
                    <span style="font-size: 13px; font-weight: 600; color: #fff; text-transform: capitalize;">${cat}</span>
                    ${isSensitive ? '<span style="font-size: 9px; font-weight: 700; color: #f59e0b; margin-left: 6px; padding: 1px 4px; background: rgba(245, 158, 11, 0.1); border-radius: 4px;">SENSITIVE</span>' : ''}
                    <div style="font-size: 11px; color: #a8a29e; margin-top: 2px;">${explainDomainPrivacy(cat)}</div>
                  </div>
                  <input type="checkbox" class="ai-domain-checkbox" data-domain="${cat}" ${isGranted ? 'checked' : ''} style="transform: scale(1.2); cursor: pointer;" />
                </label>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;">
          <button id="clear-ai-history-btn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Clear AI History
          </button>
          <button id="save-ai-settings-btn" style="background: #C2A878; border: none; color: #000; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">
            Done
          </button>
        </div>
      </div>
    </div>
  `;

  // Asynchronously trigger briefing update if enabled
  if (isEnabled) {
    loadBriefingAsync();
  }
}

function renderContextPills(permissions) {
  return Object.values(AI_CONTEXT_CATEGORIES).map(cat => {
    const isGranted = permissions.enabled && Boolean(permissions.domains[cat]);
    return `
      <span style="font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 6px; ${isGranted ? 'background: rgba(194, 168, 120, 0.15); color: #C2A878; border: 1px solid rgba(194, 168, 120, 0.3);' : 'background: rgba(255,255,255,0.03); color: #78716c; border: 1px solid rgba(255,255,255,0.05);'}">
        ${cat}: ${isGranted ? 'ON' : 'OFF'}
      </span>
    `;
  }).join('');
}

function renderChatMessage(msg, proposals) {
  const isUser = msg.role === 'user';
  const relatedProposals = proposals.filter(p => msg.proposalIds?.includes(p.id));

  return `
    <div style="display: flex; flex-direction: column; align-items: ${isUser ? 'flex-end' : 'flex-start'}; gap: 6px;">
      <div style="max-width: 80%; padding: 12px 16px; border-radius: 12px; font-size: 13px; line-height: 1.5; ${isUser ? 'background: #C2A878; color: #000; font-weight: 500;' : 'background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.08);'}">
        ${escapeHtml(msg.content)}
      </div>

      ${relatedProposals.length > 0 ? `
        <div style="max-width: 80%; width: 100%; display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
          ${relatedProposals.map(renderProposalCard).join('')}
        </div>
      ` : ''}

      ${!isUser && msg.contextCategoriesUsed?.length ? `
        <span style="font-size: 10px; color: #78716c;">
          Used context: ${msg.contextCategoriesUsed.join(', ')}
        </span>
      ` : ''}
    </div>
  `;
}

function renderProposalCard(proposal) {
  const isPending = proposal.approvalStatus === AI_PROPOSAL_STATUSES.PENDING_APPROVAL;
  const isExecuted = proposal.approvalStatus === AI_PROPOSAL_STATUSES.EXECUTED;
  const isRejected = proposal.approvalStatus === AI_PROPOSAL_STATUSES.REJECTED;

  return `
    <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(194, 168, 120, 0.3); border-radius: 10px; padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #C2A878;">
          ⚡ Action Proposal: ${proposal.actionType.replace('_', ' ')}
        </span>
        <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; ${isExecuted ? 'background: rgba(16, 185, 129, 0.2); color: #10b981;' : isRejected ? 'background: rgba(239, 68, 68, 0.2); color: #ef4444;' : 'background: rgba(245, 158, 11, 0.2); color: #f59e0b;'}">
          ${proposal.approvalStatus}
        </span>
      </div>

      <div style="font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 4px;">
        ${escapeHtml(proposal.summary)}
      </div>

      <div style="font-size: 11px; color: #a8a29e; margin-bottom: 10px; background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 6px; font-family: monospace;">
        ${escapeHtml(JSON.stringify(proposal.payload))}
      </div>

      ${isPending ? `
        <div style="display: flex; gap: 8px;">
          <button class="ai-approve-btn" data-id="${proposal.id}" style="background: #10b981; border: none; color: #000; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
            ✓ Approve & Execute
          </button>
          <button class="ai-reject-btn" data-id="${proposal.id}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #ef4444; font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
            ✕ Reject
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

async function loadBriefingAsync() {
  const briefingEl = document.getElementById('daily-briefing-text');
  if (!briefingEl) return;

  const permissions = getAIPermissions();
  const userData = collectLocalUserData();

  try {
    const briefing = await generateDailyBriefing({
      userData,
      permissions,
      provider
    });
    briefingEl.textContent = briefing.briefingText;
  } catch (err) {
    briefingEl.textContent = 'Could not generate briefing at this time.';
  }
}

function collectLocalUserData() {
  return {
    tasks: getStorageItem('tasks') || [],
    calendarEvents: getStorageItem('calendar_events') || [],
    courses: getStorageItem('planrova_academic_courses') || [],
    flashcards: getStorageItem('planrova_academic_flashcards') || [],
    budgets: getStorageItem('planrova_finance_budgets') || [],
    recurringPayments: getStorageItem('planrova_finance_recurring') || [],
    habits: getStorageItem('habits') || [],
    hydrationLogs: getStorageItem('planrova_wellbeing_hydration') || []
  };
}

function setupAIEventListeners() {
  const container = document.getElementById('ai-workspace-content');
  if (!container) return;

  // Send query
  const sendBtn = document.getElementById('ai-send-btn');
  const inputEl = document.getElementById('ai-user-input');

  const handleSend = async () => {
    const query = inputEl?.value?.trim();
    if (!query) return;
    inputEl.value = '';

    const permissions = getAIPermissions();
    const usage = getAIUsage();
    const userData = collectLocalUserData();

    // Optimistically append user message
    const currentMsgs = getAIMessages(currentConversationId);

    const result = await processAIQuery({
      query,
      conversationId: currentConversationId,
      userData,
      permissions,
      usageRecord: usage,
      provider
    });

    const updatedMsgs = [...currentMsgs, result.userMessage, result.assistantMessage];
    saveAIMessages(currentConversationId, updatedMsgs);

    if (result.proposals?.length) {
      const allProps = getAIProposals();
      saveAIProposals([...allProps, ...result.proposals]);
    }

    if (result.updatedUsage) {
      saveAIUsage(result.updatedUsage);
    }

    renderAIWorkspace();
  };

  sendBtn?.addEventListener('click', handleSend);
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  // Settings Modal Controls
  document.getElementById('ai-settings-btn')?.addEventListener('click', () => {
    document.getElementById('ai-settings-modal')?.classList.remove('hidden');
  });

  document.getElementById('close-ai-settings-btn')?.addEventListener('click', () => {
    document.getElementById('ai-settings-modal')?.classList.add('hidden');
  });

  document.getElementById('save-ai-settings-btn')?.addEventListener('click', () => {
    const masterChecked = document.getElementById('ai-toggle-master')?.checked;
    let perms = getAIPermissions();
    perms = masterChecked ? enableAI(perms) : disableAI(perms);

    const checkboxes = document.querySelectorAll('.ai-domain-checkbox');
    checkboxes.forEach(cb => {
      const domain = cb.getAttribute('data-domain');
      if (domain) {
        perms = updateDomainPermission(perms, domain, cb.checked);
      }
    });

    saveAIPermissions(perms);
    document.getElementById('ai-settings-modal')?.classList.add('hidden');
    renderAIWorkspace();
  });

  // Clear History
  document.getElementById('clear-ai-history-btn')?.addEventListener('click', () => {
    if (confirm('Clear all AI assistant conversation history and proposals?')) {
      clearAIHistory(currentConversationId);
      renderAIWorkspace();
    }
  });

  // Refresh Briefing
  document.getElementById('refresh-briefing-btn')?.addEventListener('click', () => {
    loadBriefingAsync();
  });

  // Proposal Actions (Approve / Reject)
  container.addEventListener('click', async (e) => {
    const approveBtn = e.target.closest('.ai-approve-btn');
    if (approveBtn) {
      const id = approveBtn.getAttribute('data-id');
      const props = getAIProposals();
      const targetProp = props.find(p => p.id === id);
      if (!targetProp) return;

      const domainHandlers = {
        [AI_ACTION_TYPES.CREATE_TASK]: async (payload) => {
          const currentTasks = getStorageItem('tasks') || [];
          const newTask = {
            id: `task_${Date.now()}`,
            title: payload.title,
            priority: payload.priority || 'medium',
            dueDate: payload.dueDate || new Date().toISOString().slice(0, 10),
            completed: false,
            createdAt: new Date().toISOString()
          };
          setStorageItem('tasks', [newTask, ...currentTasks]);
          return newTask;
        }
      };

      try {
        const res = await approveAndExecuteProposal({ proposal: targetProp, domainHandlers });
        if (res.executed) {
          const updatedProps = props.map(p => p.id === id ? res.proposal : p);
          saveAIProposals(updatedProps);
          renderAIWorkspace();
        }
      } catch (err) {
        alert(`Could not execute proposal: ${err.message}`);
      }
      return;
    }

    const rejectBtn = e.target.closest('.ai-reject-btn');
    if (rejectBtn) {
      const id = rejectBtn.getAttribute('data-id');
      const props = getAIProposals();
      const targetProp = props.find(p => p.id === id);
      if (!targetProp) return;

      const rejected = rejectProposal({ proposal: targetProp });
      const updatedProps = props.map(p => p.id === id ? rejected : p);
      saveAIProposals(updatedProps);
      renderAIWorkspace();
    }
  });
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


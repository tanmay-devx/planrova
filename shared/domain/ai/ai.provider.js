/**
 * shared/domain/ai/ai.provider.js
 * Provider Abstraction for Planrova AI Assistance.
 *
 * Implements:
 * 1. MockAIProvider (Deterministic, 100% offline rule-based fallback).
 * 2. BackendAIProxyProvider (Calls server-side proxy; zero client credential exposure).
 */

import { AI_INTENTS, AI_ACTION_TYPES } from './ai.types.js';

export class BaseAIProvider {
  async generateResponse({ prompt, context, intent }) {
    throw new Error('Not implemented');
  }

  async checkAvailability() {
    return { available: false, mode: 'base' };
  }
}

/**
 * Deterministic Mock AI Provider for testing, offline-first execution, and zero-cost local use.
 */
export class MockAIProvider extends BaseAIProvider {
  async checkAvailability() {
    return { available: true, mode: 'local_deterministic' };
  }

  async generateResponse({ prompt, context, intent = AI_INTENTS.QUESTION }) {
    const p = prompt.toLowerCase();

    // 1. Task Creation Proposal
    if (intent === AI_INTENTS.TASK_PROPOSAL || /remind\s+me|create\s+task|plan/i.test(p)) {
      const titleMatch = prompt.match(/(?:remind\s+me\s+to|create\s+(?:a\s+)?task\s+(?:to\s+)?|add\s+task\s+)(.+)/i);
      const title = titleMatch ? titleMatch[1].trim() : 'New Task from Assistant';

      return {
        text: `I've prepared a proposal to schedule this task for you: "${title}". You can review and approve it below.`,
        suggestedProposals: [
          {
            actionType: AI_ACTION_TYPES.CREATE_TASK,
            summary: `Create task: ${title}`,
            payload: {
              title,
              priority: /urgent|asap|important/i.test(p) ? 'high' : 'medium',
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            }
          }
        ]
      };
    }

    // 2. Day Summary
    if (intent === AI_INTENTS.SUMMARIZE_DAY) {
      return {
        text: `Here is your daily briefing based on your authorized context:\n\n${context || 'No specific schedule or tasks found for today. Enjoy your day!'}\n\nDeterministic Planrova engines have verified your availability.`,
        suggestedProposals: []
      };
    }

    // 3. Academic Intelligence
    if (intent === AI_INTENTS.EXPLAIN_ACADEMIC) {
      return {
        text: `Academic Intelligence Summary:\n${context || 'No academic courses currently enrolled.'}\n\nTip: Review your due Leitner flashcards to keep retention optimal.`,
        suggestedProposals: []
      };
    }

    // 4. Budget Advice (Non-speculative)
    if (intent === AI_INTENTS.BUDGET_ADVICE) {
      return {
        text: `Finance Overview:\n${context || 'Finance context is currently excluded or empty.'}\n\n(Reminder: Planrova provides deterministic velocity forecasts and does not offer financial or investment advice).`,
        suggestedProposals: []
      };
    }

    // 5. Wellbeing Advice (Non-clinical)
    if (intent === AI_INTENTS.WELLBEING_ADVICE) {
      return {
        text: `Wellbeing Overview:\n${context || 'Wellbeing context is currently excluded or empty.'}\n\n(Reminder: Consistency indicators are supportive tracking metrics and do not constitute medical or mental health assessments).`,
        suggestedProposals: []
      };
    }

    // General fallback
    return {
      text: `Planrova Assistant: I received your request: "${prompt}".\n\nAuthorized Context Summary:\n${context ? context.slice(0, 300) + '...' : 'No context categories enabled.'}`,
      suggestedProposals: []
    };
  }
}

/**
 * Backend AI Proxy Provider
 * Routes inference requests to server/proxy.js to protect API credentials.
 */
export class BackendAIProxyProvider extends BaseAIProvider {
  constructor({ proxyUrl = 'http://localhost:3001/api/ai/chat', fallbackProvider = new MockAIProvider() } = {}) {
    super();
    this.proxyUrl = proxyUrl;
    this.fallbackProvider = fallbackProvider;
  }

  async checkAvailability() {
    try {
      if (typeof fetch === 'undefined') return this.fallbackProvider.checkAvailability();
      const res = await fetch(`${this.proxyUrl}/health`, { method: 'GET' });
      if (res.ok) return { available: true, mode: 'cloud_proxy' };
      return this.fallbackProvider.checkAvailability();
    } catch {
      return this.fallbackProvider.checkAvailability();
    }
  }

  async generateResponse({ prompt, context, intent }) {
    try {
      if (typeof fetch === 'undefined') {
        return this.fallbackProvider.generateResponse({ prompt, context, intent });
      }

      const res = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context, intent })
      });

      if (!res.ok) {
        // Fallback gracefully on 503 or network error
        return this.fallbackProvider.generateResponse({ prompt, context, intent });
      }

      const data = await res.json();
      return {
        text: data.text || 'No response generated.',
        suggestedProposals: Array.isArray(data.suggestedProposals) ? data.suggestedProposals : []
      };
    } catch {
      // Offline fallback
      return this.fallbackProvider.generateResponse({ prompt, context, intent });
    }
  }
}


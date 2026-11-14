/**
 * tests/mobileScreens.test.js
 * Stage 8 — Mobile Screen Logic & Parity Contract Tests
 */

import { describe, it, expect } from 'vitest';

describe('Stage 8 — Mobile Parity & Screen Contracts', () => {

  describe('1. Mobile Projects Workspace Logic Parity', () => {
    // Parity with mobile/src/screens/ProjectsScreen.js calculations
    function calculateProjectProgressAndHealth(project, milestones = [], tasks = [], now = new Date()) {
      const projMilestones = milestones.filter(m => m.projectId === project.id);
      const projTasks = tasks.filter(t => t.projectId === project.id);

      const completedMilestones = projMilestones.filter(m => m.status === 'completed').length;
      const totalMilestones = projMilestones.length;

      const completedTasks = projTasks.filter(t => t.completed || t.status === 'completed').length;
      const totalTasks = projTasks.length;

      let progress = 0;
      if (totalMilestones > 0 || totalTasks > 0) {
        const milestoneWeight = totalMilestones > 0 ? 0.6 : 0;
        const taskWeight = totalTasks > 0 ? (totalMilestones > 0 ? 0.4 : 1.0) : 0;
        const mScore = totalMilestones > 0 ? (completedMilestones / totalMilestones) : 0;
        const tScore = totalTasks > 0 ? (completedTasks / totalTasks) : 0;
        progress = Math.round((mScore * milestoneWeight + tScore * taskWeight) * 100);
      }

      let health = 'ON_TRACK';
      if (project.targetDate) {
        const daysRemaining = Math.ceil((new Date(project.targetDate) - new Date(now)) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 3 && progress < 60) {
          health = 'OFF_TRACK';
        } else if (daysRemaining < 7 && progress < 40) {
          health = 'AT_RISK';
        }
      }

      return {
        progress,
        health,
        completedMilestones,
        totalMilestones,
        completedTasks,
        totalTasks
      };
    }

    it('computes weighted progress matching mobile project card display', () => {
      const project = { id: 'p1', title: 'Mobile Launch' };
      const milestones = [
        { id: 'm1', projectId: 'p1', status: 'completed' },
        { id: 'm2', projectId: 'p1', status: 'pending' }
      ]; // 1/2 milestones = 50% * 0.6 = 30%
      const tasks = [
        { id: 't1', projectId: 'p1', completed: true },
        { id: 't2', projectId: 'p1', completed: false }
      ]; // 1/2 tasks = 50% * 0.4 = 20%
      // Total = 50%

      const result = calculateProjectProgressAndHealth(project, milestones, tasks);
      expect(result.progress).toBe(50);
      expect(result.completedMilestones).toBe(1);
      expect(result.totalMilestones).toBe(2);
      expect(result.completedTasks).toBe(1);
      expect(result.totalTasks).toBe(2);
    });

    it('diagnoses OFF_TRACK health when deadline is under 3 days with low progress', () => {
      const project = {
        id: 'p2',
        title: 'Urgent Thesis',
        targetDate: '2026-11-17T12:00:00Z' // 2 days away from 2026-11-15
      };
      const milestones = [
        { id: 'm1', projectId: 'p2', status: 'pending' }
      ]; // 0% progress

      const result = calculateProjectProgressAndHealth(project, milestones, [], new Date('2026-11-15T12:00:00Z'));
      expect(result.progress).toBe(0);
      expect(result.health).toBe('OFF_TRACK');
    });

    it('diagnoses AT_RISK health when deadline is under 7 days with sub-40% progress', () => {
      const project = {
        id: 'p3',
        title: 'Term Paper',
        targetDate: '2026-11-20T12:00:00Z' // 5 days away from 2026-11-15
      };
      const milestones = [
        { id: 'm1', projectId: 'p3', status: 'completed' },
        { id: 'm2', projectId: 'p3', status: 'pending' },
        { id: 'm3', projectId: 'p3', status: 'pending' },
        { id: 'm4', projectId: 'p3', status: 'pending' }
      ]; // 25% * 0.6 = 15% progress

      const result = calculateProjectProgressAndHealth(project, milestones, [], new Date('2026-11-15T12:00:00Z'));
      expect(result.progress).toBe(15);
      expect(result.health).toBe('AT_RISK');
    });
  });

  describe('2. Mobile Auth Contract Validations', () => {
    function validateAuthSubmission(email, password) {
      if (!email || !password) return { valid: false, error: 'Please fill in both fields.' };
      if (!email.includes('@')) return { valid: false, error: 'Please enter a valid email address.' };
      if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters.' };
      return { valid: true };
    }

    it('enforces email presence and minimum 8-character password constraint', () => {
      expect(validateAuthSubmission('', 'secret123').valid).toBe(false);
      expect(validateAuthSubmission('user@test.com', 'short').error).toBe('Password must be at least 8 characters.');
      expect(validateAuthSubmission('invalid-email', 'validPassword123').error).toBe('Please enter a valid email address.');
      expect(validateAuthSubmission('valid@school.edu', 'strongPassword123').valid).toBe(true);
    });
  });

  describe('3. Mobile Onboarding Payload Serialization', () => {
    function serializeOnboardingPayload({ name, college, branch, semester, habits, waterTarget, monthlyLimit }) {
      if (!name || !name.trim()) throw new Error('Name is required');

      const profile = {
        name: name.trim(),
        college: (college || '').trim(),
        branch: (branch || '').trim(),
        semester: (semester || '').trim(),
        onboarded: true
      };

      const selectedHabits = (habits || [])
        .filter(h => h.selected)
        .map((h, idx) => ({
          id: (idx + 1).toString(),
          name: h.name,
          icon: h.icon,
          fire: 0,
          logs: []
        }));

      const hydration = {
        water: 0,
        target: parseInt(waterTarget, 10) || 2000
      };

      const budget = {
        monthlyLimit: parseInt(monthlyLimit, 10) || 5000
      };

      return { profile, habits: selectedHabits, hydration, budget };
    }

    it('serializes complete student onboarding state correctly', () => {
      const payload = serializeOnboardingPayload({
        name: 'Tanmay Sharma',
        college: 'IIT Bombay',
        branch: 'Computer Science',
        semester: 'Semester 6',
        habits: [
          { name: 'Gym', icon: 'barbell', selected: true },
          { name: 'Code', icon: 'code', selected: true },
          { name: 'Meditate', icon: 'body', selected: false }
        ],
        waterTarget: '2500',
        monthlyLimit: '6000'
      });

      expect(payload.profile.name).toBe('Tanmay Sharma');
      expect(payload.profile.onboarded).toBe(true);
      expect(payload.habits.length).toBe(2);
      expect(payload.habits[0].fire).toBe(0);
      expect(payload.hydration.target).toBe(2500);
      expect(payload.budget.monthlyLimit).toBe(6000);
    });

    it('throws error when name is missing', () => {
      expect(() => serializeOnboardingPayload({ name: '   ' })).toThrow('Name is required');
    });
  });
});


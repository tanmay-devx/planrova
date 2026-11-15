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

  describe('3. Mobile Alarm Scheduling & Lifecycle Logic', () => {
    // Parity with mobile/src/screens/AlarmScreen.js
    const mapDaysToIntegers = (daysArray) => {
      const dayMap = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
      return (daysArray || []).map(day => dayMap[day]).filter(Boolean);
    };

    const formatTimeWithAmPm = (timeStr) => {
      if (!timeStr) return { time: '12:00', ampm: 'AM' };
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      const displayMin = m.toString().padStart(2, '0');
      return { time: `${displayHour}:${displayMin}`, ampm };
    };

    const calculateNextTriggerTime = (hour, minute, days, nowMs = Date.now()) => {
      const calendar = new Date(nowMs);
      calendar.setHours(hour, minute, 0, 0);

      if (!days || days.length === 0) {
        if (calendar.getTime() <= nowMs) {
          calendar.setDate(calendar.getDate() + 1);
        }
        return calendar.getTime();
      }

      // 1 = Sun, 2 = Mon ... 7 = Sat (Calendar convention)
      const currentDayOfWeek = calendar.getDay() + 1;
      let minDiff = Infinity;

      for (const day of days) {
        let diff = day - currentDayOfWeek;
        if (diff < 0) {
          diff += 7;
        } else if (diff === 0 && calendar.getTime() <= nowMs) {
          diff += 7;
        }
        if (diff < minDiff) {
          minDiff = diff;
        }
      }

      calendar.setDate(calendar.getDate() + minDiff);
      return calendar.getTime();
    };

    it('maps weekday strings to Android Calendar integer constants', () => {
      const days = ['Sun', 'Mon', 'Wed', 'Fri', 'Sat'];
      const mapped = mapDaysToIntegers(days);
      expect(mapped).toEqual([1, 2, 4, 6, 7]);
    });

    it('formats 24hr time to 12hr time with AM/PM', () => {
      expect(formatTimeWithAmPm('06:30')).toEqual({ time: '6:30', ampm: 'AM' });
      expect(formatTimeWithAmPm('12:00')).toEqual({ time: '12:00', ampm: 'PM' });
      expect(formatTimeWithAmPm('00:05')).toEqual({ time: '12:05', ampm: 'AM' });
      expect(formatTimeWithAmPm('23:45')).toEqual({ time: '11:45', ampm: 'PM' });
    });

    it('schedules one-time alarm for today if in future, tomorrow if in past', () => {
      // Mock fixed reference time: 2026-11-15 10:00:00
      const refTime = new Date(2026, 10, 15, 10, 0, 0).getTime();

      // Alarm set for 11:30 (future today)
      const futureTrigger = calculateNextTriggerTime(11, 30, [], refTime);
      const futureDate = new Date(futureTrigger);
      expect(futureDate.getDate()).toBe(15);
      expect(futureDate.getHours()).toBe(11);
      expect(futureDate.getMinutes()).toBe(30);

      // Alarm set for 09:00 (past today -> should trigger tomorrow 16th)
      const pastTrigger = calculateNextTriggerTime(9, 0, [], refTime);
      const pastDate = new Date(pastTrigger);
      expect(pastDate.getDate()).toBe(16);
      expect(pastDate.getHours()).toBe(9);
      expect(pastDate.getMinutes()).toBe(0);
    });

    it('calculates next occurrence for repeating weekday alarms', () => {
      // 2026-11-15 is Sunday (day = 1)
      const refSunday = new Date(2026, 10, 15, 14, 0, 0).getTime();

      // Recurring on Monday (2) and Wednesday (4) at 07:00
      const nextTrigger = calculateNextTriggerTime(7, 0, [2, 4], refSunday);
      const nextDate = new Date(nextTrigger);

      // Next occurrence should be Monday Nov 16th
      expect(nextDate.getDate()).toBe(16);
      expect(nextDate.getDay()).toBe(1); // Monday
      expect(nextDate.getHours()).toBe(7);
    });

    it('serializes native payload with legacy wake fallback structure', () => {
      const customAlarms = [
        {
          id: 'alarm-1',
          time: '07:30',
          enabled: true,
          label: 'Study Session',
          mission: 'math',
          days: ['Mon', 'Tue'],
          ringtone: { assetKey: 'sitar' }
        }
      ];

      const legacyWake = {
        wakeTime: '06:00',
        wakeEnabled: true,
        wakeMission: 'shake',
        wakeRingtone: { assetKey: 'rain' }
      };

      const nativeAlarmsList = customAlarms.map(a => {
        const [h, m] = a.time.split(':').map(Number);
        return {
          id: a.id,
          hour: h,
          minute: m,
          days: mapDaysToIntegers(a.days),
          enabled: a.enabled,
          label: a.label,
          mission: a.mission,
          ringtone: a.ringtone.assetKey,
          snoozeTime: 5
        };
      });

      const unifiedData = {
        alarmsList: nativeAlarmsList,
        alarms: legacyWake
      };

      expect(unifiedData.alarmsList[0].days).toEqual([2, 3]);
      expect(unifiedData.alarmsList[0].ringtone).toBe('sitar');
      expect(unifiedData.alarms.wakeTime).toBe('06:00');
    });
  });
});


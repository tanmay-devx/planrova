/**
 * Planrova 2.0 — Universal Global Search Engine
 * Pure, high-performance search across all canonical domains:
 * Tasks, Notes, Academic Courses, Assessments, Syllabus Topics,
 * Finance Transactions, Budgets, Habits, and System Actions.
 */

/**
 * Executes universal search across all domains.
 * @param {object} params
 * @returns {Array<object>} Categorized search results
 */
export function searchUniversal({
  query = '',
  tasks = [],
  notes = [],
  courses = [],
  assessments = [],
  syllabusTopics = [],
  transactions = [],
  budgets = [],
  habits = [],
  actions = []
}) {
  const q = (query || '').toLowerCase().trim();

  // If query is empty, return default top actions + recent active items
  if (!q) {
    const defaultActions = actions.slice(0, 5);
    const recentTasks = tasks
      .filter(t => !t.deleted && !t.completed)
      .slice(0, 3)
      .map(t => ({
        id: `task_${t.id}`,
        rawId: t.id,
        type: 'task',
        category: 'Tasks',
        icon: '✓',
        title: t.title,
        desc: `Task · Due ${t.dueDate || t.date || 'Today'} · Priority: ${t.priority || 'medium'}`,
        targetView: 'weekly'
      }));

    const recentNotes = notes
      .filter(n => !n.deleted)
      .slice(0, 2)
      .map(n => ({
        id: `note_${n.id || n.date}`,
        rawId: n.date,
        type: 'note',
        category: 'Notes',
        icon: '📝',
        title: n.title || 'Untitled Note',
        desc: `Note for ${n.date || 'Recent'}`,
        targetView: 'notes'
      }));

    return [...defaultActions, ...recentTasks, ...recentNotes];
  }

  const results = [];

  // 1. Actions Search
  actions.forEach(a => {
    if (a.title.toLowerCase().includes(q) || (a.desc && a.desc.toLowerCase().includes(q))) {
      results.push({
        ...a,
        category: 'Navigation & Commands'
      });
    }
  });

  // 2. Tasks Search
  tasks.forEach(t => {
    if (t.deleted) return;
    const matchTitle = t.title && t.title.toLowerCase().includes(q);
    const matchDesc = t.desc && t.desc.toLowerCase().includes(q);
    const matchCategory = t.category && t.category.toLowerCase().includes(q);

    if (matchTitle || matchDesc || matchCategory) {
      results.push({
        id: `task_${t.id}`,
        rawId: t.id,
        type: 'task',
        category: 'Tasks',
        icon: t.completed ? '☑' : '✓',
        title: t.title,
        desc: `${t.completed ? 'Completed' : 'Pending'} · Due ${t.dueDate || t.date || 'Anytime'} · ${t.category || 'General'}`,
        targetView: 'weekly'
      });
    }
  });

  // 3. Notes Search
  notes.forEach(n => {
    if (n.deleted) return;
    const matchTitle = n.title && n.title.toLowerCase().includes(q);
    const matchContent = (n.content && n.content.toLowerCase().includes(q)) || (n.text && n.text.toLowerCase().includes(q));
    const matchSubject = n.subject && n.subject.toLowerCase().includes(q);

    if (matchTitle || matchContent || matchSubject) {
      results.push({
        id: `note_${n.id || n.date}`,
        rawId: n.date,
        type: 'note',
        category: 'Notes',
        icon: '📝',
        title: n.title || 'Untitled Note',
        desc: `Subject: ${n.subject || 'General'} · ${n.date || ''}`,
        targetView: 'notes'
      });
    }
  });

  // 4. Academic Courses Search
  courses.forEach(c => {
    if (c.deleted) return;
    const matchCode = c.code && c.code.toLowerCase().includes(q);
    const matchName = c.name && c.name.toLowerCase().includes(q);
    const matchInstructor = c.instructor && c.instructor.toLowerCase().includes(q);

    if (matchCode || matchName || matchInstructor) {
      results.push({
        id: `course_${c.id}`,
        rawId: c.id,
        type: 'course',
        category: 'Academic Courses',
        icon: '🎓',
        title: `${c.code ? c.code + ': ' : ''}${c.name}`,
        desc: `Course · ${c.credits || 3} Credits · ${c.instructor || 'Staff'}`,
        targetView: 'academic'
      });
    }
  });

  // 5. Academic Assessments Search
  assessments.forEach(a => {
    if (a.deleted) return;
    const matchTitle = a.title && a.title.toLowerCase().includes(q);
    const matchCourse = a.courseCode && a.courseCode.toLowerCase().includes(q);
    const matchType = a.type && a.type.toLowerCase().includes(q);

    if (matchTitle || matchCourse || matchType) {
      results.push({
        id: `assessment_${a.id}`,
        rawId: a.id,
        type: 'assessment',
        category: 'Academic Assessments',
        icon: '📑',
        title: a.title,
        desc: `${a.courseCode || 'Course'} · ${a.type || 'Exam'} · Due: ${a.dueDate || 'Upcoming'}`,
        targetView: 'academic'
      });
    }
  });

  // 6. Syllabus Topics Search
  syllabusTopics.forEach(top => {
    if (top.deleted) return;
    const matchTitle = top.title && top.title.toLowerCase().includes(q);
    const matchCourse = top.courseCode && top.courseCode.toLowerCase().includes(q);

    if (matchTitle || matchCourse) {
      results.push({
        id: `topic_${top.id}`,
        rawId: top.id,
        type: 'topic',
        category: 'Syllabus Topics',
        icon: '📚',
        title: top.title,
        desc: `Syllabus Topic · ${top.courseCode || 'Academic'} · Status: ${top.status || 'pending'}`,
        targetView: 'academic'
      });
    }
  });

  // 7. Finance Transactions & Budgets Search
  transactions.forEach(txn => {
    if (txn.deleted) return;
    const matchTitle = (txn.title && txn.title.toLowerCase().includes(q)) || (txn.description && txn.description.toLowerCase().includes(q));
    const matchCategory = txn.category && txn.category.toLowerCase().includes(q);

    if (matchTitle || matchCategory) {
      results.push({
        id: `txn_${txn.id}`,
        rawId: txn.id,
        type: 'transaction',
        category: 'Finance Transactions',
        icon: txn.type === 'income' ? '💵' : '💳',
        title: txn.title || txn.description || 'Transaction',
        desc: `${txn.type === 'income' ? 'Income' : 'Expense'} · $${Number(txn.amount || 0).toFixed(2)} · ${txn.category || 'General'}`,
        targetView: 'finance'
      });
    }
  });

  // 8. Habits Search
  habits.forEach(h => {
    if (h.archived || h.deleted) return;
    const matchName = h.name && h.name.toLowerCase().includes(q);
    const matchCategory = h.category && h.category.toLowerCase().includes(q);

    if (matchName || matchCategory) {
      results.push({
        id: `habit_${h.id}`,
        rawId: h.id,
        type: 'habit',
        category: 'Habits',
        icon: '🔥',
        title: h.name,
        desc: `Daily Habit · ${h.category || 'Consistency'}`,
        targetView: 'wellbeing'
      });
    }
  });

  return results;
}


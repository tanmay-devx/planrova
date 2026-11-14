/**
 * shared/domain/relationships/entity-links.js
 * Bidirectional Relationship Manager for Notes and Tasks in Planrova 2.0
 */

/**
 * Links a note and a task bidirectionally without duplicates.
 * Returns { note: updatedNote, task: updatedTask, modified: boolean }
 */
export function linkNoteAndTask(note, task) {
  if (!note || !task || !note.id || !task.id) {
    return { note, task, modified: false };
  }

  const noteTasks = Array.isArray(note.linkedTaskIds) ? [...note.linkedTaskIds] : [];
  const taskNotes = Array.isArray(task.linkedNoteIds) ? [...task.linkedNoteIds] : [];

  let modified = false;

  if (!noteTasks.includes(task.id)) {
    noteTasks.push(task.id);
    modified = true;
  }

  if (!taskNotes.includes(note.id)) {
    taskNotes.push(note.id);
    modified = true;
  }

  const now = Date.now();
  const updatedNote = {
    ...note,
    linkedTaskIds: noteTasks,
    linkedTasks: noteTasks, // backward compatibility
    updatedAt: modified ? now : (note.updatedAt || now)
  };

  const updatedTask = {
    ...task,
    linkedNoteIds: taskNotes,
    updatedAt: modified ? now : (task.updatedAt || now)
  };

  return { note: updatedNote, task: updatedTask, modified };
}

/**
 * Unlinks a note and a task bidirectionally.
 * Returns { note: updatedNote, task: updatedTask, modified: boolean }
 */
export function unlinkNoteAndTask(note, task) {
  if (!note || !task || !note.id || !task.id) {
    return { note, task, modified: false };
  }

  const noteTasks = Array.isArray(note.linkedTaskIds) 
    ? note.linkedTaskIds.filter(id => id !== task.id)
    : [];

  const taskNotes = Array.isArray(task.linkedNoteIds)
    ? task.linkedNoteIds.filter(id => id !== note.id)
    : [];

  const modified = 
    (note.linkedTaskIds && note.linkedTaskIds.length !== noteTasks.length) ||
    (task.linkedNoteIds && task.linkedNoteIds.length !== taskNotes.length);

  const now = Date.now();
  const updatedNote = {
    ...note,
    linkedTaskIds: noteTasks,
    linkedTasks: noteTasks,
    updatedAt: modified ? now : (note.updatedAt || now)
  };

  const updatedTask = {
    ...task,
    linkedNoteIds: taskNotes,
    updatedAt: modified ? now : (task.updatedAt || now)
  };

  return { note: updatedNote, task: updatedTask, modified };
}

/**
 * Returns all active (non-deleted) tasks linked to a given note.
 */
export function getLinkedTasksForNote(note, allTasks = []) {
  if (!note || !Array.isArray(note.linkedTaskIds) || note.linkedTaskIds.length === 0) {
    return [];
  }
  const idSet = new Set(note.linkedTaskIds);
  return allTasks.filter(t => t && idSet.has(t.id) && !t.deleted);
}

/**
 * Returns all active (non-deleted) notes linked to a given task.
 */
export function getLinkedNotesForTask(task, allNotes = []) {
  if (!task || !Array.isArray(task.linkedNoteIds) || task.linkedNoteIds.length === 0) {
    return [];
  }
  const idSet = new Set(task.linkedNoteIds);
  return allNotes.filter(n => n && idSet.has(n.id) && !n.deleted);
}

/**
 * Safely removes references to a deleted entity from referencing entities.
 * type: 'task' | 'note'
 */
export function cleanupDeletedEntityLinks(deletedType, deletedId, entities = []) {
  if (!deletedId || !Array.isArray(entities)) return entities;
  
  const now = Date.now();

  return entities.map(entity => {
    if (!entity) return entity;
    
    if (deletedType === 'task' && Array.isArray(entity.linkedTaskIds) && entity.linkedTaskIds.includes(deletedId)) {
      const nextIds = entity.linkedTaskIds.filter(id => id !== deletedId);
      return {
        ...entity,
        linkedTaskIds: nextIds,
        linkedTasks: nextIds,
        updatedAt: now
      };
    }

    if (deletedType === 'note' && Array.isArray(entity.linkedNoteIds) && entity.linkedNoteIds.includes(deletedId)) {
      const nextIds = entity.linkedNoteIds.filter(id => id !== deletedId);
      return {
        ...entity,
        linkedNoteIds: nextIds,
        updatedAt: now
      };
    }

    return entity;
  });
}


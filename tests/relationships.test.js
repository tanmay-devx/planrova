import { describe, it, expect } from 'vitest';
import { 
  linkNoteAndTask, 
  unlinkNoteAndTask, 
  getLinkedTasksForNote, 
  getLinkedNotesForTask, 
  cleanupDeletedEntityLinks 
} from '../shared/domain/relationships/entity-links.js';
import { normalizeNote } from '../shared/domain/entities/note.schema.js';
import { normalizeTask } from '../shared/domain/entities/task.schema.js';

describe('Note-Task Bidirectional Relationship System', () => {
  it('establishes bidirectional links without duplicates', () => {
    let note = normalizeNote({ id: 'note_os', title: 'Operating Systems' });
    let task = normalizeTask({ id: 'task_threads', title: 'Implement Thread Pool' });

    const result = linkNoteAndTask(note, task);
    expect(result.modified).toBe(true);

    note = result.note;
    task = result.task;

    expect(note.linkedTaskIds).toContain('task_threads');
    expect(task.linkedNoteIds).toContain('note_os');

    // Linking again should be idempotent and not create duplicate entries
    const repeatResult = linkNoteAndTask(note, task);
    expect(repeatResult.modified).toBe(false);
    expect(repeatResult.note.linkedTaskIds.length).toBe(1);
    expect(repeatResult.task.linkedNoteIds.length).toBe(1);
  });

  it('unlinks relationships bidirectionally', () => {
    let note = normalizeNote({ id: 'n1', linkedTaskIds: ['t1'] });
    let task = normalizeTask({ id: 't1', linkedNoteIds: ['n1'] });

    const result = unlinkNoteAndTask(note, task);
    expect(result.modified).toBe(true);
    expect(result.note.linkedTaskIds).not.toContain('t1');
    expect(result.task.linkedNoteIds).not.toContain('n1');
  });

  it('resolves active linked entities and filters out deleted items', () => {
    const note = normalizeNote({ id: 'n1', linkedTaskIds: ['t1', 't2', 't3'] });
    const tasks = [
      normalizeTask({ id: 't1', title: 'Task 1' }),
      normalizeTask({ id: 't2', title: 'Task 2', deleted: true }), // deleted task
      normalizeTask({ id: 't4', title: 'Unrelated Task' })
    ];

    const linkedTasks = getLinkedTasksForNote(note, tasks);
    expect(linkedTasks.length).toBe(1);
    expect(linkedTasks[0].id).toBe('t1');
  });

  it('cleans up links when an entity is deleted', () => {
    const notes = [
      normalizeNote({ id: 'n1', linkedTaskIds: ['t_target', 't_other'] }),
      normalizeNote({ id: 'n2', linkedTaskIds: ['t_other'] })
    ];

    const cleanedNotes = cleanupDeletedEntityLinks('task', 't_target', notes);
    expect(cleanedNotes[0].linkedTaskIds).toEqual(['t_other']);
    expect(cleanedNotes[1].linkedTaskIds).toEqual(['t_other']);
  });
});


/**
 * shared/domain/index.js
 * Central Entry Point for Planrova 2.0 Canonical Domain Layer
 */

// Schemas & Validation
export * from './entities/task.schema.js';
export * from './entities/note.schema.js';
export * from './entities/habit.schema.js';
export * from './entities/expense.schema.js';
export * from './entities/reminder.schema.js';
export * from './entities/calendar-event.schema.js';

// Universal Capture
export * from './capture/capture.schema.js';
export * from './capture/capture.classifier.js';
export * from './capture/capture.parser.js';
export * from './capture/capture.normalizer.js';

// Relationships
export * from './relationships/entity-links.js';

// Migrations
export * from './migrations/habit.migration.js';


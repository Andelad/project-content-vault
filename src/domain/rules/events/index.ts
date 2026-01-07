/**
 * Event Rules Module
 * 
 * Centralized exports for all event-related business rules.
 * 
 * Note: Entity name is "Event" but database table is "calendar_events".
 * This will be abstracted by data mappers in Phase 2.
 * 
 * Structure:
 * - EventValidation.ts - Core validation logic (from CalendarEventRules.ts)
 * - EventClassification.ts - Planned vs completed logic (from EventClassificationRules.ts)
 * - EventRecurrence.ts - Recurring event logic (TODO: extract from unified services)
 */

// Re-export all event rules
export * from './EventValidation';
export * from './EventClassification';

// TODO: Create EventRecurrence.ts for recurring event logic

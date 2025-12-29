/**
 * Domain Rules - Export Barrel
 * 
 * Centralized exports for all business rules.
 * These are the single source of truth for business logic.
 * 
 * Architecture Note:
 * - Pure domain rules (no view dependencies): EventClassificationRules, ProjectRules, etc.
 * - View-specific rules: TimelineRules (contains Timeline View display constraints)
 */

export * from './ProjectRules';
export * from './MilestoneRules';
export * from './PhaseRules';
export * from './RelationshipRules';
export * from './EventClassificationRules'; // Pure domain event classification
export * from './TimelineRules';            // Timeline View-specific display rules
export * from './ClientRules';
export * from './LabelRules';
export * from './GroupRules';
export * from './CalendarEventRules';
export * from './WorkSlotRules';
export * from './HolidayRules';

/**
 * Domain Rules - Export Barrel
 * 
 * Centralized exports for all business rules.
 * These are the single source of truth for business logic.
 * 
 * Architecture Note:
 * - Pure domain rules (no view dependencies): Project, Phase, Event rules, etc.
 * - Cross-cutting rules: sync/ module (phase/project date/budget synchronization)
 * - Referential integrity: integrity/ module (foreign key validation, orphan detection)
 * - Cascade analysis: cascade/ module (deletion impact preview)
 * - View-specific rules: timeline/ module (Timeline View display constraints)
 */

export * from './projects'; // Project rules (ProjectValidation + ProjectBudget)
export * from './phases/PhaseRules'; // Phase rules (re-export barrel for validation, budget, hierarchy)
export * from './sync'; // Cross-cutting sync rules (DateSync + BudgetSync)
export * from './integrity'; // Entity integrity and orphan detection
export * from './cascade'; // Deletion impact analysis
export * from './events'; // Event rules (EventValidation + EventClassification)
export * from './timeline'; // Timeline View-specific display rules
export * from './clients'; // Client and Label rules
export * from './work-slots'; // Work slot rules
export * from './time-tracking'; // Time tracking business logic helpers

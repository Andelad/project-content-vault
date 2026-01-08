/**
 * Domain Rules - Export Barrel
 * 
 * Centralized exports for all business rules.
 * These are the single source of truth for business logic.
 * 
 * Architecture Note:
 * - Pure domain rules (no view dependencies): Project, Phase, Event rules, etc.
 * - Cross-entity sync: ProjectPhaseSync (phase/project date/budget synchronization)
 * - System integrity: SystemIntegrity (referential integrity validation)
 * - View-specific rules: timeline/ module (Timeline View display constraints)
 */

export * from './projects'; // Project rules (ProjectValidation + ProjectBudget + ProjectIntegrity + ProjectDeletionImpact)
export * from './phases/PhaseRules'; // Phase rules (re-export barrel for validation, budget, hierarchy)
export * from './ProjectPhaseSync'; // Cross-entity sync rules (DateSync + BudgetSync)
export { SystemIntegrity } from './SystemIntegrity'; // System integrity (explicit export to avoid type collision)
export type { SystemIntegrityCheck } from './SystemIntegrity';
export * from './events'; // Event rules (EventValidation + EventClassification)
export * from './timeline'; // Timeline View-specific display rules
export * from './clients'; // Client and Label rules + ClientDeletionImpact
export * from './groups'; // Group rules + GroupDeletionImpact
export * from './work-slots'; // Work slot rules
export * from './time-tracking'; // Time tracking business logic helpers

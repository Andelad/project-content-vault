/**
 * Phase Rules Module
 * 
 * Centralized exports for all phase-related business rules.
 * 
 * Structure:
 * - PhaseRecurrence.ts - Recurring phase logic (migrated from domain-services) ✅
 * - PhaseDistribution.ts - Distribution algorithms (migrated from domain-services) ✅
 * - Parent PhaseRules.ts - Validation, budget, hierarchy (keeping consolidated for now)
 * 
 * Note: PhaseRules.ts in parent directory is large (1193 lines) but well-organized.
 * Splitting it is not a priority since it already delegates to the services above.
 * If needed later, we can extract: PhaseValidation, PhaseBudget, PhaseHierarchy
 */

// Migrated domain services
export * from './PhaseRecurrence';
export * from './PhaseDistribution';

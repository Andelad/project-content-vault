/**
 * Domain Layer - Single Source of Truth for Business Logic
 * 
 * This is the heart of the application's business logic.
 * All business rules, validations, and domain constraints are defined here.
 * 
 * Other layers (services, validators, contexts) should delegate to these rules
 * rather than duplicating business logic.
 * 
 * @see docs/core/Business Logic.md for complete documentation
 * @see docs/core/BUSINESS_LOGIC_AUDIT.md for migration information
 */

// ============================================================================
// BUSINESS RULES - Single Source of Truth
// ============================================================================

export * from './rules';

// ============================================================================
// DOMAIN SERVICES - Pure Domain Logic (MIGRATED TO domain/rules/)
// ============================================================================

// MIGRATION NOTE (January 2026): Domain services have been merged into domain/rules/
// - PhaseRecurrenceService → domain/rules/phases/PhaseRecurrence
// - ProjectBudgetService → domain/rules/projects/ProjectBudget
// - PhaseDistributionService → domain/rules/phases/PhaseDistribution
// These are now re-exported through the rules modules
// export * from './domain-services'; // DEPRECATED - will be deleted

// ============================================================================
// DOMAIN ENTITIES - Phase 3 (Future)
// ============================================================================

// TODO: Phase 3 - Domain entities with business methods
// export * from './entities';

// ============================================================================
// VALUE OBJECTS - Immutable Domain Primitives
// ============================================================================

export * from './value-objects';

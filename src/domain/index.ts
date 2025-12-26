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
// DOMAIN ENTITIES - Phase 3 (Future)
// ============================================================================

// TODO: Phase 3 - Domain entities with business methods
// export * from './entities';

// ============================================================================
// VALUE OBJECTS - Phase 3 (Future)
// ============================================================================

// TODO: Phase 3 - Immutable value types
// export * from './value-objects';

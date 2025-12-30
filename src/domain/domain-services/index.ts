/**
 * Domain Services
 * 
 * Pure domain logic that doesn't naturally fit within a single entity.
 * 
 * Domain Services vs Application Services (Orchestrators):
 * - Domain Services: Pure business logic, no external dependencies
 * - Application Services: Coordinate entities, persistence, external systems
 * 
 * Examples:
 * - PhaseRecurrenceService: Recurring phase patterns and calculations
 * - ProjectBudgetService: Budget analysis across phases
 * - PhaseDistributionService: Time distribution and spacing algorithms
 */

export * from './PhaseRecurrenceService';
export * from './ProjectBudgetService';
export * from './PhaseDistributionService';

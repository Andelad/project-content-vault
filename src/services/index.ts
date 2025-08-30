/**
 * Central Services Index
 * Feature-based service organization with barrel exports
 * 
 * 🚨 ARCHITECTURAL RULE: ALL CALCULATIONS MUST USE THESE SERVICES
 * 
 * ❌ DON'T add calculations to:
 *    - Components (render logic only)
 *    - Hooks (state management only) 
 *    - Utils (use these services instead)
 *
 * ✅ Feature-organized services:
 */

// Core domain entities (NEW: Domain-driven design)
export * from './core/domain/MilestoneEntity';
export * from './core/domain/ProjectEntity';
export * from './core/domain/PauseEntity';

// Business orchestrators (NEW: Domain-driven design)
export * from './milestones/MilestoneOrchestrator';
export * from './projects/ProjectOrchestrator';

// Feature-based service exports
export * from './calendar';
export * from './events';
export * from './insights';
export * from './milestones';
export * from './plannerV2';
export * from './projects';
export * from './settings';
export * from './timeline';
export * from './tracker';
export * from './work-hours';

// Core services - cross-cutting utilities used across multiple features
export * from './core/CalculationCacheService';
export * from './core/ColorCalculationService';
export * from './core/DateCalculationService';
export { ProjectCalculationService as CoreProjectCalculationService } from './core/ProjectCalculationService';
export * from './core/TimeAllocationService';
export * from './core/calculations/dateCalculations';
export * from './core/infrastructure/dateCache';


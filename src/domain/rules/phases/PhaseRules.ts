/**
 * Phase Business Rules (Re-export Barrel)
 * 
 * MIGRATION NOTE (January 2026):
 * This file is now a re-export barrel for backward compatibility.
 * The actual implementations have been split into focused modules:
 * 
 * - PhaseValidation.ts - All validation rules (dates, time, position, spacing)
 * - PhaseCalculations.ts - Budget calculations and constraints
 * - PhaseHierarchy.ts - Sequencing, continuity, splitting, overlap repair
 * 
 * Components should gradually migrate to importing from specific modules:
 * ```ts
 * // Old (still works):
 * import { PhaseRules } from '@/domain/rules';
 * 
 * // New (preferred):
 * import { PhaseValidationRules } from '@/domain/rules/phases/PhaseValidation';
 * import { PhaseCalculationsRules } from '@/domain/rules/phases/PhaseCalculations';
 * import { PhaseHierarchyRules } from '@/domain/rules/phases/PhaseHierarchy';
 * ```
 * 
 * Key Domain Concepts:
 * - Phase: Has both startDate and endDate (represents a time period)
 * - Milestone (legacy term): Has only endDate/dueDate (represents a deadline)
 * 
 * Budget Model (Mutually Exclusive):
 * 1. Fixed Budget (Default): Project has total hours budget (e.g., 28h)
 *    - Can be single phase (implicit) or split into multiple phases
 *    - Budget validation applies: sum of phases ≤ project budget
 * 
 * 2. Recurring Template: Project has recurring pattern (e.g., 8h/week)
 *    - REPLACES the fixed budget entirely (budget becomes N/A)
 *    - No budget validation - operates independently of project hours
 *    - Cannot coexist with split phases
 * 
 * Created: 2025-11-10 (PhaseRules)
 * Consolidated: 2025-12-29 (merged with PhaseRules)
 * Split: 2026-01-07 (extracted to focused modules, this file is now re-export barrel)
 * 
 * @see docs/MILESTONE_TO_PHASE_MIGRATION_ASSESSMENT.md
 * @see docs/core/Business Logic.md
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { PhaseDTO } from '@/shared/types/core';
import {
  PhaseValidationRules,
  type MilestoneValidationResult,
  type MilestoneDateValidation,
  type MilestoneTimeValidation,
  type PhaseValidationResult,
  type PhaseDateValidation,
  type PhaseTimeValidation,
  type RecurringPhaseRuleConfig
} from './PhaseValidation';
// Import budget/calculation functions
import * as PhaseCalculationsFunctions from './PhaseCalculations';
import {
  PhaseHierarchyRules
} from './PhaseHierarchy';

// Re-export all types from split modules
export type {
  MilestoneValidationResult,
  MilestoneDateValidation,
  MilestoneTimeValidation,
  PhaseValidationResult,
  PhaseDateValidation,
  PhaseTimeValidation,
  RecurringPhaseRuleConfig
};

// Re-export individual classes for easier migration
export { PhaseValidationRules, PhaseHierarchyRules };
// Re-export budget/calculation functions as a namespace for backward compatibility
export { PhaseCalculationsFunctions as PhaseBudgetRules };
export { PhaseCalculationsFunctions as PhaseCalculationsRules };

/**
 * A Phase is a PhaseDTO with a defined start date
 * This creates a time period rather than just a deadline
 */
export type Phase = PhaseDTO & { startDate: Date };

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard: Check if an entity is actually a phase (has a start date)
 * 
 * A phase has both startDate and endDate, representing a time period.
 * A pure milestone only has a deadline (endDate/dueDate).
 * 
 * @param entity - The phase/milestone to check
 * @returns True if the item has a startDate (is a phase)
 * 
 * @example
 * ```ts
 * const items = [phase1, milestone1, phase2];
 * const phases = items.filter(isPhase); // Type-safe Phase[]
 * ```
 */
export function isPhase(entity: PhaseDTO): entity is Phase {
  return entity.startDate !== undefined;
}

/**
 * Type guard: Check if a phase/milestone is a deadline-only entity (no start date)
 * 
 * @param entity - The phase/milestone to check
 * @returns True if the entity does NOT have a startDate
 * 
 * @example
 * ```ts
 * const items = [phase1, deadline1, phase2];
 * const deadlineOnly = items.filter(isDeadlineOnly); // Deadline-only entities
 * ```
 */
export function isDeadlineOnly(entity: PhaseDTO): boolean {
  return entity.startDate === undefined;
}

/**
 * @deprecated Use isDeadlineOnly instead. Kept for backward compatibility.
 */
export const isMilestone = isDeadlineOnly;

// ============================================================================
// FILTERING RULES
// ============================================================================

/**
 * Extract all phases from a mixed array of phases/milestones
 * 
 * Filters for items that have startDate defined and returns them
 * as type-safe Phase[] array.
 * 
 * @param milestones - Array of phases/milestones
 * @returns Array of only phases
 * 
 * @example
 * ```ts
 * const projectItems = project.phases;
 * const phases = getPhases(projectItems);
 * // phases is Phase[] - TypeScript knows they have startDate
 * ```
 */
export function getPhases(phases: PhaseDTO[]): PhaseDTO[] {
  return phases.filter(isPhase);
}

/**
 * Extract all pure milestones (non-phases) from a mixed array
 * 
 * Filters for items that do NOT have startDate defined.
 * 
 * @param milestones - Array of milestones (may include phases)
 * @returns Array of only pure milestones (no startDate)
 * 
 * @example
 * ```ts
 * const projectItems = project.phases;
 * const pureMilestones = getMilestones(projectItems);
 * // These are deadline-only milestones
 * ```
 */
export function getMilestones(phases: PhaseDTO[]): PhaseDTO[] {
  return phases.filter(isDeadlineOnly);
}

// ============================================================================
// SORTING RULES
// ============================================================================

/**
 * Sort phases by end date (ascending)
 * 
 * @param phases - Array of phases to sort
 * @returns Sorted array (earliest end date first)
 */
export function sortPhasesByEndDate(phases: PhaseDTO[]): PhaseDTO[] {
  return [...phases].sort((a, b) => {
    const aDate = new Date(a.endDate).getTime();
    const bDate = new Date(b.endDate).getTime();
    return aDate - bDate;
  });
}

/**
 * Sort phases by start date (ascending)
 * 
 * @param phases - Array of phases to sort
 * @returns Sorted array (earliest start date first)
 */
export function sortPhasesByStartDate(phases: PhaseDTO[]): PhaseDTO[] {
  return [...phases].sort((a, b) => {
    const aDate = new Date(a.startDate).getTime();
    const bDate = new Date(b.startDate).getTime();
    return aDate - bDate;
  });
}

// ============================================================================
// COMBINED OPERATIONS
// ============================================================================

/**
 * Get phases sorted by end date from a mixed milestone array
 * 
 * Combines filtering and sorting in one convenient function.
 * This is the most common operation needed in components.
 * 
 * @param milestones - Array of milestones (may include phases)
 * @returns Sorted array of phases only
 * 
 * @extracted-from ProjectBar.tsx line 755 (inline filter + sort)
 * 
 * @example
 * ```ts
 * // Instead of:
 * const phases = milestones.filter(p => p.endDate !== undefined)
 *   .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());
 * 
 * // Use:
 * const phases = getPhasesSortedByEndDate(phases);
 * ```
 */
export function getPhasesSortedByEndDate(phases: PhaseDTO[]): PhaseDTO[] {
  return sortPhasesByEndDate(getPhases(phases));
}

/**
 * Phase Business Rules Class (Backward Compatibility Wrapper)
 * 
 * This class now delegates all methods to the split modules.
 * New code should use the specific rule classes directly:
 * - PhaseValidationRules
 * - PhaseBudgetRules
 * - PhaseHierarchyRules
 * 
 * @deprecated Import specific rule classes instead
 */
export class PhaseRules {
  // Validation methods - delegate to PhaseValidationRules
  static validateTimeAllocation = PhaseValidationRules.validateTimeAllocation;
  static validateMilestoneDateWithinProject = PhaseValidationRules.validateMilestoneDateWithinProject;
  static validateMilestoneDateRange = PhaseValidationRules.validateMilestoneDateRange;
  static validateRecurringPhase = PhaseValidationRules.validateRecurringPhase;
  static validateMilestoneTime = PhaseValidationRules.validateMilestoneTime;
  static validateMilestone = PhaseValidationRules.validateMilestone;
  static validateMilestonePosition = PhaseValidationRules.validateMilestonePosition;
  static isRecurringPhase = PhaseValidationRules.isRecurringPhase;
  static validatePhaseEndDateNotInPast = PhaseValidationRules.validatePhaseEndDateNotInPast;
  static calculateMinimumPhaseEndDate = PhaseValidationRules.calculateMinimumPhaseEndDate;
  static validatePhaseSpacing = PhaseValidationRules.validatePhaseSpacing;

  // Budget/calculation methods - delegate to PhaseCalculations functions
  static calculateTotalAllocation = PhaseCalculationsFunctions.calculateTotalAllocation;
  static calculateBudgetUtilization = PhaseCalculationsFunctions.calculateBudgetUtilization;
  static calculateRemainingBudget = PhaseCalculationsFunctions.calculateRemainingBudget;
  static calculateAverageMilestoneAllocation = PhaseCalculationsFunctions.calculateAverageMilestoneAllocation;
  
  // Legacy compatibility methods
  static checkBudgetConstraint(phases: PhaseDTO[], projectBudget: number) {
    const totalAllocated = this.calculateTotalAllocation(phases);
    const remaining = this.calculateRemainingBudget(totalAllocated, projectBudget);
    const utilization = this.calculateBudgetUtilization(totalAllocated, projectBudget);
    const overage = Math.max(0, totalAllocated - projectBudget);
    
    return {
      isValid: totalAllocated <= projectBudget,
      totalAllocated,
      projectBudget,
      remaining,
      overage,
      utilization,
      utilizationPercentage: utilization,
      isOverBudget: totalAllocated > projectBudget
    };
  }

  // Hierarchy methods - delegate to PhaseHierarchyRules
  static checkPhaseRecurringExclusivity = PhaseHierarchyRules.checkPhaseRecurringExclusivity;
  static calculatePhaseSplit = PhaseHierarchyRules.calculatePhaseSplit;
  static validatePhasesContinuity = PhaseHierarchyRules.validatePhasesContinuity;
  static calculateNewPhaseDates = PhaseHierarchyRules.calculateNewPhaseDates;
  static repairOverlappingPhases = PhaseHierarchyRules.repairOverlappingPhases;
  static cascadePhaseAdjustments = PhaseHierarchyRules.cascadePhaseAdjustments;
  static sortMilestonesByDate = PhaseHierarchyRules.sortMilestonesByDate;
}

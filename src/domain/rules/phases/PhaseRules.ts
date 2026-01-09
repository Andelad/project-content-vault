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
 * Get phases sorted by end date from a mixed phase array
 * 
 * Combines filtering and sorting in one convenient function.
 * This is the most common operation needed in components.
 * 
 * @param phases - Array of phases
 * @returns Sorted array of phases only
 * 
 * @extracted-from ProjectBar.tsx line 755 (inline filter + sort)
 * 
 * @example
 * ```ts
 * // Instead of:
 * const phases = phases.filter(p => p.endDate !== undefined)
 *   .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());
 * 
 * // Use:
 * const phases = getPhasesSortedByEndDate(phases);
 * ```
 */
export function getPhasesSortedByEndDate(phases: PhaseDTO[]): PhaseDTO[] {
  return sortPhasesByEndDate(phases);
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
  static validatePhaseDateWithinProject = PhaseValidationRules.validatePhaseDateWithinProject;
  static validatePhaseDateRange = PhaseValidationRules.validatePhaseDateRange;
  static validateRecurringPhase = PhaseValidationRules.validateRecurringPhase;
  static validatePhaseTime = PhaseValidationRules.validatePhaseTime;
  static validatePhase = PhaseValidationRules.validatePhase;
  static validatePhasePosition = PhaseValidationRules.validatePhasePosition;
  static isRecurringPhase = PhaseValidationRules.isRecurringPhase;
  static validatePhaseEndDateNotInPast = PhaseValidationRules.validatePhaseEndDateNotInPast;
  static calculateMinimumPhaseEndDate = PhaseValidationRules.calculateMinimumPhaseEndDate;
  static validatePhaseSpacing = PhaseValidationRules.validatePhaseSpacing;

  // Budget/calculation methods - delegate to PhaseCalculations functions
  static calculateTotalAllocation = PhaseCalculationsFunctions.calculateTotalAllocation;
  static calculateBudgetUtilization = PhaseCalculationsFunctions.calculateBudgetUtilization;
  static calculateRemainingBudget = PhaseCalculationsFunctions.calculateRemainingBudget;
  static calculateAveragePhaseAllocation = PhaseCalculationsFunctions.calculateAveragePhaseAllocation;
  
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
  static sortPhasesByDate = PhaseHierarchyRules.sortPhasesByDate;
}

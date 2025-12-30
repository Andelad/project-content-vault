/**
 * ProjectBudgetService
 * 
 * Domain Service for Project Budget Logic
 * 
 * Purpose:
 * - Calculate budget allocations and utilization
 * - Validate budget constraints
 * - Analyze budget distribution across phases
 * - Generate budget recommendations
 * - Pure domain logic (no persistence, no UI)
 * 
 * Business Rules:
 * - Fixed Budget Mode: Phases must sum to ≤ project budget
 * - Recurring Mode: Budget validation disabled (N/A)
 * - Budget = project.estimatedHours
 * - Allocation = sum of phase.timeAllocationHours
 * 
 * This service contains the "what" (budget business rules) not the "how" (persistence).
 */

import type { PhaseDTO } from '@/types/core';

export interface BudgetCheck {
  isValid: boolean;
  totalAllocated: number;
  projectBudget: number;
  remaining: number;
  overage: number;
  utilizationPercentage: number;
}

export interface BudgetValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BudgetAnalysis {
  totalAllocated: number;
  projectBudget: number;
  remaining: number;
  overage: number;
  utilizationPercentage: number;
  averagePhaseAllocation: number;
  phaseCount: number;
  isOverBudget: boolean;
  recommendations: string[];
}

/**
 * ProjectBudgetService
 * 
 * Pure domain logic for project budget calculations and validation.
 * No dependencies on Supabase, React, or other external systems.
 */
export class ProjectBudgetService {
  private static readonly HIGH_UTILIZATION_THRESHOLD = 0.9; // 90%
  private static readonly SINGLE_PHASE_DOMINANCE_THRESHOLD = 0.5; // 50%

  // ============================================================================
  // CORE CALCULATIONS
  // ============================================================================

  /**
   * Calculate total time allocation across all phases
   * 
   * Business Rule: SUM(phase.timeAllocationHours)
   * Handles both timeAllocationHours and legacy timeAllocation fields
   * 
   * @param phases - Array of phases
   * @returns Total hours allocated across all phases
   */
  static calculateTotalAllocation(phases: PhaseDTO[]): number {
    return phases.reduce((sum, phase) => {
      const hours = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
      return sum + hours;
    }, 0);
  }

  /**
   * Calculate budget utilization percentage
   * 
   * Business Rule: (totalAllocated / projectBudget) * 100
   * 
   * @param phases - Array of phases
   * @param projectBudget - Project estimated hours
   * @returns Utilization percentage (0-100+, can exceed 100 if over budget)
   */
  static calculateBudgetUtilization(phases: PhaseDTO[], projectBudget: number): number {
    if (projectBudget === 0) return 0;
    const totalAllocated = this.calculateTotalAllocation(phases);
    return (totalAllocated / projectBudget) * 100;
  }

  /**
   * Calculate remaining budget after phase allocations
   * 
   * Business Rule: projectBudget - SUM(phase.timeAllocationHours)
   * Can be negative if over budget
   * 
   * @param phases - Array of phases
   * @param projectBudget - Project estimated hours
   * @returns Remaining hours (negative if over budget)
   */
  static calculateRemainingBudget(phases: PhaseDTO[], projectBudget: number): number {
    const totalAllocated = this.calculateTotalAllocation(phases);
    return projectBudget - totalAllocated;
  }

  /**
   * Calculate budget overage if phases exceed project budget
   * 
   * Business Rule: MAX(0, totalAllocated - projectBudget)
   * 
   * @param phases - Array of phases
   * @param projectBudget - Project estimated hours
   * @returns Overage hours (0 if not over budget)
   */
  static calculateBudgetOverage(phases: PhaseDTO[], projectBudget: number): number {
    const totalAllocated = this.calculateTotalAllocation(phases);
    return Math.max(0, totalAllocated - projectBudget);
  }

  /**
   * Calculate average phase allocation
   * 
   * @param phases - Array of phases
   * @returns Average hours per phase (0 if no phases)
   */
  static calculateAveragePhaseAllocation(phases: PhaseDTO[]): number {
    if (phases.length === 0) return 0;
    const totalAllocated = this.calculateTotalAllocation(phases);
    return totalAllocated / phases.length;
  }

  // ============================================================================
  // BUDGET CONSTRAINT CHECKS
  // ============================================================================

  /**
   * Check if phases exceed project budget
   * 
   * Business Rule: SUM(phase.timeAllocationHours) ≤ project.estimatedHours
   * 
   * @param phases - Project phases
   * @param projectBudget - Project estimated hours
   * @param excludePhaseId - Optional phase to exclude (for update scenarios)
   * @returns Comprehensive budget check result
   */
  static checkBudgetConstraint(
    phases: PhaseDTO[],
    projectBudget: number,
    excludePhaseId?: string
  ): BudgetCheck {
    // Filter out excluded phase if provided (useful for updates)
    const relevantPhases = excludePhaseId
      ? phases.filter(p => p.id !== excludePhaseId)
      : phases;

    const totalAllocated = this.calculateTotalAllocation(relevantPhases);
    const remaining = projectBudget - totalAllocated;
    const overage = Math.max(0, totalAllocated - projectBudget);
    const utilizationPercentage = projectBudget > 0 ? (totalAllocated / projectBudget) * 100 : 0;
    const isValid = totalAllocated <= projectBudget;

    return {
      isValid,
      totalAllocated,
      projectBudget,
      remaining,
      overage,
      utilizationPercentage
    };
  }

  /**
   * Check if adding a phase would exceed budget
   * 
   * @param phases - Current phases
   * @param projectBudget - Project estimated hours
   * @param additionalHours - Hours to add
   * @returns True if budget can accommodate additional hours
   */
  static canAccommodateAdditionalPhase(
    phases: PhaseDTO[],
    projectBudget: number,
    additionalHours: number
  ): boolean {
    const check = this.checkBudgetConstraint(phases, projectBudget);
    return check.remaining >= additionalHours;
  }

  /**
   * Check if a specific phase allocation is valid
   * 
   * @param phaseHours - Phase time allocation
   * @param projectBudget - Project budget
   * @returns True if phase allocation is non-negative and ≤ budget
   */
  static isPhaseAllocationValid(phaseHours: number, projectBudget: number): boolean {
    return phaseHours >= 0 && phaseHours <= projectBudget;
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validate phase time allocation with recommendations
   * 
   * Checks:
   * - Non-negative allocation
   * - Not exceeding project budget
   * - Warnings for high utilization
   * 
   * @param timeAllocation - Phase time allocation
   * @param projectBudget - Project budget
   * @returns Validation result with errors and warnings
   */
  static validatePhaseTime(timeAllocation: number, projectBudget: number): BudgetValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate non-negative
    if (timeAllocation < 0) {
      errors.push('Phase time allocation cannot be negative');
    } else if (timeAllocation === 0) {
      warnings.push('Phase has 0h allocated — work will not be distributed until hours are set');
    }

    // Validate against budget
    if (timeAllocation > projectBudget) {
      errors.push(`Phase allocation (${timeAllocation}h) exceeds project budget (${projectBudget}h)`);
    } else if (timeAllocation > projectBudget * this.SINGLE_PHASE_DOMINANCE_THRESHOLD) {
      warnings.push('Phase allocation is over 50% of project budget');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate adding/updating a phase against project budget
   * 
   * @param existingPhases - Current phases
   * @param phaseHours - Hours for new/updated phase
   * @param projectBudget - Project budget
   * @param isRecurring - Whether phase is recurring (budget validation disabled)
   * @param excludePhaseId - Phase ID to exclude (for updates)
   * @returns Validation result
   */
  static validatePhaseAgainstBudget(
    existingPhases: PhaseDTO[],
    phaseHours: number,
    projectBudget: number,
    isRecurring: boolean = false,
    excludePhaseId?: string
  ): BudgetValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Recurring phases bypass budget validation
    if (isRecurring) {
      return { isValid: true, errors: [], warnings: [] };
    }

    // Check current budget state
    const budgetCheck = this.checkBudgetConstraint(existingPhases, projectBudget, excludePhaseId);

    // Check if adding this phase would exceed budget
    if (budgetCheck.remaining < phaseHours) {
      if (isRecurring) {
        warnings.push(
          `Recurring phase will generate multiple occurrences. ` +
          `Current allocation: ${budgetCheck.totalAllocated}h, ` +
          `Project budget: ${projectBudget}h. ` +
          `Consider the total impact of multiple occurrences.`
        );
      } else {
        errors.push(
          `Adding this phase would exceed project budget. ` +
          `Current allocation: ${budgetCheck.totalAllocated}h, ` +
          `New phase: ${phaseHours}h, ` +
          `Project budget: ${projectBudget}h`
        );
      }
    }

    // Warning if approaching budget limit
    const projectedTotal = budgetCheck.totalAllocated + phaseHours;
    const projectedUtilization = projectBudget > 0 ? projectedTotal / projectBudget : 0;
    
    if (projectedUtilization >= this.HIGH_UTILIZATION_THRESHOLD && projectedUtilization < 1) {
      warnings.push(
        `Adding this phase will use ${(projectedUtilization * 100).toFixed(1)}% of project budget`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ============================================================================
  // ANALYSIS & RECOMMENDATIONS
  // ============================================================================

  /**
   * Generate comprehensive budget analysis
   * 
   * @param phases - Project phases
   * @param projectBudget - Project estimated hours
   * @returns Detailed budget analysis with recommendations
   */
  static analyzeBudget(phases: PhaseDTO[], projectBudget: number): BudgetAnalysis {
    const totalAllocated = this.calculateTotalAllocation(phases);
    const remaining = this.calculateRemainingBudget(phases, projectBudget);
    const overage = this.calculateBudgetOverage(phases, projectBudget);
    const utilizationPercentage = this.calculateBudgetUtilization(phases, projectBudget);
    const averagePhaseAllocation = this.calculateAveragePhaseAllocation(phases);
    const isOverBudget = totalAllocated > projectBudget;
    const recommendations = this.generateRecommendations(phases, projectBudget);

    return {
      totalAllocated,
      projectBudget,
      remaining,
      overage,
      utilizationPercentage,
      averagePhaseAllocation,
      phaseCount: phases.length,
      isOverBudget,
      recommendations
    };
  }

  /**
   * Generate business recommendations based on budget allocation
   * 
   * @param phases - Project phases
   * @param projectBudget - Project estimated hours
   * @returns Array of recommendation strings
   */
  static generateRecommendations(phases: PhaseDTO[], projectBudget: number): string[] {
    const recommendations: string[] = [];
    const budgetCheck = this.checkBudgetConstraint(phases, projectBudget);

    // Over budget
    if (!budgetCheck.isValid) {
      recommendations.push(
        `Budget exceeded by ${budgetCheck.overage.toFixed(1)}h. ` +
        `Consider reducing phase allocations or increasing project budget.`
      );
    }

    // High utilization warning
    if (budgetCheck.utilizationPercentage >= this.HIGH_UTILIZATION_THRESHOLD * 100 && 
        budgetCheck.utilizationPercentage < 100) {
      recommendations.push(
        `Budget utilization is ${budgetCheck.utilizationPercentage.toFixed(1)}%. ` +
        `Consider leaving buffer for unexpected work.`
      );
    }

    // Unallocated budget
    if (budgetCheck.remaining > projectBudget * 0.3 && phases.length > 0) {
      recommendations.push(
        `${budgetCheck.remaining.toFixed(1)}h unallocated. ` +
        `Consider distributing remaining budget to phases or reducing project scope.`
      );
    }

    // No phases warning
    if (phases.length === 0 && projectBudget > 0) {
      recommendations.push(
        `No phases defined. Create phases to allocate the ${projectBudget}h budget.`
      );
    }

    // Single phase dominance
    if (phases.length > 1) {
      const maxAllocation = Math.max(...phases.map(p => p.timeAllocationHours ?? p.timeAllocation ?? 0));
      if (maxAllocation > projectBudget * this.SINGLE_PHASE_DOMINANCE_THRESHOLD) {
        recommendations.push(
          `One phase uses over 50% of budget. Consider breaking down into smaller phases.`
        );
      }
    }

    // Uneven distribution
    if (phases.length >= 3) {
      const allocations = phases.map(p => p.timeAllocationHours ?? p.timeAllocation ?? 0);
      const avg = this.calculateAveragePhaseAllocation(phases);
      const variance = allocations.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / phases.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > avg * 0.5 && avg > 0) {
        recommendations.push(
          `Phase allocations vary significantly. Consider more balanced distribution for predictable workflow.`
        );
      }
    }

    return recommendations;
  }

  /**
   * Suggest optimal phase allocation
   * 
   * Distributes remaining budget evenly across phases
   * 
   * @param phases - Current phases
   * @param projectBudget - Project budget
   * @returns Suggested allocation per phase
   */
  static suggestPhaseAllocation(phases: PhaseDTO[], projectBudget: number): number {
    if (phases.length === 0) return 0;
    const remaining = this.calculateRemainingBudget(phases, projectBudget);
    return Math.max(0, remaining / phases.length);
  }

  /**
   * Check if budget is well-distributed
   * 
   * @param phases - Project phases
   * @param projectBudget - Project budget
   * @returns True if budget is reasonably distributed
   */
  static isBudgetWellDistributed(phases: PhaseDTO[], projectBudget: number): boolean {
    if (phases.length === 0) return false;
    
    const budgetCheck = this.checkBudgetConstraint(phases, projectBudget);
    
    // Check utilization is healthy (70-95%)
    const healthyUtilization = budgetCheck.utilizationPercentage >= 70 && 
                              budgetCheck.utilizationPercentage <= 95;
    
    // Check no single phase dominates
    const maxAllocation = Math.max(...phases.map(p => p.timeAllocationHours ?? p.timeAllocation ?? 0));
    const noDominance = maxAllocation <= projectBudget * this.SINGLE_PHASE_DOMINANCE_THRESHOLD;
    
    return healthyUtilization && noDominance;
  }
}

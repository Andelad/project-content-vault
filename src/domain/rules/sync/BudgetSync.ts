/**
 * Budget Synchronization Rules
 * 
 * Cross-cutting business logic for synchronizing budgets across entities.
 * 
 * Purpose:
 * - Phase budgets must not exceed project budget
 * - Project budget tracking across all phases
 * - Single source of truth for phase/project budget interactions
 * 
 * This handles the relationship:
 * - Individual phase budgets
 * - Total phase allocation vs project budget
 * - Budget utilization tracking
 * 
 * Note: Math is inline (no MathUtils extraction)
 */

import type { Project, PhaseDTO } from '@/types/core';

export interface BudgetSyncResult {
  success: boolean;
  totalAllocated: number;
  projectBudget: number;
  remaining: number;
  overage: number;
  utilizationPercentage: number;
  isOverBudget: boolean;
  errors?: string[];
  warnings?: string[];
}

export class BudgetSync {
  /**
   * Calculate total phase budget allocation
   * 
   * RULE: Sum of all phase time allocations
   * Formula: SUM(phase.timeAllocationHours)
   * 
   * Inline math - no utilities.
   * 
   * @param phases - All phases
   * @returns Total hours allocated
   */
  static calculateTotalAllocation(phases: PhaseDTO[]): number {
    return phases.reduce((total, phase) => {
      const hours = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
      return total + hours;
    }, 0);
  }

  /**
   * Analyze project budget vs phase allocations
   * 
   * RULE: SUM(phase budgets) ≤ project budget
   * 
   * Returns comprehensive budget analysis with:
   * - Total allocated
   * - Remaining budget
   * - Overage (if exceeded)
   * - Utilization percentage
   * 
   * Inline calculations - no utilities.
   * 
   * @param project - Parent project
   * @param phases - All project phases
   * @returns Budget analysis
   */
  static analyzeBudget(
    project: Project,
    phases: PhaseDTO[]
  ): BudgetSyncResult {
    const totalAllocated = this.calculateTotalAllocation(phases);
    const projectBudget = project.estimatedHours;

    // Inline math for budget calculations
    const remaining = projectBudget - totalAllocated;
    const overage = remaining < 0 ? Math.abs(remaining) : 0;
    const utilizationPercentage = projectBudget > 0 
      ? (totalAllocated / projectBudget) * 100 
      : 0;
    const isOverBudget = totalAllocated > projectBudget;

    const warnings: string[] = [];
    const errors: string[] = [];

    if (isOverBudget) {
      errors.push(
        `Phase budgets (${totalAllocated}h) exceed project budget (${projectBudget}h) by ${overage}h`
      );
    } else if (utilizationPercentage > 90) {
      warnings.push(
        `Budget utilization at ${utilizationPercentage.toFixed(1)}% - approaching project limit`
      );
    }

    return {
      success: !isOverBudget,
      totalAllocated,
      projectBudget,
      remaining,
      overage,
      utilizationPercentage,
      isOverBudget,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Check if project can accommodate additional hours
   * 
   * RULE: totalAllocated + additionalHours ≤ projectBudget
   * 
   * @param project - Parent project
   * @param phases - Current phases
   * @param additionalHours - Hours to add
   * @returns True if budget can accommodate
   */
  static canAccommodateAdditionalHours(
    project: Project,
    phases: PhaseDTO[],
    additionalHours: number
  ): boolean {
    const totalAllocated = this.calculateTotalAllocation(phases);
    const newTotal = totalAllocated + additionalHours;
    return newTotal <= project.estimatedHours;
  }

  /**
   * Calculate remaining budget percentage
   * 
   * Inline percentage calculation.
   * 
   * @param project - Parent project
   * @param phases - Current phases
   * @returns Percentage of budget remaining (0-100)
   */
  static calculateRemainingPercentage(
    project: Project,
    phases: PhaseDTO[]
  ): number {
    const totalAllocated = this.calculateTotalAllocation(phases);
    const remaining = project.estimatedHours - totalAllocated;
    
    if (project.estimatedHours === 0) return 0;
    
    // Inline percentage math
    const percentage = (remaining / project.estimatedHours) * 100;
    return Math.max(0, percentage); // Can't be negative
  }

  /**
   * Suggest budget for a new phase
   * 
   * Recommends budget allocation based on:
   * - Remaining budget
   * - Number of existing phases
   * - Average phase allocation
   * 
   * Inline calculations.
   * 
   * @param project - Parent project  
   * @param phases - Existing phases
   * @returns Suggested hours for new phase
   */
  static suggestPhaseBudget(
    project: Project,
    phases: PhaseDTO[]
  ): number {
    const analysis = this.analyzeBudget(project, phases);
    
    if (analysis.remaining <= 0) return 0;
    
    // If no phases yet, suggest half the budget
    if (phases.length === 0) {
      return Math.round(project.estimatedHours / 2);
    }
    
    // Calculate average phase allocation
    const avgAllocation = analysis.totalAllocated / phases.length;
    
    // Suggest lesser of: average or remaining
    return Math.min(
      Math.round(avgAllocation),
      Math.round(analysis.remaining)
    );
  }
}

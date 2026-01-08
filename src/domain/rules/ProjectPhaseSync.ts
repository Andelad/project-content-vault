/**
 * Project-Phase Synchronization Rules
 * 
 * KEYWORDS: date sync, budget sync, phase project relationship, bi-directional sync
 * 
 * Cross-entity synchronization logic for keeping projects and phases aligned.
 * 
 * This module handles the bi-directional relationship between projects and phases:
 * - **Phase → Project**: Phases constrained by project dates/budget
 * - **Project → Phase**: Project dates/budget updated to span all phases
 * 
 * Structure:
 * - DateSync: Project dates must encompass phase dates
 * - BudgetSync: Phase allocations must not exceed project budget
 * 
 * Created: 2026-01-08 (consolidated from sync/DateSync.ts + sync/BudgetSync.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { Project, PhaseDTO } from '@/types/core';
import { calculateTotalAllocation } from './phases/PhaseCalculations';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DateSyncResult {
  success: boolean;
  updatedProject?: Partial<Project>;
  notifications?: string[];
  errors?: string[];
  warnings?: string[];
}

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

// ============================================================================
// DATE SYNCHRONIZATION
// ============================================================================

/**
 * Date Synchronization Rules
 * 
 * Handles bi-directional date synchronization between projects and phases.
 */
export class DateSync {
  /**
   * Synchronize project dates to span all phases
   * 
   * RULE: Project dates should encompass all phase dates
   * Formula: 
   * - project.startDate = MIN(phase.startDate)
   * - project.endDate = MAX(phase.endDate)
   * 
   * @param project - Current project
   * @param phases - All project phases
   * @returns Sync result with updated project dates if needed
   */
  static synchronizeProjectWithPhases(
    project: Project,
    phases: PhaseDTO[]
  ): DateSyncResult {
    if (phases.length === 0) {
      return { success: true };
    }

    // Calculate earliest phase start (inline date math)
    const earliestPhaseStart = phases.reduce((earliest, phase) => {
      if (!phase.startDate) return earliest;
      const phaseStart = new Date(phase.startDate);
      return !earliest || phaseStart < earliest ? phaseStart : earliest;
    }, null as Date | null);

    // Calculate latest phase end (inline date math)
    const latestPhaseEnd = phases.reduce((latest, phase) => {
      const phaseEnd = new Date(phase.endDate || phase.dueDate);
      return !latest || phaseEnd > latest ? phaseEnd : latest;
    }, null as Date | null);

    const notifications: string[] = [];
    let needsUpdate = false;

    const updatedProject: Partial<Project> = {};

    // Check if project start needs adjustment
    if (earliestPhaseStart) {
      const currentProjectStart = new Date(project.startDate);
      if (earliestPhaseStart < currentProjectStart) {
        updatedProject.startDate = earliestPhaseStart;
        needsUpdate = true;
        notifications.push(
          `Project start date adjusted to ${earliestPhaseStart.toLocaleDateString()} to encompass earliest phase`
        );
      }
    }

    // Check if project end needs adjustment
    if (latestPhaseEnd) {
      const currentProjectEnd = new Date(project.endDate);
      if (latestPhaseEnd > currentProjectEnd) {
        updatedProject.endDate = latestPhaseEnd;
        needsUpdate = true;
        notifications.push(
          `Project end date adjusted to ${latestPhaseEnd.toLocaleDateString()} to encompass latest phase`
        );
      }
    }

    return {
      success: true,
      updatedProject: needsUpdate ? updatedProject : undefined,
      notifications: notifications.length > 0 ? notifications : undefined
    };
  }

  /**
   * Validate that phases fall within project dates
   * 
   * RULE: Phase dates must be within project date range
   * Formula: project.startDate ≤ phase dates ≤ project.endDate
   * 
   * @param phases - Phases to validate
   * @param project - Parent project
   * @returns Validation result with errors
   */
  static validatePhasesWithinProject(
    phases: PhaseDTO[],
    project: Project
  ): DateSyncResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);

    for (const phase of phases) {
      // Check start date
      if (phase.startDate) {
        const phaseStart = new Date(phase.startDate);
        if (phaseStart < projectStart) {
          errors.push(
            `Phase "${phase.name}" starts (${phaseStart.toLocaleDateString()}) before project start (${projectStart.toLocaleDateString()})`
          );
        }
        if (phaseStart > projectEnd) {
          errors.push(
            `Phase "${phase.name}" starts (${phaseStart.toLocaleDateString()}) after project end (${projectEnd.toLocaleDateString()})`
          );
        }
      }

      // Check end date
      const phaseEnd = new Date(phase.endDate || phase.dueDate);
      if (phaseEnd < projectStart) {
        errors.push(
          `Phase "${phase.name}" ends (${phaseEnd.toLocaleDateString()}) before project start (${projectStart.toLocaleDateString()})`
        );
      }
      if (phaseEnd > projectEnd) {
        errors.push(
          `Phase "${phase.name}" ends (${phaseEnd.toLocaleDateString()}) after project end (${projectEnd.toLocaleDateString()})`
        );
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Calculate project duration from phase coverage
   * 
   * Returns the total span of days covered by phases.
   * Inline date math - no utilities.
   * 
   * @param phases - Project phases
   * @returns Duration in days, or null if no phases
   */
  static calculatePhaseCoverageDays(phases: PhaseDTO[]): number | null {
    if (phases.length === 0) return null;

    const earliestStart = phases.reduce((earliest, phase) => {
      if (!phase.startDate) return earliest;
      const phaseStart = new Date(phase.startDate);
      return !earliest || phaseStart < earliest ? phaseStart : earliest;
    }, null as Date | null);

    const latestEnd = phases.reduce((latest, phase) => {
      const phaseEnd = new Date(phase.endDate || phase.dueDate);
      return !latest || phaseEnd > latest ? phaseEnd : latest;
    }, null as Date | null);

    if (!earliestStart || !latestEnd) return null;

    // Inline date math: difference in milliseconds → days
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffMs = latestEnd.getTime() - earliestStart.getTime();
    return Math.ceil(diffMs / msPerDay);
  }
}

// ============================================================================
// BUDGET SYNCHRONIZATION
// ============================================================================

/**
 * Budget Synchronization Rules
 * 
 * Handles budget synchronization and validation between projects and phases.
 */
export class BudgetSync {
  /**
   * Calculate total phase budget allocation
   * 
   * @deprecated Use calculateTotalAllocation from phases/PhaseCalculations.ts (single source of truth)
   * This is kept as a re-export for backward compatibility.
   * 
   * RULE: Sum of all phase time allocations
   * Formula: SUM(phase.timeAllocationHours)
   * 
   * @param phases - All phases
   * @returns Total hours allocated
   */
  static calculateTotalAllocation(phases: PhaseDTO[]): number {
    // Delegate to single source of truth
    return calculateTotalAllocation(phases);
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
   * Get available budget for new phase
   * 
   * @param project - Parent project
   * @param phases - Current phases
   * @returns Available hours
   */
  static getAvailableBudget(
    project: Project,
    phases: PhaseDTO[]
  ): number {
    const totalAllocated = this.calculateTotalAllocation(phases);
    const remaining = project.estimatedHours - totalAllocated;
    return Math.max(0, remaining);
  }
}

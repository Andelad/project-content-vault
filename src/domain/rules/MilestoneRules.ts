/**
 * Milestone Business Rules
 * 
 * Single source of truth for all milestone-related business logic.
 * All milestone validation, constraints, and calculations are defined here.
 * 
 * This is the domain layer - pure business logic with no external dependencies.
 * Validators, services, and other layers should delegate to these rules.
 * 
 * @see docs/BUSINESS_LOGIC_REFERENCE.md for complete rule documentation
 */

import type { Milestone, Project } from '@/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MilestoneValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MilestoneDateValidation {
  isValid: boolean;
  errors: string[];
}

export interface MilestoneTimeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MilestoneBudgetCheck {
  isValid: boolean;
  totalAllocated: number;
  projectBudget: number;
  remaining: number;
  overage: number;
  utilizationPercentage: number;
}

// ============================================================================
// MILESTONE BUSINESS RULES
// ============================================================================

/**
 * Milestone Business Rules
 * 
 * Centralized location for all milestone-related business logic.
 * These rules are referenced by the Business Logic Reference document.
 */
export class MilestoneRules {
  
  // ==========================================================================
  // RULE 1: POSITIVE TIME ALLOCATIONS
  // ==========================================================================
  
  /**
   * RULE 1: Milestone time allocation must be positive
   * 
   * Business Logic Reference: Rule 4
   * Formula: milestone.timeAllocationHours > 0
   * 
   * @param timeAllocation - The time allocation to validate
   * @returns true if allocation is positive, false otherwise
   */
  static validateTimeAllocation(timeAllocation: number): boolean {
    return timeAllocation > 0;
  }

  // ==========================================================================
  // RULE 2: MILESTONE DATE CONSTRAINT
  // ==========================================================================
  
  /**
   * RULE 2: Milestone dates must fall within project date range
   * 
   * Business Logic Reference: Rule 2
   * Formula: project.startDate ≤ milestone.endDate ≤ project.endDate
   * 
   * @param milestoneEndDate - Milestone end/due date
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param continuous - Whether project is continuous (no end date constraint)
   * @returns Validation result with errors
   */
  static validateMilestoneDateWithinProject(
    milestoneEndDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
    continuous: boolean = false
  ): MilestoneDateValidation {
    const errors: string[] = [];

    // Check if milestone is after project start
    if (milestoneEndDate < projectStartDate) {
      errors.push('Milestone date cannot be before project start date');
    }

    // For non-continuous projects, check if milestone is before project end
    if (!continuous && milestoneEndDate > projectEndDate) {
      errors.push('Milestone date cannot be after project end date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate milestone start and end date relationship
   * 
   * @param startDate - Milestone start date (optional)
   * @param endDate - Milestone end date
   * @returns Validation result
   */
  static validateMilestoneDateRange(
    startDate: Date | undefined,
    endDate: Date
  ): MilestoneDateValidation {
    const errors: string[] = [];

    if (startDate && startDate >= endDate) {
      errors.push('Milestone start date must be before end date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ==========================================================================
  // RULE 3: MILESTONE BUDGET CONSTRAINT
  // ==========================================================================
  
  /**
   * RULE 3a: Calculate total milestone allocation
   * 
   * Business Logic Reference: Calculation Rule 2
   * Formula: SUM(milestone.timeAllocationHours)
   * 
   * @param milestones - Array of milestones
   * @returns Total hours allocated
   */
  static calculateTotalAllocation(milestones: Milestone[]): number {
    return milestones.reduce((sum, milestone) => {
      const hours = milestone.timeAllocationHours ?? milestone.timeAllocation ?? 0;
      return sum + hours;
    }, 0);
  }

  /**
   * RULE 3b: Check if milestones exceed project budget
   * 
   * Business Logic Reference: Rule 1
   * Formula: SUM(milestone.timeAllocationHours) ≤ project.estimatedHours
   * 
   * @param milestones - Project milestones
   * @param projectBudget - Project estimated hours
   * @param excludeMilestoneId - Optional milestone to exclude (for updates)
   * @returns Budget check result
   */
  static checkBudgetConstraint(
    milestones: Milestone[],
    projectBudget: number,
    excludeMilestoneId?: string
  ): MilestoneBudgetCheck {
    // Filter out excluded milestone if provided
    const relevantMilestones = excludeMilestoneId
      ? milestones.filter(m => m.id !== excludeMilestoneId)
      : milestones;

    const totalAllocated = this.calculateTotalAllocation(relevantMilestones);
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
   * RULE 3c: Check if adding a milestone would exceed budget
   * 
   * @param milestones - Current milestones
   * @param projectBudget - Project estimated hours
   * @param additionalHours - Hours to add
   * @returns true if budget can accommodate, false otherwise
   */
  static canAccommodateAdditionalMilestone(
    milestones: Milestone[],
    projectBudget: number,
    additionalHours: number
  ): boolean {
    const check = this.checkBudgetConstraint(milestones, projectBudget);
    return check.remaining >= additionalHours;
  }

  // ==========================================================================
  // COMPREHENSIVE VALIDATION
  // ==========================================================================
  
  /**
   * Validate milestone time allocation with recommendations
   * 
   * Combines:
   * - RULE 1: Positive time allocation
   * - Budget utilization warnings
   * 
   * @param timeAllocation - Milestone time allocation
   * @param projectBudget - Project budget
   * @returns Detailed validation result
   */
  static validateMilestoneTime(
    timeAllocation: number,
    projectBudget: number
  ): MilestoneTimeValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.validateTimeAllocation(timeAllocation)) {
      errors.push('Milestone time allocation must be greater than 0');
    }

    if (timeAllocation > projectBudget) {
      errors.push(`Milestone allocation (${timeAllocation}h) exceeds project budget (${projectBudget}h)`);
    } else if (timeAllocation > projectBudget * 0.5) {
      warnings.push('Milestone allocation is over 50% of project budget');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate complete milestone against project
   * 
   * Combines all milestone validation rules:
   * - RULE 1: Positive time allocation
   * - RULE 2: Date within project range
   * - RULE 3: Doesn't exceed project budget (with other milestones)
   * 
   * @param milestone - Milestone to validate
   * @param project - Parent project
   * @param existingMilestones - Other project milestones
   * @returns Comprehensive validation result
   */
  static validateMilestone(
    milestone: Milestone,
    project: Project,
    existingMilestones: Milestone[] = []
  ): MilestoneValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate time allocation
    const timeValidation = this.validateMilestoneTime(
      milestone.timeAllocationHours ?? milestone.timeAllocation,
      project.estimatedHours
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // Validate dates
    const dateValidation = this.validateMilestoneDateWithinProject(
      milestone.endDate || milestone.dueDate,
      project.startDate,
      project.endDate,
      project.continuous
    );
    errors.push(...dateValidation.errors);

    // Validate start/end date relationship if start date exists
    if (milestone.startDate) {
      const rangeValidation = this.validateMilestoneDateRange(
        milestone.startDate,
        milestone.endDate || milestone.dueDate
      );
      errors.push(...rangeValidation.errors);
    }

    // Validate budget constraint with existing milestones
    const milestoneHours = milestone.timeAllocationHours ?? milestone.timeAllocation;
    const canAccommodate = this.canAccommodateAdditionalMilestone(
      existingMilestones,
      project.estimatedHours,
      milestoneHours
    );

    if (!canAccommodate) {
      const budgetCheck = this.checkBudgetConstraint(existingMilestones, project.estimatedHours);
      errors.push(
        `Adding this milestone would exceed project budget. ` +
        `Current allocation: ${budgetCheck.totalAllocated}h, ` +
        `New milestone: ${milestoneHours}h, ` +
        `Project budget: ${project.estimatedHours}h`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // CALCULATION RULES
  // ==========================================================================
  
  /**
   * Calculate milestone budget utilization percentage
   * 
   * Business Logic Reference: Calculation Rule 2
   * Formula: (SUM(milestone hours) / project budget) * 100
   * 
   * @param milestones - Array of milestones
   * @param projectBudget - Project estimated hours
   * @returns Utilization percentage (0-100+)
   */
  static calculateBudgetUtilization(
    milestones: Milestone[],
    projectBudget: number
  ): number {
    if (projectBudget === 0) return 0;
    const totalAllocated = this.calculateTotalAllocation(milestones);
    return (totalAllocated / projectBudget) * 100;
  }

  /**
   * Calculate remaining budget after milestone allocations
   * 
   * Business Logic Reference: Calculation Rule 5
   * Formula: project.estimatedHours - SUM(milestone.timeAllocationHours)
   * 
   * @param milestones - Array of milestones
   * @param projectBudget - Project estimated hours
   * @returns Remaining hours (can be negative if over budget)
   */
  static calculateRemainingBudget(
    milestones: Milestone[],
    projectBudget: number
  ): number {
    const totalAllocated = this.calculateTotalAllocation(milestones);
    return projectBudget - totalAllocated;
  }

  /**
   * Calculate budget overage if milestones exceed project budget
   * 
   * Business Logic Reference: Calculation Rule 6
   * Formula: MAX(0, SUM(milestone hours) - project budget)
   * 
   * @param milestones - Array of milestones
   * @param projectBudget - Project estimated hours
   * @returns Overage hours (0 if not over budget)
   */
  static calculateBudgetOverage(
    milestones: Milestone[],
    projectBudget: number
  ): number {
    const totalAllocated = this.calculateTotalAllocation(milestones);
    return Math.max(0, totalAllocated - projectBudget);
  }

  /**
   * Calculate average milestone allocation
   * 
   * @param milestones - Array of milestones
   * @returns Average hours per milestone
   */
  static calculateAverageMilestoneAllocation(milestones: Milestone[]): number {
    if (milestones.length === 0) return 0;
    const totalAllocated = this.calculateTotalAllocation(milestones);
    return totalAllocated / milestones.length;
  }

  // ==========================================================================
  // BUSINESS RECOMMENDATIONS
  // ==========================================================================
  
  /**
   * Generate business recommendations based on milestone allocation
   * 
   * @param milestones - Project milestones
   * @param projectBudget - Project estimated hours
   * @returns Array of recommendation strings
   */
  static generateRecommendations(
    milestones: Milestone[],
    projectBudget: number
  ): string[] {
    const recommendations: string[] = [];
    const budgetCheck = this.checkBudgetConstraint(milestones, projectBudget);

    if (!budgetCheck.isValid) {
      recommendations.push(
        `Budget exceeded by ${budgetCheck.overage.toFixed(1)}h. ` +
        `Consider reducing milestone allocations or increasing project budget.`
      );
    } else if (budgetCheck.utilizationPercentage > 90) {
      recommendations.push(
        'Budget utilization high (>90%). Consider adding buffer time for unexpected work.'
      );
    } else if (budgetCheck.utilizationPercentage < 50) {
      recommendations.push(
        'Budget utilization low (<50%). Consider adding more milestones or increasing detail.'
      );
    }

    if (milestones.length > 0) {
      const avgAllocation = this.calculateAverageMilestoneAllocation(milestones);
      if (avgAllocation < 1) {
        recommendations.push(
          'Very small milestone allocations detected. Consider consolidating milestones.'
        );
      } else if (avgAllocation > projectBudget * 0.5) {
        recommendations.push(
          'Large milestone allocations detected. Consider breaking down into smaller milestones.'
        );
      }
    }

    return recommendations;
  }

  // ==========================================================================
  // ORDERING RULES
  // ==========================================================================
  
  /**
   * RULE 5: Validate milestone order consistency
   * 
   * Business Logic Reference: Rule 5
   * Milestones should have unique, sequential order values
   * 
   * @param milestones - Array of milestones
   * @returns true if orders are valid, false otherwise
   */
  static validateMilestoneOrders(milestones: Milestone[]): boolean {
    if (milestones.length === 0) return true;
    
    const orders = milestones.map(m => m.order).sort((a, b) => a - b);
    
    // Check for duplicates
    for (let i = 1; i < orders.length; i++) {
      if (orders[i] === orders[i - 1]) {
        return false; // Duplicate order found
      }
    }
    
    return true;
  }

  /**
   * Normalize milestone orders to be sequential
   * 
   * @param milestones - Array of milestones
   * @returns Normalized milestones with sequential orders
   */
  static normalizeMilestoneOrders(milestones: Milestone[]): Milestone[] {
    return milestones
      .sort((a, b) => {
        // Sort by order, then by date if orders are equal
        if (a.order !== b.order) return a.order - b.order;
        const dateA = a.endDate || a.dueDate;
        const dateB = b.endDate || b.dueDate;
        return dateA.getTime() - dateB.getTime();
      })
      .map((milestone, index) => ({
        ...milestone,
        order: index
      }));
  }
}

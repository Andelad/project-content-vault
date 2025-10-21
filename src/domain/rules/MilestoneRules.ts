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
   * Applies to:
   * - Single milestones: Due date must be within project dates
   * - Recurring milestones: Generated occurrences must be within project dates
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
  // RULE 2B: RECURRING MILESTONE VALIDATION
  // ==========================================================================
  
  /**
   * RULE 2B: Validate recurring milestone configuration
   * 
   * Business Logic:
   * - Recurring pattern must be valid (type, interval)
   * - Time allocation applies per occurrence
   * - Pattern generates occurrences within project boundaries
   * 
   * @param isRecurring - Whether milestone is recurring
   * @param recurringConfig - Recurrence pattern configuration
   * @param timeAllocation - Hours per occurrence
   * @returns Validation result with errors
   */
  static validateRecurringMilestone(
    isRecurring: boolean,
    recurringConfig: any,
    timeAllocation: number
  ): MilestoneDateValidation {
    const errors: string[] = [];

    if (!isRecurring) {
      return { isValid: true, errors: [] };
    }

    // Validate recurring config exists
    if (!recurringConfig) {
      errors.push('Recurring milestone must have recurrence configuration');
      return { isValid: false, errors };
    }

    // Validate pattern type
    const validTypes = ['daily', 'weekly', 'monthly'];
    if (!validTypes.includes(recurringConfig.type)) {
      errors.push(`Invalid recurrence type: ${recurringConfig.type}. Must be daily, weekly, or monthly`);
    }

    // Validate interval
    if (!recurringConfig.interval || recurringConfig.interval < 1) {
      errors.push('Recurrence interval must be at least 1');
    }

    // Validate type-specific fields
    if (recurringConfig.type === 'weekly' && recurringConfig.weeklyDayOfWeek === undefined) {
      errors.push('Weekly recurrence must specify day of week (0-6)');
    }

    if (recurringConfig.type === 'monthly') {
      if (!recurringConfig.monthlyPattern) {
        errors.push('Monthly recurrence must specify pattern (date or dayOfWeek)');
      } else if (recurringConfig.monthlyPattern === 'date' && !recurringConfig.monthlyDate) {
        errors.push('Monthly date pattern must specify date (1-31)');
      } else if (recurringConfig.monthlyPattern === 'dayOfWeek' && 
                 (recurringConfig.monthlyWeekOfMonth === undefined || recurringConfig.monthlyDayOfWeek === undefined)) {
        errors.push('Monthly dayOfWeek pattern must specify week of month and day of week');
      }
    }

    // Validate time allocation
    if (timeAllocation <= 0) {
      errors.push('Recurring milestone must have positive time allocation per occurrence');
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
   * - RULE 2B: Recurring pattern validation (if applicable)
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

    const milestoneHours = milestone.timeAllocationHours ?? milestone.timeAllocation;

    // Validate time allocation
    const timeValidation = this.validateMilestoneTime(
      milestoneHours,
      project.estimatedHours
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // For recurring milestones, validate pattern
    if (milestone.isRecurring) {
      const recurringValidation = this.validateRecurringMilestone(
        milestone.isRecurring,
        milestone.recurringConfig,
        milestoneHours
      );
      errors.push(...recurringValidation.errors);
    } else {
      // For single milestones, validate dates
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
    }

    // Validate budget constraint with existing milestones
    // Note: For recurring milestones, this checks per-occurrence allocation
    const canAccommodate = this.canAccommodateAdditionalMilestone(
      existingMilestones,
      project.estimatedHours,
      milestoneHours
    );

    if (!canAccommodate && !project.continuous) {
      const budgetCheck = this.checkBudgetConstraint(existingMilestones, project.estimatedHours);
      if (milestone.isRecurring) {
        warnings.push(
          `Recurring milestone allocation (${milestoneHours}h per occurrence) may exceed project budget. ` +
          `Current allocation: ${budgetCheck.totalAllocated}h, ` +
          `Project budget: ${project.estimatedHours}h. ` +
          `Consider the total impact of multiple occurrences.`
        );
      } else {
        errors.push(
          `Adding this milestone would exceed project budget. ` +
          `Current allocation: ${budgetCheck.totalAllocated}h, ` +
          `New milestone: ${milestoneHours}h, ` +
          `Project budget: ${project.estimatedHours}h`
        );
      }
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
   * Sort milestones by date (natural ordering)
   * Milestones are naturally ordered by endDate - no manual ordering needed
   * 
   * @param milestones - Array of milestones
   * @returns Sorted milestones
   */
  static sortMilestonesByDate(milestones: Milestone[]): Milestone[] {
    return milestones.sort((a, b) => {
      const dateA = a.endDate || a.dueDate;
      const dateB = b.endDate || b.dueDate;
      return dateA.getTime() - dateB.getTime();
    });
  }

  // ==========================================================================
  // MILESTONE POSITIONING RULES (for drag operations)
  // ==========================================================================

  /**
   * RULE: Milestone position constraints for drag operations
   * 
   * Business rules:
   * 1. Milestones must be at least 1 day after project start
   * 2. Milestones must be at least 1 day before project end
   * 3. Milestones cannot overlap with other milestones (must be at least 1 day apart)
   * 
   * @param milestoneDate - Proposed milestone date
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param otherMilestoneDates - Dates of other milestones in the project
   * @param originalDate - Original date of milestone being moved (for calculating valid range)
   * @returns Validation result with allowed range
   */
  static validateMilestonePosition(
    milestoneDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
    otherMilestoneDates: Date[],
    originalDate?: Date
  ): {
    isValid: boolean;
    errors: string[];
    minAllowedDate: Date;
    maxAllowedDate: Date;
  } {
    const errors: string[] = [];
    
    // Normalize dates to midnight
    const candidate = new Date(milestoneDate);
    candidate.setHours(0, 0, 0, 0);
    
    const projectStart = new Date(projectStartDate);
    projectStart.setHours(0, 0, 0, 0);
    
    const projectEnd = new Date(projectEndDate);
    projectEnd.setHours(0, 0, 0, 0);
    
    const original = originalDate ? new Date(originalDate) : null;
    if (original) {
      original.setHours(0, 0, 0, 0);
    }
    
    // Calculate absolute min/max (project boundaries)
    const minAllowedDate = new Date(projectStart);
    minAllowedDate.setDate(projectStart.getDate() + 1); // 1 day after start
    
    const maxAllowedDate = new Date(projectEnd);
    maxAllowedDate.setDate(projectEnd.getDate() - 1); // 1 day before end
    
    // Check project boundary constraints
    if (candidate < minAllowedDate) {
      errors.push('Milestone must be at least 1 day after project start');
    }
    
    if (candidate > maxAllowedDate) {
      errors.push('Milestone must be at least 1 day before project end');
    }
    
    // Check milestone overlap constraints
    const normalizedOthers = otherMilestoneDates.map(d => {
      const normalized = new Date(d);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    });
    
    for (const otherDate of normalizedOthers) {
      // Skip if this is the original position of the milestone being moved
      if (original && otherDate.getTime() === original.getTime()) {
        continue;
      }
      
      // Check if dates are the same (overlap)
      if (candidate.getTime() === otherDate.getTime()) {
        errors.push('Milestone cannot overlap with another milestone');
        break;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      minAllowedDate,
      maxAllowedDate
    };
  }

  /**
   * Check if a milestone is part of a recurring pattern (old numbered system)
   * Used to prevent editing of auto-generated recurring instances
   * 
   * @param milestone - Milestone to check
   * @returns true if milestone is a recurring instance
   */
  static isRecurringMilestone(milestone: Milestone): boolean {
    return milestone.name ? /\s\d+$/.test(milestone.name) : false;
  }
}

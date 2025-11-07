/**
 * Project Business Rules
 * 
 * Single source of truth for all project-related business logic.
 * All project validation, constraints, and calculations are defined here.
 * 
 * This is the domain layer - pure business logic with no external dependencies.
 * Validators, services, and other layers should delegate to these rules.
 * 
 * @see docs/BUSINESS_LOGIC_REFERENCE.md for complete rule documentation
 */

import type { Project, Milestone } from '@/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProjectBudgetAnalysis {
  totalAllocation: number;
  suggestedBudget: number;
  isOverBudget: boolean;
  overageHours: number;
  utilizationPercentage: number;
  // Legacy aliases for backward compatibility
  totalEstimatedHours?: number;
  totalAllocatedHours?: number;
  remainingHours?: number;
  utilizationPercent?: number;
}

export interface ProjectTimeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProjectDateValidation {
  isValid: boolean;
  hasValidRange: boolean;
  errors: string[];
}

// ============================================================================
// PROJECT BUSINESS RULES
// ============================================================================

/**
 * Project Business Rules
 * 
 * Centralized location for all project-related business logic.
 * These rules are referenced by the Business Logic Reference document.
 */
export class ProjectRules {
  
  // ==========================================================================
  // RULE 1: POSITIVE TIME ALLOCATIONS
  // ==========================================================================
  
  /**
   * RULE 1: Project estimated hours must be non-negative
   * 
   * Business Logic Reference: Rule 4
   * Formula: project.estimatedHours >= 0
   * 
   * @param hours - The estimated hours to validate
   * @returns true if hours are non-negative, false otherwise
   */
  static validateEstimatedHours(hours: number): boolean {
    return hours >= 0;
  }

  // ==========================================================================
  // RULE 2: PROJECT DATE VALIDITY
  // ==========================================================================
  
  /**
   * RULE 2: Project start date must be before end date (for time-limited projects)
   * 
   * Business Logic Reference: Rule 3
   * Formula: project.endDate > project.startDate
   * 
   * @param startDate - Project start date
   * @param endDate - Project end date
   * @returns true if date range is valid, false otherwise
   */
  static validateDateRange(startDate: Date, endDate: Date): boolean {
    return startDate < endDate;
  }

  // ==========================================================================
  // RULE 3: CONTINUOUS VS TIME-LIMITED PROJECTS
  // ==========================================================================
  
  /**
   * RULE 3a: Continuous projects don't have end dates
   * 
   * Business Logic Reference: Rule 8
   * 
   * @param project - The project to check
   * @returns true if project is continuous, false otherwise
   */
  static isContinuousProject(project: Project): boolean {
    return project.continuous === true;
  }

  /**
   * RULE 3b: Time-limited projects have both start and end dates
   * 
   * Business Logic Reference: Rule 8
   * 
   * @param project - The project to check
   * @returns true if project is time-limited, false otherwise
   */
  static isTimeLimitedProject(project: Project): boolean {
    return !this.isContinuousProject(project);
  }

  // ==========================================================================
  // RULE 4: MILESTONE BUDGET CONSTRAINT
  // ==========================================================================
  
  /**
   * RULE 4a: Calculate total milestone allocation for a project
   * 
   * Business Logic Reference: Calculation Rule 2
   * Formula: SUM(milestone.timeAllocationHours)
   * 
   * @param milestones - Array of milestones to sum
   * @returns Total hours allocated across all milestones
   */
  static calculateTotalMilestoneAllocation(milestones: Milestone[]): number {
    return milestones.reduce((sum, milestone) => {
      const hours = milestone.timeAllocationHours ?? milestone.timeAllocation ?? 0;
      return sum + hours;
    }, 0);
  }

  /**
   * RULE 4b: Calculate project budget analysis
   * 
   * Business Logic Reference: Rule 1
   * Formula: SUM(milestone.timeAllocationHours) ≤ project.estimatedHours
   * 
   * @param project - The project to analyze
   * @param milestones - The project's milestones
   * @returns Comprehensive budget analysis
   */
  static analyzeBudget(project: Project, milestones: Milestone[]): ProjectBudgetAnalysis {
    const totalEstimatedHours = project.estimatedHours;
    const totalAllocatedHours = this.calculateTotalMilestoneAllocation(milestones);
    const remainingHours = totalEstimatedHours - totalAllocatedHours;
    const utilizationPercent = totalEstimatedHours > 0 ? 
      (totalAllocatedHours / totalEstimatedHours) * 100 : 0;
    const isOverBudget = totalAllocatedHours > totalEstimatedHours;
    const overageHours = Math.max(0, totalAllocatedHours - totalEstimatedHours);
    const suggestedBudget = Math.max(totalEstimatedHours, totalAllocatedHours);

    return {
      totalAllocation: totalAllocatedHours,
      suggestedBudget,
      isOverBudget,
      overageHours,
      utilizationPercentage: utilizationPercent,
      // Legacy properties for backward compatibility
      totalEstimatedHours,
      totalAllocatedHours,
      remainingHours,
      utilizationPercent
    };
  }

  /**
   * RULE 4c: Check if project can accommodate additional milestone hours
   * 
   * Business Logic Reference: Rule 1
   * 
   * @param project - The project to check
   * @param milestones - Current milestones
   * @param additionalHours - Hours to add
   * @returns true if budget can accommodate, false otherwise
   */
  static canAccommodateAdditionalHours(
    project: Project, 
    milestones: Milestone[], 
    additionalHours: number
  ): boolean {
    const analysis = this.analyzeBudget(project, milestones);
    return analysis.remainingHours !== undefined && analysis.remainingHours >= additionalHours;
  }

  // ==========================================================================
  // VALIDATION RULES - COMPREHENSIVE CHECKS
  // ==========================================================================
  
  /**
   * Validate project time constraints
   * 
   * Combines multiple time-related rules:
   * - RULE 4: Positive estimated hours
   * - RULE 1: Milestone allocation ≤ project budget
   * 
   * @param estimatedHours - Project estimated hours
   * @param milestones - Project milestones
   * @returns Detailed validation result
   */
  static validateProjectTime(
    estimatedHours: number,
    milestones: Milestone[]
  ): ProjectTimeValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.validateEstimatedHours(estimatedHours)) {
      errors.push('Project estimated hours must be greater than or equal to 0');
    }

    const totalAllocated = this.calculateTotalMilestoneAllocation(milestones);
    if (totalAllocated > estimatedHours) {
      errors.push(`Total milestone allocation (${totalAllocated}h) exceeds project budget (${estimatedHours}h)`);
    }

    if (totalAllocated > estimatedHours * 0.9) {
      warnings.push('Milestone allocation is over 90% of project budget');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate project date constraints
   * 
   * Combines multiple date-related rules:
   * - RULE 3: Project end date must be after start date
   * - RULE 8: Continuous vs time-limited validation
   * 
   * @param startDate - Project start date
   * @param endDate - Project end date (optional for continuous)
   * @param continuous - Whether project is continuous
   * @returns Detailed validation result
   */
  static validateProjectDates(
    startDate: Date,
    endDate: Date | undefined,
    continuous: boolean = false
  ): ProjectDateValidation {
    const errors: string[] = [];

    if (continuous && endDate) {
      errors.push('Continuous projects should not have an end date');
    }

    if (!continuous && !endDate) {
      errors.push('Time-limited projects must have an end date');
    }

    if (!continuous && endDate && !this.validateDateRange(startDate, endDate)) {
      errors.push('Project start date must be before end date');
    }

    const hasValidRange = continuous || (endDate && this.validateDateRange(startDate, endDate));

    return {
      isValid: errors.length === 0,
      hasValidRange: hasValidRange || false,
      errors
    };
  }

  // ==========================================================================
  // CALCULATION RULES
  // ==========================================================================
  
  /**
   * Calculate project duration in days (for time-limited projects)
   * 
   * Business Logic Reference: Calculation Rule 1
   * Formula: (endDate - startDate) in days
   * 
   * @param project - The project to calculate duration for
   * @returns Duration in days, or null for continuous projects
   */
  static calculateProjectDuration(project: Project): number | null {
    if (this.isContinuousProject(project)) {
      return null; // Continuous projects have no fixed duration
    }

    const diffTime = project.endDate.getTime() - project.startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if a date falls within project timeframe
   * 
   * Business Logic Reference: Edge Case 7
   * 
   * @param date - The date to check
   * @param project - The project to check against
   * @returns true if date is within project timeframe
   */
  static isDateWithinProject(date: Date, project: Project): boolean {
    if (this.isContinuousProject(project)) {
      // For continuous projects, only check if date is after start
      return date >= project.startDate;
    }

    // For time-limited projects, check if date is within range
    return date >= project.startDate && date <= project.endDate;
  }

  /**
   * Calculate suggested milestone budget based on project duration
   * 
   * Business Logic Reference: Calculation Rule 3
   * Formula: project.estimatedHours / milestoneCount
   * 
   * @param project - The project
   * @param milestoneCount - Number of milestones
   * @returns Suggested hours per milestone
   */
  static suggestMilestoneBudget(
    project: Project, 
    milestoneCount: number
  ): number {
    if (milestoneCount <= 0) return 0;
    
    // Domain rule: Distribute budget evenly across milestones as starting point
    return Math.round(project.estimatedHours / milestoneCount);
  }

  /**
   * Format project duration for display
   * 
   * @param project - The project
   * @returns Human-readable duration string
   */
  static formatProjectDuration(project: Project): string {
    const duration = this.calculateProjectDuration(project);
    
    if (duration === null) {
      return 'Ongoing';
    }

    if (duration === 1) {
      return '1 day';
    }

    if (duration < 7) {
      return `${duration} days`;
    }

    const weeks = Math.round(duration / 7);
    if (weeks === 1) {
      return '1 week';
    }

    if (weeks < 5) {
      return `${weeks} weeks`;
    }

    const months = Math.round(duration / 30);
    return months === 1 ? '1 month' : `${months} months`;
  }

  // ==========================================================================
  // STATUS VALIDATION
  // ==========================================================================
  
  /**
   * Check if project status is valid
   * 
   * Business Logic Reference: State Transitions
   * Valid statuses: 'current', 'future', 'archived'
   * 
   * @param status - The status to validate
   * @returns true if status is valid
   */
  static isValidStatus(status?: string): boolean {
    if (!status) return true; // Status is optional
    return ['current', 'future', 'archived'].includes(status);
  }

  // ==========================================================================
  // PHASE TIME DOMAIN RULES - NEW (November 2025)
  // ==========================================================================
  
  /**
   * RULE: Projects with estimated time cannot be fully in the past
   * 
   * If a project has estimated hours > 0, at least one working day must be
   * today or in the future to accommodate that estimated time.
   * 
   * @param project - The project to validate
   * @param phases - The project's phases (milestones with startDate/endDate)
   * @param today - Reference date (defaults to now)
   * @returns Validation result with errors
   */
  static validateProjectNotFullyInPast(
    project: Project,
    phases: Milestone[],
    today: Date = new Date()
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Normalize today to midnight for comparison
    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);
    
    // Only validate if project has estimated time
    if (project.estimatedHours <= 0) {
      return { isValid: true, errors };
    }
    
    // Check if project has phases
    if (phases.length > 0) {
      // For projects with phases, check if any phase end date is today or future
      const hasFuturePhase = phases.some(phase => {
        const phaseEnd = new Date(phase.endDate || phase.dueDate);
        phaseEnd.setHours(0, 0, 0, 0);
        return phaseEnd >= todayMidnight;
      });
      
      if (!hasFuturePhase) {
        errors.push('Project with estimated time must have at least one phase ending today or in the future');
      }
    } else {
      // For projects without phases, check project end date
      if (!project.continuous) {
        const projectEnd = new Date(project.endDate);
        projectEnd.setHours(0, 0, 0, 0);
        
        if (projectEnd < todayMidnight) {
          errors.push('Project with estimated time cannot end in the past');
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Calculate minimum required project end date based on phases
   * 
   * The project end date must be at least the last phase end date to accommodate
   * all phase durations and estimated time.
   * 
   * @param phases - The project's phases
   * @param today - Reference date (defaults to now)
   * @returns Minimum required project end date
   */
  static calculateMinimumProjectEndDate(
    phases: Milestone[],
    today: Date = new Date()
  ): Date {
    if (phases.length === 0) {
      return new Date(today);
    }
    
    // Find the latest phase end date
    const latestPhaseEnd = phases.reduce((latest, phase) => {
      const phaseEnd = new Date(phase.endDate || phase.dueDate);
      return phaseEnd > latest ? phaseEnd : latest;
    }, new Date(today));
    
    return latestPhaseEnd;
  }
  
  /**
   * Adjust project end date to accommodate phases with estimated time
   * 
   * If phases extend beyond the current project end date, the project end date
   * is automatically extended to match.
   * 
   * @param project - The project to adjust
   * @param phases - The project's phases
   * @param today - Reference date (defaults to now)
   * @returns Adjusted project end date
   */
  static adjustProjectEndDateForPhases(
    project: Project,
    phases: Milestone[],
    today: Date = new Date()
  ): Date {
    // Don't adjust continuous projects
    if (project.continuous) {
      return project.endDate;
    }
    
    const minEndDate = this.calculateMinimumProjectEndDate(phases, today);
    const currentEndDate = new Date(project.endDate);
    
    // Return the later of the two dates
    return minEndDate > currentEndDate ? minEndDate : currentEndDate;
  }
}


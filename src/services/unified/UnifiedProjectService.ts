/**
 * UNIFIED PROJECT SERVICE
 * Single source of truth for project business logic
 * Consolidates duplicate project calculations across services
 */

import { Project, Milestone } from '@/types';

// ============================================================================
// PROJECT BUSINESS LOGIC CONSOLIDATION
// ============================================================================

/**
 * Calculate project duration in days
 * Replaces duplicate implementations in:
 * - projectProgressService.calculateProjectDuration
 * - ProjectCalculationService.calculateDuration
 * - ProjectMetricsCalculationService methods
 */
export function calculateProjectDuration(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
}

/**
 * Calculate project progress percentage
 * Single source replacing multiple progress calculations
 */
export function calculateProjectProgress(
  project: Project,
  currentDate: Date = new Date()
): number {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  
  if (currentDate <= startDate) return 0;
  if (currentDate >= endDate) return 100;
  
  const totalDuration = calculateProjectDuration(startDate, endDate);
  const elapsed = calculateProjectDuration(startDate, currentDate);
  
  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

/**
 * Calculate total project workload (estimated hours)
 * Consolidates workload calculations from multiple services
 */
export function calculateProjectWorkload(project: Project): number {
  return project.estimatedHours || 0;
}

/**
 * Calculate daily work hours allocation for project
 * Replaces duplicate daily allocation calculations
 */
export function calculateDailyWorkAllocation(
  project: Project,
  targetDate: Date
): number {
  const projectDuration = calculateProjectDuration(
    new Date(project.startDate),
    new Date(project.endDate)
  );
  
  if (projectDuration <= 0) return 0;
  
  return (project.estimatedHours || 0) / projectDuration;
}

// ============================================================================
// MILESTONE BUSINESS LOGIC CONSOLIDATION  
// ============================================================================

/**
 * Calculate milestone completion status
 * Single source for milestone progress calculations
 */
export function calculateMilestoneProgress(
  milestone: Milestone,
  project: Project,
  currentDate: Date = new Date()
): { completed: boolean; overdue: boolean; progress: number } {
  const milestoneDate = new Date(milestone.dueDate);
  const projectStart = new Date(project.startDate);
  
  const completed = currentDate >= milestoneDate;
  const overdue = currentDate > milestoneDate; // Simplified - no completed field in Milestone type
  
  // Calculate progress based on time elapsed
  const totalTime = milestoneDate.getTime() - projectStart.getTime();
  const elapsedTime = currentDate.getTime() - projectStart.getTime();
  const progress = totalTime > 0 ? Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100)) : 0;
  
  return { completed, overdue, progress };
}

/**
 * Calculate time distribution for milestone
 * Replaces milestoneUtilitiesService.calculateMilestoneTimeDistribution
 */
export function calculateMilestoneTimeDistribution(
  milestone: Milestone,
  project: Project
): { beforeDays: number; afterDays: number; totalDays: number } {
  const projectStart = new Date(project.startDate);
  const projectEnd = new Date(project.endDate);
  const milestoneDate = new Date(milestone.dueDate);
  
  const totalDays = calculateProjectDuration(projectStart, projectEnd);
  const beforeDays = calculateProjectDuration(projectStart, milestoneDate);
  const afterDays = totalDays - beforeDays;
  
  return { beforeDays, afterDays, totalDays };
}

// ============================================================================
// PROJECT VALIDATION & BUSINESS RULES
// ============================================================================

/**
 * Validate project date constraints
 * Consolidated business rule validation
 */
export function validateProjectDates(
  startDate: Date,
  endDate: Date,
  milestones: Milestone[] = []
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic date validation using domain entity
  if (!UnifiedProjectEntity.validateDateRange(startDate, endDate)) {
    errors.push('Project end date must be after start date');
  }

  // Milestone validation
  milestones.forEach(milestone => {
    const milestoneDate = new Date(milestone.dueDate);
    if (milestoneDate < startDate || milestoneDate > endDate) {
      errors.push(`Milestone "${milestone.name || 'Unnamed'}" is outside project date range`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if project is active on given date
 * Single source for project activity checks
 */
export function isProjectActiveOnDate(project: Project, date: Date): boolean {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  
  return date >= startDate && date <= endDate;
}

// ============================================================================
// DELEGATION WRAPPERS (for migration compatibility)
// ============================================================================

/**
 * Legacy wrapper for projectProgressService.calculateProjectDuration
 * TODO: Remove after migration complete
 */
export function calculateProjectDuration_LEGACY(project: Project): number {
  return calculateProjectDuration(
    new Date(project.startDate),
    new Date(project.endDate)
  );
}

// ============================================================================
// PROJECT ENTITY BUSINESS LOGIC (Migrated from core/domain)
// ============================================================================

export interface ProjectBudgetAnalysis {
  totalEstimatedHours: number;
  totalAllocatedHours: number;
  remainingHours: number;
  utilizationPercent: number;
  isOverBudget: boolean;
  overageHours: number;
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

/**
 * Project Domain Rules - Migrated from ProjectEntity
 */
export class UnifiedProjectEntity {
  /**
   * Domain Rule: Project estimated hours must be positive
   */
  static validateEstimatedHours(hours: number): boolean {
    return hours > 0;
  }

  /**
   * Domain Rule: Project start date must be before end date (for time-limited projects)
   */
  static validateDateRange(startDate: Date, endDate: Date): boolean {
    return startDate < endDate;
  }

  /**
   * Domain Rule: Continuous projects don't have end dates
   */
  static isContinuousProject(project: Project): boolean {
    return project.continuous === true;
  }

  /**
   * Domain Rule: Time-limited projects have both start and end dates
   */
  static isTimeLimitedProject(project: Project): boolean {
    return !this.isContinuousProject(project);
  }

  /**
   * Domain Rule: Calculate total milestone allocation for a project
   */
  static calculateTotalMilestoneAllocation(milestones: Milestone[]): number {
    return milestones.reduce((sum, milestone) => sum + (milestone.timeAllocation || 0), 0);
  }

  /**
   * Domain Rule: Calculate project budget analysis
   */
  static analyzeBudget(project: Project, milestones: Milestone[]): ProjectBudgetAnalysis {
    const totalEstimatedHours = project.estimatedHours;
    const totalAllocatedHours = this.calculateTotalMilestoneAllocation(milestones);
    const remainingHours = totalEstimatedHours - totalAllocatedHours;
    const utilizationPercent = totalEstimatedHours > 0 ? 
      (totalAllocatedHours / totalEstimatedHours) * 100 : 0;
    const isOverBudget = totalAllocatedHours > totalEstimatedHours;
    const overageHours = Math.max(0, totalAllocatedHours - totalEstimatedHours);

    return {
      totalEstimatedHours,
      totalAllocatedHours,
      remainingHours,
      utilizationPercent,
      isOverBudget,
      overageHours
    };
  }

  /**
   * Domain Rule: Check if project can accommodate additional milestone hours
   */
  static canAccommodateAdditionalHours(
    project: Project, 
    milestones: Milestone[], 
    additionalHours: number
  ): boolean {
    const analysis = this.analyzeBudget(project, milestones);
    return analysis.remainingHours >= additionalHours;
  }

  /**
   * Domain Rule: Validate project time constraints
   */
  static validateProjectTime(
    estimatedHours: number,
    milestones: Milestone[]
  ): ProjectTimeValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.validateEstimatedHours(estimatedHours)) {
      errors.push('Project estimated hours must be greater than 0');
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
   * Domain Rule: Validate project date constraints
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

  /**
   * Domain Rule: Calculate project duration in days (for time-limited projects)
   */
  static calculateProjectDuration(project: Project): number | null {
    if (this.isContinuousProject(project)) {
      return null; // Continuous projects have no fixed duration
    }

    const diffTime = project.endDate.getTime() - project.startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Domain Rule: Check if a date falls within project timeframe
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
   * Domain Rule: Calculate suggested milestone budget based on project duration
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
   * Domain Rule: Format project duration display
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

  /**
   * Domain Rule: Check if project status is valid
   */
  static isValidStatus(status?: string): boolean {
    if (!status) return true; // Status is optional
    return ['current', 'future', 'archived'].includes(status);
  }
}

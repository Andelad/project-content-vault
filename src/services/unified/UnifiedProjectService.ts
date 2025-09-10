/**
 * UNIFIED PROJECT SERVICE
 * Single source of truth for project business logic
 * Consolidates duplicate project calculations across services
 */

import { Project, Milestone } from '@/types';
import { calculateDurationDays } from '@/services/calculations/dateCalculations';

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
  // ✅ DELEGATE to domain layer - no manual date math!
  return calculateDurationDays(startDate, endDate);
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

  /**
   * Calculate comprehensive project metrics
   * Migrated from ProjectCalculationService
   */
  static calculateProjectMetrics(project: Project, milestones: Milestone[], settings: any) {
    const totalDuration = this.calculateProjectDuration(project);
    const workload = this.calculateTotalProjectWorkload(project, milestones);
    
    const dailyCapacity = this.calculateDailyWorkCapacity(project, settings);
    const weeklyCapacity = this.calculateWeeklyWorkCapacity(project, settings);
    const endDate = this.calculateProjectEndDate(project, milestones, settings);
    
    return {
      duration: totalDuration,
      workload,
      dailyCapacity,
      weeklyCapacity,
      estimatedEndDate: endDate,
      totalMilestones: milestones.length,
      remainingWork: Math.max(0, project.estimatedHours - workload)
    };
  }

  /**
   * Calculate milestone-specific metrics
   * Migrated from ProjectCalculationService
   */
  static calculateMilestoneMetrics(milestones: Milestone[], settings: any) {
    return milestones.map(milestone => ({
      id: milestone.id,
      name: milestone.name,
      dueDate: milestone.dueDate,
      timeAllocation: milestone.timeAllocation,
      daysToComplete: this.calculateMilestoneDaysToComplete(milestone, settings),
      isOverdue: this.isMilestoneOverdue(milestone)
    }));
  }

  /**
   * Calculate daily work capacity for a project
   * Migrated from ProjectCalculationService
   */
  static calculateDailyWorkCapacity(project: Project, settings: any): number {
    const workHoursPerDay = settings?.workHours?.hoursPerDay || 8;
    // Use a default allocation of 1.0 (100%) since allocation isn't in Project type
    return workHoursPerDay;
  }

  /**
   * Calculate weekly work capacity for a project
   * Migrated from ProjectCalculationService
   */
  static calculateWeeklyWorkCapacity(project: Project, settings: any): number {
    const dailyCapacity = this.calculateDailyWorkCapacity(project, settings);
    const workDaysPerWeek = settings?.workHours?.daysPerWeek || 5;
    
    return dailyCapacity * workDaysPerWeek;
  }

  /**
   * Calculate project end date based on remaining work and capacity
   * Migrated from ProjectCalculationService
   */
  static calculateProjectEndDate(project: Project, milestones: Milestone[], settings: any): Date | null {
    const remainingHours = this.calculateRemainingWorkHours(project, milestones);
    const dailyCapacity = this.calculateDailyWorkCapacity(project, settings);
    
    if (remainingHours <= 0 || dailyCapacity <= 0) {
      return null; // Project complete or invalid capacity
    }
    
    const daysRequired = Math.ceil(remainingHours / dailyCapacity);
    const startDate = project.startDate ? new Date(project.startDate) : new Date();
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysRequired);
    
    return endDate;
  }

  /**
   * Check for project overlaps in timeline
   * Migrated from ProjectCalculationService
   */
  static calculateProjectOverlaps(projects: Project[]): Array<{
    project1: string;
    project2: string;
    overlapDays: number;
    severity: 'low' | 'medium' | 'high';
  }> {
    const overlaps: Array<{
      project1: string;
      project2: string;
      overlapDays: number;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const project1 = projects[i];
        const project2 = projects[j];
        
        const overlap = this.calculateOverlapDays(project1, project2);
        if (overlap > 0) {
          const severity = this.getOverlapSeverity(overlap, 1.0, 1.0); // Default allocation
          overlaps.push({
            project1: project1.id,
            project2: project2.id,
            overlapDays: overlap,
            severity
          });
        }
      }
    }

    return overlaps;
  }

  /**
   * Validate milestone timeline consistency
   * Migrated from ProjectCalculationService
   */
  static validateMilestoneTimeline(project: Project, milestones: Milestone[]): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if milestones are within project bounds
    if (project.startDate && project.endDate) {
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);

      milestones.forEach(milestone => {
        if (milestone.dueDate) {
          const milestoneDate = new Date(milestone.dueDate);
          if (milestoneDate < projectStart) {
            issues.push(`Milestone "${milestone.name}" is scheduled before project start date`);
            suggestions.push(`Move milestone "${milestone.name}" to after ${projectStart.toDateString()}`);
          }
          if (milestoneDate > projectEnd) {
            issues.push(`Milestone "${milestone.name}" is scheduled after project end date`);
            suggestions.push(`Move milestone "${milestone.name}" to before ${projectEnd.toDateString()}`);
          }
        }
      });
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  // Helper methods for the new functionality
  private static calculateMilestoneDaysToComplete(milestone: Milestone, settings: any): number {
    const hoursPerDay = settings?.workHours?.hoursPerDay || 8;
    return Math.ceil(milestone.timeAllocation / hoursPerDay);
  }

  private static isMilestoneOverdue(milestone: Milestone): boolean {
    return new Date(milestone.dueDate) < new Date();
  }

  private static calculateRemainingWorkHours(project: Project, milestones: Milestone[]): number {
    const totalAllocatedHours = milestones.reduce((total, milestone) => total + milestone.timeAllocation, 0);
    return Math.max(0, project.estimatedHours - totalAllocatedHours);
  }

  private static calculateTotalProjectWorkload(project: Project, milestones: Milestone[]): number {
    return milestones.reduce((total, milestone) => total + milestone.timeAllocation, 0);
  }

  private static calculateOverlapDays(project1: Project, project2: Project): number {
    if (!project1.startDate || !project1.endDate || !project2.startDate || !project2.endDate) {
      return 0;
    }

    const start1 = new Date(project1.startDate);
    const end1 = new Date(project1.endDate);
    const start2 = new Date(project2.startDate);
    const end2 = new Date(project2.endDate);

    const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
    const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));

    if (overlapStart <= overlapEnd) {
      return Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
    }

    return 0;
  }

  private static getOverlapSeverity(overlapDays: number, allocation1: number, allocation2: number): 'low' | 'medium' | 'high' {
    const totalAllocation = allocation1 + allocation2;
    
    if (totalAllocation > 1.5 && overlapDays > 14) return 'high';
    if (totalAllocation > 1.2 && overlapDays > 7) return 'medium';
    return 'low';
  }
}

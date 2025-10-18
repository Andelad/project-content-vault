/**
 * UNIFIED PROJECT SERVICE
 * 
 * RESPONSIBILITY: Core project entity calculations and business logic
 * 
 * USE WHEN:
 * - Calculating project duration, workload, or daily allocation
 * - Validating project dates or business rules
 * - Analyzing project budget vs milestone allocation
 * - Working with project properties (no event/time-tracking data needed)
 * 
 * DON'T USE WHEN:
 * - You need progress tracking with actual work hours → Use UnifiedProjectProgressService
 * - You need timeline rendering calculations → Use UnifiedDayEstimateService
 * - You need UI positioning → Use services/ui/TimelinePositioning
 * 
 * DELEGATES TO: 
 * - calculations/dateCalculations (date math)
 * - UnifiedProjectEntity (domain rules)
 * 
 * @see UnifiedProjectProgressService for progress tracking with calendar events
 * @see UnifiedDayEstimateService for day-by-day timeline calculations
 * @see UnifiedTimelineService for timeline UI coordination
 */

import { Project, Milestone } from '@/types';
import { calculateDurationDays } from '@/services/calculations/dateCalculations';
import { ProjectRules } from '@/domain/rules/ProjectRules';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProjectBudgetAnalysis {
  totalAllocation: number;          // Total hours allocated to milestones
  suggestedBudget: number;           // Suggested project budget
  isOverBudget: boolean;             // Whether allocation exceeds budget
  overageHours: number;              // Hours over budget
  utilizationPercentage: number;     // Percentage of budget utilized
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

export interface MilestoneProgress {
  completed: boolean;
  overdue: boolean;
  progress: number;
}

export interface MilestoneTimeDistribution {
  beforeDays: number;
  afterDays: number;
  totalDays: number;
}

// ============================================================================
// UNIFIED PROJECT SERVICE - CLASS-BASED PATTERN
// ============================================================================

/**
 * Unified Project Service
 * 
 * Single source of truth for project entity operations and business logic.
 * All methods are static - this is a service class, not an entity.
 */
export class UnifiedProjectService {
  
  // ==========================================================================
  // PROJECT DURATION & TIME CALCULATIONS
  // ==========================================================================
  
  /**
   * Calculate project duration in days
   * Replaces duplicate implementations across legacy services
   */
  static calculateDuration(startDate: Date, endDate: Date): number {
    return calculateDurationDays(startDate, endDate);
  }
  
  /**
   * Calculate project duration from project entity
   */
  static calculateProjectDuration(project: Project): number {
    return this.calculateDuration(
      new Date(project.startDate),
      new Date(project.endDate)
    );
  }
  
  /**
   * Calculate time-based progress percentage (no event data)
   * For actual work progress, use UnifiedProjectProgressService
   */
  static calculateTimeProgress(
    project: Project,
    currentDate: Date = new Date()
  ): number {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    
    if (currentDate <= startDate) return 0;
    if (currentDate >= endDate) return 100;
    
    const totalDuration = this.calculateDuration(startDate, endDate);
    const elapsed = this.calculateDuration(startDate, currentDate);
    
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  }
  
  /**
   * Calculate daily work hours allocation for project
   */
  static calculateDailyAllocation(project: Project): number {
    const projectDuration = this.calculateProjectDuration(project);
    if (projectDuration <= 0) return 0;
    return (project.estimatedHours || 0) / projectDuration;
  }
  
  /**
   * Get total project workload (estimated hours)
   */
  static getWorkload(project: Project): number {
    return project.estimatedHours || 0;
  }
  
  // ==========================================================================
  // PROJECT VALIDATION
  // ==========================================================================
  
  /**
   * Validate project date constraints
   */
  static validateDates(
    startDate: Date,
    endDate: Date,
    milestones: Milestone[] = []
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Use domain rules for date validation
    if (!ProjectRules.validateDateRange(startDate, endDate)) {
      errors.push('Project end date must be after start date');
    }

    milestones.forEach(milestone => {
      const milestoneDate = milestone.endDate || milestone.dueDate;
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
   */
  static isActiveOnDate(project: Project, date: Date): boolean {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    return date >= startDate && date <= endDate;
  }
  
  // ==========================================================================
  // MILESTONE CALCULATIONS (Time-based only)
  // ==========================================================================
  
  /**
   * Calculate milestone time-based status (no event data)
   * For work-based milestone progress, use UnifiedProjectProgressService
   */
  static calculateMilestoneStatus(
    milestone: Milestone,
    project: Project,
    currentDate: Date = new Date()
  ): MilestoneProgress {
    const milestoneDate = milestone.endDate || milestone.dueDate;
    const projectStart = new Date(project.startDate);
    
    const completed = currentDate >= milestoneDate;
    const overdue = currentDate > milestoneDate;
    
    const totalTime = milestoneDate.getTime() - projectStart.getTime();
    const elapsedTime = currentDate.getTime() - projectStart.getTime();
    const progress = totalTime > 0 ? 
      Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100)) : 0;
    
    return { completed, overdue, progress };
  }
  
  /**
   * Calculate time distribution for milestone
   */
  static calculateMilestoneDistribution(
    milestone: Milestone,
    project: Project
  ): MilestoneTimeDistribution {
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    const milestoneDate = milestone.endDate || milestone.dueDate;
    
    const totalDays = this.calculateDuration(projectStart, projectEnd);
    const beforeDays = this.calculateDuration(projectStart, milestoneDate);
    const afterDays = totalDays - beforeDays;
    
    return { beforeDays, afterDays, totalDays };
  }
  
  // ==========================================================================
  // BUDGET & ALLOCATION ANALYSIS
  // ==========================================================================
  
  /**
   * Analyze project budget vs milestone allocation
   */
  static analyzeBudget(project: Project, milestones: Milestone[]): ProjectBudgetAnalysis {
    return UnifiedProjectEntity.analyzeBudget(project, milestones);
  }
  
  /**
   * Validate project time constraints
   */
  static validateTimeConstraints(
    estimatedHours: number,
    milestones: Milestone[]
  ): ProjectTimeValidation {
    return UnifiedProjectEntity.validateProjectTime(estimatedHours, milestones);
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY - Legacy Function Exports
// ============================================================================

/**
 * @deprecated Use UnifiedProjectService.calculateDuration() instead
 */
export function calculateProjectDuration(startDate: Date, endDate: Date): number {
  return UnifiedProjectService.calculateDuration(startDate, endDate);
}

/**
 * @deprecated Use UnifiedProjectService.calculateTimeProgress() instead
 */
export function calculateProjectProgress(
  project: Project,
  currentDate: Date = new Date()
): number {
  return UnifiedProjectService.calculateTimeProgress(project, currentDate);
}

/**
 * @deprecated Use UnifiedProjectService.getWorkload() instead
 */
export function calculateProjectWorkload(project: Project): number {
  return UnifiedProjectService.getWorkload(project);
}

/**
 * @deprecated Use UnifiedProjectService.calculateDailyAllocation() instead
 */
export function calculateDailyWorkAllocation(project: Project, targetDate: Date): number {
  return UnifiedProjectService.calculateDailyAllocation(project);
}

/**
 * @deprecated Use UnifiedProjectService.calculateMilestoneStatus() instead
 */
export function calculateMilestoneProgress(
  milestone: Milestone,
  project: Project,
  currentDate: Date = new Date()
): MilestoneProgress {
  return UnifiedProjectService.calculateMilestoneStatus(milestone, project, currentDate);
}

/**
 * @deprecated Use UnifiedProjectService.calculateMilestoneDistribution() instead
 */
export function calculateMilestoneTimeDistribution(
  milestone: Milestone,
  project: Project
): MilestoneTimeDistribution {
  return UnifiedProjectService.calculateMilestoneDistribution(milestone, project);
}

/**
 * @deprecated Use UnifiedProjectService.validateDates() instead
 */
export function validateProjectDates(
  startDate: Date,
  endDate: Date,
  milestones: Milestone[] = []
): { valid: boolean; errors: string[] } {
  return UnifiedProjectService.validateDates(startDate, endDate, milestones);
}

/**
 * @deprecated Use UnifiedProjectService.isActiveOnDate() instead
 */
export function isProjectActiveOnDate(project: Project, date: Date): boolean {
  return UnifiedProjectService.isActiveOnDate(project, date);
}

/**
 * @deprecated Legacy wrapper - use UnifiedProjectService.calculateProjectDuration() instead
 */
export function calculateProjectDuration_LEGACY(project: Project): number {
  return UnifiedProjectService.calculateProjectDuration(project);
}

// ============================================================================
// PROJECT ENTITY DOMAIN LOGIC
// ============================================================================

/**
 * Project Domain Entity
 * 
 * DEPRECATED: This class is being migrated to the domain layer.
 * All methods now delegate to ProjectRules in src/domain/rules/ProjectRules.ts
 * 
 * @deprecated Use ProjectRules from @/domain instead
 * @see ProjectRules in src/domain/rules/ProjectRules.ts
 */
export class UnifiedProjectEntity {
  /**
   * Domain Rule: Project estimated hours must be positive
   * @deprecated Use ProjectRules.validateEstimatedHours() instead
   */
  static validateEstimatedHours(hours: number): boolean {
    return ProjectRules.validateEstimatedHours(hours);
  }

  /**
   * Domain Rule: Project start date must be before end date (for time-limited projects)
   * @deprecated Use ProjectRules.validateDateRange() instead
   */
  static validateDateRange(startDate: Date, endDate: Date): boolean {
    return ProjectRules.validateDateRange(startDate, endDate);
  }

  /**
   * Domain Rule: Continuous projects don't have end dates
   * @deprecated Use ProjectRules.isContinuousProject() instead
   */
  static isContinuousProject(project: Project): boolean {
    return ProjectRules.isContinuousProject(project);
  }

  /**
   * Domain Rule: Time-limited projects have both start and end dates
   * @deprecated Use ProjectRules.isTimeLimitedProject() instead
   */
  static isTimeLimitedProject(project: Project): boolean {
    return ProjectRules.isTimeLimitedProject(project);
  }

  /**
   * Domain Rule: Calculate total milestone allocation for a project
   * @deprecated Use ProjectRules.calculateTotalMilestoneAllocation() instead
   */
  static calculateTotalMilestoneAllocation(milestones: Milestone[]): number {
    return ProjectRules.calculateTotalMilestoneAllocation(milestones);
  }

  /**
   * Domain Rule: Calculate project budget analysis
   * @deprecated Use ProjectRules.analyzeBudget() instead
   */
  static analyzeBudget(project: Project, milestones: Milestone[]): ProjectBudgetAnalysis {
    return ProjectRules.analyzeBudget(project, milestones);
  }

  /**
   * Domain Rule: Check if project can accommodate additional milestone hours
   * @deprecated Use ProjectRules.canAccommodateAdditionalHours() instead
   */
  static canAccommodateAdditionalHours(
    project: Project, 
    milestones: Milestone[], 
    additionalHours: number
  ): boolean {
    return ProjectRules.canAccommodateAdditionalHours(project, milestones, additionalHours);
  }

  /**
   * Domain Rule: Validate project time constraints
   * @deprecated Use ProjectRules.validateProjectTime() instead
   */
  static validateProjectTime(
    estimatedHours: number,
    milestones: Milestone[]
  ): ProjectTimeValidation {
    return ProjectRules.validateProjectTime(estimatedHours, milestones);
  }

  /**
   * Domain Rule: Validate project date constraints
   * @deprecated Use ProjectRules.validateProjectDates() instead
   */
  static validateProjectDates(
    startDate: Date,
    endDate: Date | undefined,
    continuous: boolean = false
  ): ProjectDateValidation {
    return ProjectRules.validateProjectDates(startDate, endDate, continuous);
  }

  /**
   * Domain Rule: Calculate project duration in days (for time-limited projects)
   * @deprecated Use ProjectRules.calculateProjectDuration() instead
   */
  static calculateProjectDuration(project: Project): number | null {
    return ProjectRules.calculateProjectDuration(project);
  }

  /**
   * Domain Rule: Check if a date falls within project timeframe
   * @deprecated Use ProjectRules.isDateWithinProject() instead
   */
  static isDateWithinProject(date: Date, project: Project): boolean {
    return ProjectRules.isDateWithinProject(date, project);
  }

  /**
   * Domain Rule: Calculate suggested milestone budget based on project duration
   * @deprecated Use ProjectRules.suggestMilestoneBudget() instead
   */
  static suggestMilestoneBudget(
    project: Project, 
    milestoneCount: number
  ): number {
    return ProjectRules.suggestMilestoneBudget(project, milestoneCount);
  }

  /**
   * Domain Rule: Format project duration display
   * @deprecated Use ProjectRules.formatProjectDuration() instead
   */
  static formatProjectDuration(project: Project): string {
    return ProjectRules.formatProjectDuration(project);
  }

  /**
   * Domain Rule: Check if project status is valid
   * @deprecated Use ProjectRules.isValidStatus() instead
   */
  static isValidStatus(status?: string): boolean {
    return ProjectRules.isValidStatus(status);
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
        if (milestone.endDate || milestone.dueDate) {
          const milestoneDate = milestone.endDate || milestone.dueDate;
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
    const timeAllocation = milestone.timeAllocationHours ?? milestone.timeAllocation;
    return Math.ceil(timeAllocation / hoursPerDay);
  }

  private static isMilestoneOverdue(milestone: Milestone): boolean {
    const milestoneDate = milestone.endDate || milestone.dueDate;
    return milestoneDate < new Date();
  }

  private static calculateRemainingWorkHours(project: Project, milestones: Milestone[]): number {
    const totalAllocatedHours = milestones.reduce((total, milestone) => {
      const hours = milestone.timeAllocationHours ?? milestone.timeAllocation;
      return total + hours;
    }, 0);
    return Math.max(0, project.estimatedHours - totalAllocatedHours);
  }

  private static calculateTotalProjectWorkload(project: Project, milestones: Milestone[]): number {
    return milestones.reduce((total, milestone) => {
      const hours = milestone.timeAllocationHours ?? milestone.timeAllocation;
      return total + hours;
    }, 0);
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

/**
 * UNIFIED PROJECT SERVICE
 * 
 * RESPONSIBILITY: Core project entity calculations and business logic
 * 
 * USE WHEN:
 * - Calculating project duration, workload, or daily allocation
 * - Validating project dates or business rules
 * - Analyzing project budget vs phase allocation
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

import { Project, PhaseDTO, Settings } from '@/types';
import { calculateDurationDays } from '@/services/calculations/general/dateCalculations';
import { ProjectRules } from '@/domain/rules/ProjectRules';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProjectBudgetAnalysis {
  totalAllocation: number;          // Total hours allocated to phases
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
    phases: PhaseDTO[] = []
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Use domain rules for date validation
    if (!ProjectRules.validateDateRange(startDate, endDate)) {
      errors.push('Project end date must be after start date');
    }

    phases.forEach(phase => {
      const phaseDate = phase.endDate || phase.dueDate;
      if (phaseDate < startDate || phaseDate > endDate) {
        errors.push(`Phase "${phase.name || 'Unnamed'}" is outside project date range`);
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
  // PHASE CALCULATIONS (Time-based only)
  // ==========================================================================
  
  /**
   * Calculate phase time-based status (no event data)
   * For work-based phase progress, use UnifiedProjectProgressService
   */
  static calculatePhaseStatus(
    phase: PhaseDTO,
    project: Project,
    currentDate: Date = new Date()
  ): MilestoneProgress {
    const phaseDate = phase.endDate || phase.dueDate;
    const projectStart = new Date(project.startDate);
    
    const completed = currentDate >= phaseDate;
    const overdue = currentDate > phaseDate;
    
    const totalTime = phaseDate.getTime() - projectStart.getTime();
    const elapsedTime = currentDate.getTime() - projectStart.getTime();
    const progress = totalTime > 0 ? 
      Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100)) : 0;
    
    return { completed, overdue, progress };
  }
  
  /**
   * Calculate time distribution for phase
   */
  static calculatePhaseDistribution(
    phase: PhaseDTO,
    project: Project
  ): MilestoneTimeDistribution {
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    const phaseDate = phase.endDate || phase.dueDate;
    
    const totalDays = this.calculateDuration(projectStart, projectEnd);
    const beforeDays = this.calculateDuration(projectStart, phaseDate);
    const afterDays = totalDays - beforeDays;
    
    return { beforeDays, afterDays, totalDays };
  }
  
  /**
   * @deprecated Use calculatePhaseStatus instead. Kept for backward compatibility.
   */
  static calculateMilestoneStatus(
    phase: PhaseDTO,
    project: Project,
    currentDate: Date = new Date()
  ): MilestoneProgress {
    return this.calculatePhaseStatus(phase, project, currentDate);
  }
  
  /**
   * @deprecated Use calculatePhaseDistribution instead. Kept for backward compatibility.
   */
  static calculateMilestoneDistribution(
    phase: PhaseDTO,
    project: Project
  ): MilestoneTimeDistribution {
    return this.calculatePhaseDistribution(phase, project);
  }
  
  // ==========================================================================
  // BUDGET & ALLOCATION ANALYSIS
  // ==========================================================================
  
  /**
   * Analyze project budget vs phase allocation
   * Delegates to domain rules (no wrapper layer)
   */
  static analyzeBudget(project: Project, phases: PhaseDTO[]): ProjectBudgetAnalysis {
    return ProjectRules.analyzeBudget(project, phases);
  }
  
  /**
   * Validate project time constraints
   * Delegates to domain rules (no wrapper layer)
   */
  static validateTimeConstraints(
    estimatedHours: number,
    phases: PhaseDTO[]
  ): ProjectTimeValidation {
    return ProjectRules.validateProjectTime(estimatedHours, phases);
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
 * @deprecated Use UnifiedProjectService.calculatePhaseStatus() instead
 */
export function calculateMilestoneProgress(
  milestone: PhaseDTO,
  project: Project,
  currentDate: Date = new Date()
): MilestoneProgress {
  return UnifiedProjectService.calculatePhaseStatus(milestone, project, currentDate);
}

/**
 * @deprecated Use UnifiedProjectService.calculatePhaseDistribution() instead
 */
export function calculateMilestoneTimeDistribution(
  milestone: PhaseDTO,
  project: Project
): MilestoneTimeDistribution {
  return UnifiedProjectService.calculatePhaseDistribution(milestone, project);
}

/**
 * @deprecated Use UnifiedProjectService.validateDates() instead
 */
export function validateProjectDates(
  startDate: Date,
  endDate: Date,
  phases: PhaseDTO[] = []
): { valid: boolean; errors: string[] } {
  return UnifiedProjectService.validateDates(startDate, endDate, phases);
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
  static calculateTotalMilestoneAllocation(phases: PhaseDTO[]): number {
    return ProjectRules.calculateTotalMilestoneAllocation(phases);
  }

  /**
   * Domain Rule: Calculate project budget analysis
   * @deprecated Use ProjectRules.analyzeBudget() instead
   */
  static analyzeBudget(project: Project, phases: PhaseDTO[]): ProjectBudgetAnalysis {
    return ProjectRules.analyzeBudget(project, phases);
  }

  /**
   * Domain Rule: Check if project can accommodate additional milestone hours
   * @deprecated Use ProjectRules.canAccommodateAdditionalHours() instead
   */
  static canAccommodateAdditionalHours(
    project: Project, 
    phases: PhaseDTO[], 
    additionalHours: number
  ): boolean {
    return ProjectRules.canAccommodateAdditionalHours(project, phases, additionalHours);
  }

  /**
   * Domain Rule: Validate project time constraints
   * @deprecated Use ProjectRules.validateProjectTime() instead
   */
  static validateProjectTime(
    estimatedHours: number,
    phases: PhaseDTO[]
  ): ProjectTimeValidation {
    return ProjectRules.validateProjectTime(estimatedHours, phases);
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
  static calculateProjectMetrics(project: Project, phases: PhaseDTO[], settings: Settings) {
    const totalDuration = this.calculateProjectDuration(project);
    const workload = this.calculateTotalProjectWorkload(project, phases);
    
    const dailyCapacity = this.calculateDailyWorkCapacity(project, settings);
    const weeklyCapacity = this.calculateWeeklyWorkCapacity(project, settings);
    const endDate = this.calculateProjectEndDate(project, phases, settings);
    
    return {
      duration: totalDuration,
      workload,
      dailyCapacity,
      weeklyCapacity,
      estimatedEndDate: endDate,
      totalMilestones: phases.length, // Legacy field name; represents total phases
      remainingWork: Math.max(0, project.estimatedHours - workload)
    };
  }

  /**
   * Calculate phase-specific metrics
   * Migrated from ProjectCalculationService
   */
  static calculatePhaseMetrics(phases: PhaseDTO[], settings: Settings) {
    return phases.map(phase => ({
      id: phase.id,
      name: phase.name,
      dueDate: phase.dueDate,
      timeAllocation: phase.timeAllocation,
      daysToComplete: this.calculatePhaseDaysToComplete(phase, settings),
      isOverdue: this.isPhaseOverdue(phase)
    }));
  }

  /**
   * @deprecated Use calculatePhaseMetrics instead
   */
  static calculateMilestoneMetrics(milestones: PhaseDTO[], settings: Settings) {
    return this.calculatePhaseMetrics(milestones, settings);
  }

  /**
   * Calculate daily work capacity for a project
   * Migrated from ProjectCalculationService
   */
  static calculateDailyWorkCapacity(project: Project, settings: Settings): number {
    const workHoursPerDay = (settings as Settings & { workHours?: { hoursPerDay?: number } })?.workHours?.hoursPerDay || 8;
    // Use a default allocation of 1.0 (100%) since allocation isn't in Project type
    return workHoursPerDay;
  }

  /**
   * Calculate weekly work capacity for a project
   * Migrated from ProjectCalculationService
   */
  static calculateWeeklyWorkCapacity(project: Project, settings: Settings): number {
    const dailyCapacity = this.calculateDailyWorkCapacity(project, settings);
    const workDaysPerWeek = (settings as Settings & { workHours?: { daysPerWeek?: number } })?.workHours?.daysPerWeek || 5;
    
    return dailyCapacity * workDaysPerWeek;
  }

  /**
   * Calculate project end date based on remaining work and capacity
   * Migrated from ProjectCalculationService
   */
  static calculateProjectEndDate(project: Project, phases: PhaseDTO[], settings: Settings): Date | null {
    const remainingHours = this.calculateRemainingWorkHours(project, phases);
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
  static validateMilestoneTimeline(project: Project, phases: PhaseDTO[]): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if phases are within project bounds
    if (project.startDate && project.endDate) {
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);

      phases.forEach(phase => {
        if (phase.endDate || phase.dueDate) {
          const phaseDate = phase.endDate || phase.dueDate;
          if (phaseDate < projectStart) {
            issues.push(`Phase "${phase.name}" is scheduled before project start date`);
            suggestions.push(`Move phase "${phase.name}" to after ${projectStart.toDateString()}`);
          }
          if (phaseDate > projectEnd) {
            issues.push(`Phase "${phase.name}" is scheduled after project end date`);
            suggestions.push(`Move phase "${phase.name}" to before ${projectEnd.toDateString()}`);
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

  // Helper methods for phase calculations
  private static calculatePhaseDaysToComplete(phase: PhaseDTO, settings: Settings): number {
    const hoursPerDay = (settings as Settings & { workHours?: { hoursPerDay?: number } })?.workHours?.hoursPerDay || 8;
    const timeAllocation = phase.timeAllocationHours ?? phase.timeAllocation;
    return Math.ceil(timeAllocation / hoursPerDay);
  }

  private static isPhaseOverdue(phase: PhaseDTO): boolean {
    const phaseDate = phase.endDate || phase.dueDate;
    return phaseDate < new Date();
  }
  
  /**
   * @deprecated Use calculatePhaseDaysToComplete instead. Kept for backward compatibility.
   */
  private static calculateMilestoneDaysToComplete(phase: PhaseDTO, settings: Settings): number {
    return this.calculatePhaseDaysToComplete(phase, settings);
  }
  
  /**
   * @deprecated Use isPhaseOverdue instead. Kept for backward compatibility.
   */
  private static isMilestoneOverdue(phase: PhaseDTO): boolean {
    return this.isPhaseOverdue(phase);
  }

  private static calculateRemainingWorkHours(project: Project, phases: PhaseDTO[]): number {
    const totalAllocatedHours = phases.reduce((total, phase) => {
      const hours = phase.timeAllocationHours ?? phase.timeAllocation;
      return total + hours;
    }, 0);
    return Math.max(0, project.estimatedHours - totalAllocatedHours);
  }

  private static calculateTotalProjectWorkload(project: Project, phases: PhaseDTO[]): number {
    return phases.reduce((total, phase) => {
      const hours = phase.timeAllocationHours ?? phase.timeAllocation;
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

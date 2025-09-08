/**
 * Project Timeline Orchestrator
 * 
 * Single source of truth for all project temporal logic including milestone scheduling.
 * Treats milestones as segments of project time, not independent entities.
 * 
 * ✅ Eliminates competing validation logic
 * ✅ Single timeline validation pathway  
 * ✅ Milestones constrained by project boundaries
 * ✅ Centralized scheduling logic
 */

import { Project, Milestone } from '@/types/core';
import { UnifiedProjectEntity, UnifiedMilestoneEntity } from '../unified';

export interface TimelineValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  schedulingIssues?: string[];
}

export interface MilestoneSchedulingRequest {
  name: string;
  timeAllocation: number;
  dueDate: Date;
  projectId: string;
}

export interface MilestoneSchedulingAnalysis {
  canSchedule: boolean;
  suggestedDate?: Date;
  conflicts: string[];
  budgetImpact: {
    newUtilization: number;
    remainingBudget: number;
    exceedsBudget: boolean;
  };
}

/**
 * Project Timeline Orchestrator
 * Handles all project time and milestone scheduling logic
 */
export class ProjectTimelineOrchestrator {

  // ============================================================================
  // PROJECT TEMPORAL VALIDATION (Foundation Layer)
  // ============================================================================

  /**
   * Validate project timeframe with milestone constraints
   * SINGLE SOURCE OF TRUTH for project time validation
   */
  static validateProjectTimeframe(
    startDate: Date,
    endDate: Date,
    milestones: Milestone[] = [],
    continuous: boolean = false
  ): TimelineValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const schedulingIssues: string[] = [];

    // Basic project date validation
    if (!UnifiedProjectEntity.validateDateRange(startDate, endDate)) {
      errors.push('Project end date must be after start date');
    }

    // Validate each milestone fits within project bounds
    const projectStart = new Date(startDate);
    const projectEnd = new Date(endDate);
    
    milestones.forEach((milestone, index) => {
      const milestoneDate = new Date(milestone.dueDate);
      
      if (milestoneDate < projectStart) {
        errors.push(`Milestone "${milestone.name || `#${index + 1}`}" is before project start`);
      }
      
      if (milestoneDate > projectEnd) {
        errors.push(`Milestone "${milestone.name || `#${index + 1}`}" is after project end`);
      }
    });

    // Check for milestone scheduling conflicts
    const conflicts = this.findMilestoneConflicts(milestones);
    conflicts.forEach(conflict => {
      schedulingIssues.push(`Multiple milestones scheduled for ${conflict.date.toDateString()}`);
    });

    // Validate milestone spacing
    const spacingIssues = this.validateMilestoneSpacing(milestones);
    schedulingIssues.push(...spacingIssues);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      schedulingIssues: schedulingIssues.length > 0 ? schedulingIssues : undefined
    };
  }

  /**
   * Calculate project duration (central calculation)
   */
  static calculateProjectDuration(startDate: Date, endDate: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
  }

  /**
   * Check if project is active on given date
   */
  static isProjectActiveOnDate(project: Project, date: Date): boolean {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    return date >= startDate && date <= endDate;
  }

  // ============================================================================
  // MILESTONE SCHEDULING (Milestones as Project Segments)
  // ============================================================================

  /**
   * Validate milestone scheduling within project context
   * SINGLE VALIDATION PATHWAY - no competing logic
   */
  static validateMilestoneScheduling(
    request: MilestoneSchedulingRequest,
    project: Project,
    existingMilestones: Milestone[]
  ): MilestoneSchedulingAnalysis {
    const conflicts: string[] = [];
    
    // 1. Verify milestone fits within project timeframe
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    const requestedDate = new Date(request.dueDate);
    
    if (requestedDate < projectStart || requestedDate > projectEnd) {
      conflicts.push('Milestone date must be within project timeframe');
    }

    // 2. Check for date conflicts with existing milestones
    const hasDateConflict = existingMilestones.some(m => {
      const existingDate = new Date(m.dueDate);
      return Math.abs(existingDate.getTime() - requestedDate.getTime()) < (24 * 60 * 60 * 1000);
    });

    if (hasDateConflict) {
      conflicts.push('Another milestone already exists on or near this date');
    }

    // 3. Budget validation
    const currentAllocation = existingMilestones.reduce((sum, m) => sum + m.timeAllocation, 0);
    const newAllocation = currentAllocation + request.timeAllocation;
    const exceedsBudget = newAllocation > project.estimatedHours;
    const newUtilization = project.estimatedHours > 0 ? (newAllocation / project.estimatedHours) * 100 : 0;
    const remainingBudget = project.estimatedHours - newAllocation;

    if (exceedsBudget) {
      conflicts.push(`Would exceed project budget by ${newAllocation - project.estimatedHours} hours`);
    }

    // 4. Suggest alternative date if conflicts exist
    let suggestedDate: Date | undefined;
    if (conflicts.length > 0 && !exceedsBudget) {
      suggestedDate = this.suggestAlternativeMilestoneDate(
        requestedDate,
        project,
        existingMilestones
      );
    }

    return {
      canSchedule: conflicts.length === 0,
      suggestedDate,
      conflicts,
      budgetImpact: {
        newUtilization,
        remainingBudget,
        exceedsBudget
      }
    };
  }

  /**
   * Suggest milestone dates for a project
   */
  static suggestMilestoneDates(
    project: Project,
    requestedCount: number,
    budgetPerMilestone?: number
  ): Partial<MilestoneSchedulingRequest>[] {
    if (requestedCount <= 0) return [];

    const suggestions: Partial<MilestoneSchedulingRequest>[] = [];
    const projectDuration = this.calculateProjectDuration(
      new Date(project.startDate),
      new Date(project.endDate)
    );

    const intervalDays = Math.floor(projectDuration / (requestedCount + 1));
    const defaultBudget = budgetPerMilestone || 
      Math.floor((project.estimatedHours * 0.8) / requestedCount); // 80% of budget distributed

    for (let i = 1; i <= requestedCount; i++) {
      const dueDate = new Date(project.startDate);
      dueDate.setDate(dueDate.getDate() + (intervalDays * i));

      suggestions.push({
        name: `Milestone ${i}`,
        timeAllocation: defaultBudget,
        dueDate,
        projectId: project.id
      });
    }

    return suggestions;
  }

  /**
   * Validate if a milestone can be moved to a new date
   */
  static canMoveMilestone(
    milestoneId: string,
    newDate: Date,
    project: Project,
    allMilestones: Milestone[]
  ): { canMove: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Filter out the milestone being moved
    const otherMilestones = allMilestones.filter(m => m.id !== milestoneId);
    
    // Check project boundaries
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    
    if (newDate < projectStart || newDate > projectEnd) {
      issues.push('New date must be within project timeframe');
    }

    // Check conflicts with other milestones
    const hasConflict = otherMilestones.some(m => {
      const existingDate = new Date(m.dueDate);
      return Math.abs(existingDate.getTime() - newDate.getTime()) < (24 * 60 * 60 * 1000);
    });

    if (hasConflict) {
      issues.push('Conflicts with existing milestone date');
    }

    return {
      canMove: issues.length === 0,
      issues
    };
  }

  // ============================================================================
  // BUDGET ALLOCATION (Time-based)
  // ============================================================================

  /**
   * Validate budget allocation across milestones
   */
  static validateBudgetAllocation(
    milestones: Milestone[],
    projectEstimatedHours: number
  ): {
    isValid: boolean;
    totalAllocated: number;
    utilizationPercent: number;
    overageHours?: number;
  } {
    const totalAllocated = milestones.reduce((sum, m) => sum + m.timeAllocation, 0);
    const utilizationPercent = projectEstimatedHours > 0 ? 
      (totalAllocated / projectEstimatedHours) * 100 : 0;
    const isValid = totalAllocated <= projectEstimatedHours;
    
    return {
      isValid,
      totalAllocated,
      utilizationPercent,
      overageHours: isValid ? undefined : totalAllocated - projectEstimatedHours
    };
  }

  /**
   * Calculate time distribution for milestones
   */
  static calculateTimeDistribution(
    milestones: Milestone[],
    project: Project
  ): Array<{
    milestone: Milestone;
    startDate: Date;
    endDate: Date;
    duration: number;
    timeAllocation: number;
  }> {
    const sortedMilestones = [...milestones].sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    const distribution = [];
    let previousDate = new Date(project.startDate);

    for (const milestone of sortedMilestones) {
      const milestoneDate = new Date(milestone.dueDate);
      const duration = this.calculateProjectDuration(previousDate, milestoneDate);

      distribution.push({
        milestone,
        startDate: new Date(previousDate),
        endDate: new Date(milestoneDate),
        duration,
        timeAllocation: milestone.timeAllocation
      });

      previousDate = milestoneDate;
    }

    return distribution;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private static findMilestoneConflicts(milestones: Milestone[]): Array<{ date: Date; milestones: Milestone[] }> {
    const dateMap = new Map<string, Milestone[]>();
    
    milestones.forEach(milestone => {
      const dateKey = milestone.dueDate.toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(milestone);
    });

    const conflicts = [];
    for (const [dateKey, milestonesOnDate] of dateMap.entries()) {
      if (milestonesOnDate.length > 1) {
        conflicts.push({
          date: new Date(dateKey),
          milestones: milestonesOnDate
        });
      }
    }

    return conflicts;
  }

  private static validateMilestoneSpacing(milestones: Milestone[]): string[] {
    const issues: string[] = [];
    const sortedMilestones = [...milestones].sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    for (let i = 1; i < sortedMilestones.length; i++) {
      const prevDate = new Date(sortedMilestones[i - 1].dueDate);
      const currDate = new Date(sortedMilestones[i].dueDate);
      const daysDiff = (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000);

      if (daysDiff < 1) {
        issues.push(`Milestones "${sortedMilestones[i-1].name}" and "${sortedMilestones[i].name}" are too close together`);
      }
    }

    return issues;
  }

  private static suggestAlternativeMilestoneDate(
    requestedDate: Date,
    project: Project,
    existingMilestones: Milestone[]
  ): Date {
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    
    // Try dates around the requested date
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const laterDate = new Date(requestedDate);
      laterDate.setDate(laterDate.getDate() + dayOffset);
      
      if (laterDate <= projectEnd && !this.hasDateConflict(laterDate, existingMilestones)) {
        return laterDate;
      }

      const earlierDate = new Date(requestedDate);
      earlierDate.setDate(earlierDate.getDate() - dayOffset);
      
      if (earlierDate >= projectStart && !this.hasDateConflict(earlierDate, existingMilestones)) {
        return earlierDate;
      }
    }

    // Fallback: return requested date
    return requestedDate;
  }

  private static hasDateConflict(date: Date, milestones: Milestone[]): boolean {
    return milestones.some(m => {
      const existingDate = new Date(m.dueDate);
      return Math.abs(existingDate.getTime() - date.getTime()) < (24 * 60 * 60 * 1000);
    });
  }
}

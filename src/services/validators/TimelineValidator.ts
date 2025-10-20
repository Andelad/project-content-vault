/**
 * Timeline Validator
 * 
 * Provides comprehensive validation for timeline operations following
 * standardized validation patterns. Coordinates cross-entity validation
 * and ensures timeline consistency across projects, milestones, and events.
 * 
 * @module TimelineValidator
 */

import type { 
  Project,
  Milestone,
  CalendarEvent, 
  WorkHour, 
  Settings 
} from '@/types/core';

import { 
  calculateDurationHours,
  calculateDurationDays 
} from '../calculations/general/dateCalculations';

// =====================================================================================
// VALIDATION INTERFACES
// =====================================================================================

export interface TimelineValidationContext {
  projects: Project[];
  milestones: Milestone[];
  events: CalendarEvent[];
  workHours: WorkHour[];
  settings: Settings;
}

export interface DetailedTimelineValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  context: {
    timelineAnalysis?: {
      totalProjectDuration: number;
      overlappingProjects: number;
      milestonesOutOfBounds: number;
    };
    capacityAnalysis?: {
      totalPlannedHours: number;
      averageWeeklyCapacity: number;
      overallocatedPeriods: Array<{
        start: Date;
        end: Date;
        plannedHours: number;
        availableHours: number;
      }>;
    };
    consistencyAnalysis?: {
      projectMilestoneGaps: number;
      eventWorkHourMismatches: number;
      schedulingConflicts: number;
    };
  };
}

export interface TimelineProjectValidationRequest {
  project: Project;
  milestones: Milestone[];
  events?: CalendarEvent[];
}

export interface TimelineRangeValidationRequest {
  startDate: Date;
  endDate: Date;
  includeProjects?: boolean;
  includeMilestones?: boolean;
  includeEvents?: boolean;
  includeWorkHours?: boolean;
}

// =====================================================================================
// TIMELINE VALIDATOR
// =====================================================================================

/**
 * Timeline Validator
 * 
 * Provides comprehensive validation by coordinating timeline consistency
 * across all entities and time-related business rules.
 */
export class TimelineValidator {

  /**
   * Validate overall timeline consistency across all entities
   */
  static validateTimelineConsistency(
    context: TimelineValidationContext
  ): DetailedTimelineValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 1. Project timeline validation
    const projectIssues = this.validateProjectTimelines(context.projects, context.milestones);
    errors.push(...projectIssues.errors);
    warnings.push(...projectIssues.warnings);

    // 2. Milestone consistency validation
    const milestoneIssues = this.validateMilestoneConsistency(context.projects, context.milestones);
    errors.push(...milestoneIssues.errors);
    warnings.push(...milestoneIssues.warnings);

    // 3. Event-work hour consistency
    const eventWorkHourIssues = this.validateEventWorkHourConsistency(context.events, context.workHours);
    warnings.push(...eventWorkHourIssues.warnings);

    // 4. Capacity analysis
    const capacityIssues = this.validateTimelineCapacity(context);
    warnings.push(...capacityIssues.warnings);
    suggestions.push(...capacityIssues.suggestions);

    // 5. Cross-entity timeline gaps
    const gapIssues = this.validateTimelineGaps(context);
    warnings.push(...gapIssues.warnings);
    suggestions.push(...gapIssues.suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        timelineAnalysis: {
          totalProjectDuration: this.calculateTotalProjectDuration(context.projects),
          overlappingProjects: this.countOverlappingProjects(context.projects),
          milestonesOutOfBounds: this.countMilestonesOutOfBounds(context.projects, context.milestones)
        },
        capacityAnalysis: this.analyzeTimelineCapacity(context),
        consistencyAnalysis: {
          projectMilestoneGaps: this.countProjectMilestoneGaps(context.projects, context.milestones),
          eventWorkHourMismatches: this.countEventWorkHourMismatches(context.events, context.workHours),
          schedulingConflicts: this.countSchedulingConflicts(context)
        }
      }
    };
  }

  /**
   * Validate a specific project's timeline including its milestones
   */
  static validateProjectTimeline(
    request: TimelineProjectValidationRequest,
    context: TimelineValidationContext
  ): DetailedTimelineValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const { project, milestones, events = [] } = request;

    // 1. Basic project timeline validation
    if (new Date(project.startDate) >= new Date(project.endDate)) {
      errors.push(`Project "${project.name}" start date must be before end date`);
    }

    // 2. Milestone validation within project timeline
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);

    milestones.forEach(milestone => {
      const milestoneDate = new Date(milestone.dueDate);
      if (milestoneDate < projectStart || milestoneDate > projectEnd) {
        errors.push(`Milestone "${milestone.name}" due date is outside project timeline`);
      }
    });

    // 3. Milestone ordering validation
    const sortedMilestones = [...milestones].sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    for (let i = 0; i < sortedMilestones.length - 1; i++) {
      const current = sortedMilestones[i];
      const next = sortedMilestones[i + 1];
      const daysBetween = calculateDurationDays(new Date(current.dueDate), new Date(next.dueDate));
      
      if (daysBetween < 1) {
        warnings.push(`Milestones "${current.name}" and "${next.name}" are scheduled on consecutive days`);
        suggestions.push('Consider allowing more time between milestones');
      }
    }

    // 4. Project duration analysis
    const projectDurationDays = calculateDurationDays(projectStart, projectEnd);
    const totalMilestoneHours = milestones.reduce((total, milestone) => 
      total + (milestone.timeAllocation || 0), 0);

    if (totalMilestoneHours > project.estimatedHours) {
      errors.push(`Total milestone time allocation (${totalMilestoneHours}h) exceeds project estimate (${project.estimatedHours}h)`);
    }

    if (projectDurationDays < 1) {
      warnings.push(`Very short project duration (${projectDurationDays} days)`);
      suggestions.push('Consider if project timeline is realistic');
    }

    if (projectDurationDays > 365) {
      warnings.push(`Very long project duration (${projectDurationDays} days)`);
      suggestions.push('Consider breaking into smaller sub-projects or phases');
    }

    // 5. Event alignment with project timeline
    events.forEach(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      if (eventStart < projectStart || eventEnd > projectEnd) {
        warnings.push(`Event "${event.title}" extends beyond project timeline`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        timelineAnalysis: {
          totalProjectDuration: projectDurationDays,
          overlappingProjects: 0,
          milestonesOutOfBounds: milestones.filter(m => {
            const date = new Date(m.dueDate);
            return date < projectStart || date > projectEnd;
          }).length
        }
      }
    };
  }

  /**
   * Validate a specific time range for scheduling conflicts
   */
  static validateTimelineRange(
    request: TimelineRangeValidationRequest,
    context: TimelineValidationContext
  ): DetailedTimelineValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const { startDate, endDate } = request;

    if (startDate >= endDate) {
      errors.push('Timeline range start date must be before end date');
      return { isValid: false, errors, warnings, suggestions, context: {} };
    }

    // Filter entities to the specified range
    const filteredContext = this.filterContextToRange(context, startDate, endDate);

    // 1. Project overlap analysis
    if (request.includeProjects !== false) {
      const overlaps = this.findProjectOverlapsInRange(filteredContext.projects, startDate, endDate);
      if (overlaps.length > 0) {
        warnings.push(`${overlaps.length} project overlaps detected in the specified range`);
        suggestions.push('Review project schedules to minimize resource conflicts');
      }
    }

    // 2. Work hour capacity analysis
    if (request.includeWorkHours !== false) {
      const totalWorkHours = filteredContext.workHours.reduce((total, wh) => 
        total + calculateDurationHours(wh.startTime, wh.endTime), 0);
      
      const rangeDays = calculateDurationDays(startDate, endDate);
      const avgHoursPerDay = totalWorkHours / rangeDays;

      if (avgHoursPerDay > 10) {
        warnings.push(`High work intensity: ${avgHoursPerDay.toFixed(1)} hours/day average`);
        suggestions.push('Consider redistributing work load for better sustainability');
      }
    }

    // 3. Event scheduling analysis
    if (request.includeEvents !== false) {
      const eventConflicts = this.findEventConflictsInRange(filteredContext.events, startDate, endDate);
      if (eventConflicts.length > 0) {
        warnings.push(`${eventConflicts.length} event scheduling conflicts detected`);
        suggestions.push('Resolve event time conflicts to prevent confusion');
      }
    }

    // 4. Milestone clustering analysis
    if (request.includeMilestones !== false) {
      const clusteredMilestones = this.findClusteredMilestones(filteredContext.milestones, 7); // Within 7 days
      if (clusteredMilestones.length > 0) {
        warnings.push(`${clusteredMilestones.length} milestone clusters detected (multiple milestones within 7 days)`);
        suggestions.push('Consider spacing out milestones for better pacing');
      }
    }

    const rangeDays = calculateDurationDays(startDate, endDate);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        timelineAnalysis: {
          totalProjectDuration: rangeDays,
          overlappingProjects: request.includeProjects !== false ? this.countOverlappingProjects(filteredContext.projects) : 0,
          milestonesOutOfBounds: 0
        }
      }
    };
  }

  // =====================================================================================
  // PRIVATE HELPER METHODS
  // =====================================================================================

  private static validateProjectTimelines(projects: Project[], milestones: Milestone[]): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    projects.forEach(project => {
      if (new Date(project.startDate) >= new Date(project.endDate)) {
        errors.push(`Project "${project.name}" has invalid timeline (start >= end)`);
      }

      const projectMilestones = milestones.filter(m => m.projectId === project.id);
      const outOfBoundsMilestones = projectMilestones.filter(m => {
        const date = new Date(m.dueDate);
        return date < new Date(project.startDate) || date > new Date(project.endDate);
      });

      if (outOfBoundsMilestones.length > 0) {
        warnings.push(`Project "${project.name}" has ${outOfBoundsMilestones.length} milestone(s) outside timeline`);
      }
    });

    return { errors, warnings };
  }

  private static validateMilestoneConsistency(projects: Project[], milestones: Milestone[]): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    milestones.forEach(milestone => {
      const project = projects.find(p => p.id === milestone.projectId);
      if (!project) {
        errors.push(`Milestone "${milestone.name}" references non-existent project`);
      }
    });

    return { errors, warnings };
  }

  private static validateEventWorkHourConsistency(events: CalendarEvent[], workHours: WorkHour[]): { warnings: string[] } {
    const warnings: string[] = [];

    // Find tracked events without corresponding work hours
    const trackedEvents = events.filter(e => e.type === 'tracked' && e.completed);
    trackedEvents.forEach(event => {
      const correspondingWorkHours = workHours.filter(wh => 
        Math.abs(wh.startTime.getTime() - event.startTime.getTime()) < 300000 // Within 5 minutes
      );

      if (correspondingWorkHours.length === 0) {
        warnings.push(`Tracked event "${event.title}" has no corresponding work hour entry`);
      }
    });

    return { warnings };
  }

  private static validateTimelineCapacity(context: TimelineValidationContext): { warnings: string[]; suggestions: string[] } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const totalProjectHours = context.projects.reduce((total, p) => total + p.estimatedHours, 0);
    const totalWorkHours = context.workHours.reduce((total, wh) => 
      total + calculateDurationHours(wh.startTime, wh.endTime), 0);

    if (totalProjectHours > totalWorkHours * 1.2) {
      warnings.push('Planned project work significantly exceeds scheduled work hours');
      suggestions.push('Consider adding more work hours or reducing project scope');
    }

    return { warnings, suggestions };
  }

  private static validateTimelineGaps(context: TimelineValidationContext): { warnings: string[]; suggestions: string[] } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Look for large gaps between projects
    const sortedProjects = [...context.projects].sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    for (let i = 0; i < sortedProjects.length - 1; i++) {
      const current = sortedProjects[i];
      const next = sortedProjects[i + 1];
      const gap = calculateDurationDays(new Date(current.endDate), new Date(next.startDate));

      if (gap > 30) {
        warnings.push(`Large gap (${gap} days) between projects "${current.name}" and "${next.name}"`);
        suggestions.push('Consider if this gap is intentional or if projects could be rescheduled');
      }
    }

    return { warnings, suggestions };
  }

  // Helper calculation methods
  private static calculateTotalProjectDuration(projects: Project[]): number {
    return projects.reduce((total, project) => 
      total + calculateDurationDays(new Date(project.startDate), new Date(project.endDate)), 0);
  }

  private static countOverlappingProjects(projects: Project[]): number {
    let count = 0;
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const p1 = projects[i];
        const p2 = projects[j];
        if (new Date(p1.startDate) < new Date(p2.endDate) && 
            new Date(p1.endDate) > new Date(p2.startDate)) {
          count++;
        }
      }
    }
    return count;
  }

  private static countMilestonesOutOfBounds(projects: Project[], milestones: Milestone[]): number {
    let count = 0;
    projects.forEach(project => {
      const projectMilestones = milestones.filter(m => m.projectId === project.id);
      projectMilestones.forEach(milestone => {
        const date = new Date(milestone.dueDate);
        if (date < new Date(project.startDate) || date > new Date(project.endDate)) {
          count++;
        }
      });
    });
    return count;
  }

  private static analyzeTimelineCapacity(context: TimelineValidationContext) {
    const totalPlannedHours = context.projects.reduce((total, p) => total + p.estimatedHours, 0);
    const totalWorkHours = context.workHours.reduce((total, wh) => 
      total + calculateDurationHours(wh.startTime, wh.endTime), 0);

    return {
      totalPlannedHours,
      averageWeeklyCapacity: totalWorkHours / 52, // Rough weekly average
      overallocatedPeriods: [] // TODO: Implement detailed period analysis
    };
  }

  private static countProjectMilestoneGaps(projects: Project[], milestones: Milestone[]): number {
    return projects.filter(project => {
      const projectMilestones = milestones.filter(m => m.projectId === project.id);
      return projectMilestones.length === 0;
    }).length;
  }

  private static countEventWorkHourMismatches(events: CalendarEvent[], workHours: WorkHour[]): number {
    return events.filter(event => {
      if (event.type !== 'tracked' || !event.completed) return false;
      const matchingWorkHours = workHours.filter(wh => 
        Math.abs(wh.startTime.getTime() - event.startTime.getTime()) < 300000
      );
      return matchingWorkHours.length === 0;
    }).length;
  }

  private static countSchedulingConflicts(context: TimelineValidationContext): number {
    let conflicts = 0;
    
    // Count overlapping events
    const events = context.events;
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const e1 = events[i];
        const e2 = events[j];
        if (new Date(e1.startTime) < new Date(e2.endTime) && 
            new Date(e1.endTime) > new Date(e2.startTime)) {
          conflicts++;
        }
      }
    }

    return conflicts;
  }

  private static filterContextToRange(
    context: TimelineValidationContext, 
    startDate: Date, 
    endDate: Date
  ): TimelineValidationContext {
    return {
      projects: context.projects.filter(p => 
        new Date(p.startDate) <= endDate && new Date(p.endDate) >= startDate
      ),
      milestones: context.milestones.filter(m => {
        const date = new Date(m.dueDate);
        return date >= startDate && date <= endDate;
      }),
      events: context.events.filter(e => 
        new Date(e.startTime) <= endDate && new Date(e.endTime) >= startDate
      ),
      workHours: context.workHours.filter(wh => 
        wh.startTime <= endDate && wh.endTime >= startDate
      ),
      settings: context.settings
    };
  }

  private static findProjectOverlapsInRange(projects: Project[], startDate: Date, endDate: Date): Array<{project1: Project, project2: Project}> {
    const overlaps: Array<{project1: Project, project2: Project}> = [];
    
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const p1 = projects[i];
        const p2 = projects[j];
        if (new Date(p1.startDate) < new Date(p2.endDate) && 
            new Date(p1.endDate) > new Date(p2.startDate)) {
          overlaps.push({project1: p1, project2: p2});
        }
      }
    }
    
    return overlaps;
  }

  private static findEventConflictsInRange(events: CalendarEvent[], startDate: Date, endDate: Date): CalendarEvent[] {
    const conflicts: CalendarEvent[] = [];
    
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const e1 = events[i];
        const e2 = events[j];
        if (new Date(e1.startTime) < new Date(e2.endTime) && 
            new Date(e1.endTime) > new Date(e2.startTime)) {
          if (!conflicts.includes(e1)) conflicts.push(e1);
          if (!conflicts.includes(e2)) conflicts.push(e2);
        }
      }
    }
    
    return conflicts;
  }

  private static findClusteredMilestones(milestones: Milestone[], maxDaysApart: number): Milestone[] {
    const clustered: Milestone[] = [];
    const sortedMilestones = [...milestones].sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    for (let i = 0; i < sortedMilestones.length - 1; i++) {
      const current = sortedMilestones[i];
      const next = sortedMilestones[i + 1];
      const daysBetween = calculateDurationDays(new Date(current.dueDate), new Date(next.dueDate));
      
      if (daysBetween <= maxDaysApart) {
        if (!clustered.includes(current)) clustered.push(current);
        if (!clustered.includes(next)) clustered.push(next);
      }
    }

    return clustered;
  }
}

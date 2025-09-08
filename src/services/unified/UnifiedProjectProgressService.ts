/**
 * Project Progress Service
 * 
 * Handles all project progress calculations, milestone analysis, and timeline progression.
 * Extracted from legacy progress services for better organization.
 * 
 * Architecture: Domain -> Calculations -> Orchestrators -> Validators -> Repository
 */

import { Project, CalendarEvent, Holiday, Settings } from '@/types/core';
import {
  ProjectEvent,
  Milestone,
  DataPoint,
  ComprehensiveProjectTimeMetrics,
  calculateProjectDuration,
  getProjectEvents,
  calculateEventDurationHours,
  buildPlannedTimeMap,
  getPlannedTimeUpToDate,
  getCompletedTimeUpToDate,
  getRelevantMilestones,
  calculateProgressPercentage,
  calculateProjectTimeMetrics
} from '../calculations/projectProgressCalculations';

// =====================================================================================
// TYPES & INTERFACES
// =====================================================================================

export interface ProgressCalculationOptions {
  includeIntermediatePoints?: boolean;
  interpolationSteps?: number;
}

export interface ProjectStatus {
  status: 'not-started' | 'in-progress' | 'completed' | 'overdue';
  health: 'on-track' | 'at-risk' | 'behind';
  progressPercentage: number;
  daysRemaining: number;
  estimatedCompletion: Date;
}

// =====================================================================================
// PROJECT PROGRESS ANALYSIS
// =====================================================================================

/**
 * Calculate estimated progress for a specific date using milestone interpolation
 */
export function getEstimatedProgressForDate(
  targetDate: Date,
  project: Project,
  milestones: Milestone[]
): number {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const relevantMilestones = getRelevantMilestones(milestones, project);
  
  if (relevantMilestones.length === 0) {
    // No milestones, use linear interpolation
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const targetDays = Math.ceil((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (totalDays === 0) return 0;
    const progressRatio = Math.min(1, Math.max(0, targetDays / totalDays));
    return project.estimatedHours * progressRatio;
  }
  
  // Find the milestone segment this date falls into
  let prevDate = startDate;
  let prevHours = 0;
  
  for (const milestone of relevantMilestones) {
    const milestoneDate = new Date(milestone.dueDate);
    
    if (targetDate <= milestoneDate) {
      // Target date is within this segment, interpolate
      const segmentDays = Math.ceil((milestoneDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      const targetDays = Math.ceil((targetDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (segmentDays === 0) return prevHours + milestone.timeAllocation;
      
      const progressRatio = targetDays / segmentDays;
      return prevHours + (milestone.timeAllocation * progressRatio);
    }
    
    // Move to next segment
    prevDate = milestoneDate;
    prevHours += milestone.timeAllocation;
  }
  
  // Target date is after all milestones, interpolate to end date
  const segmentDays = Math.ceil((endDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
  const targetDays = Math.ceil((targetDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (segmentDays === 0) return project.estimatedHours;
  
  const remainingHours = project.estimatedHours - prevHours;
  const progressRatio = Math.min(1, targetDays / segmentDays);
  return prevHours + (remainingHours * progressRatio);
}

/**
 * Calculate progress data points for the entire project timeline
 */
export function calculateProjectProgressData(
  project: Project,
  events: ProjectEvent[],
  milestones: Milestone[] = [],
  options: ProgressCalculationOptions = {}
): DataPoint[] {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const totalDays = calculateProjectDuration(project);
  
  if (totalDays <= 0) return [];
  
  const projectEvents = getProjectEvents(events, project.id);
  const relevantMilestones = getRelevantMilestones(milestones, project);
  const plannedTimeMap = buildPlannedTimeMap(projectEvents);
  const data: DataPoint[] = [];
  
  // Add starting point
  const completedTimeAtStart = getCompletedTimeUpToDate(startDate, projectEvents);
  
  data.push({
    date: new Date(startDate),
    estimatedProgress: 0,
    completedTime: completedTimeAtStart,
    plannedTime: getPlannedTimeUpToDate(startDate, plannedTimeMap)
  });
  
  if (relevantMilestones.length > 0) {
    // Add milestone points
    let cumulativeEstimatedHours = 0;
    
    relevantMilestones.forEach((milestone) => {
      const milestoneDate = new Date(milestone.dueDate);
      cumulativeEstimatedHours += milestone.timeAllocation;
      
      const completedTimeAtMilestone = getCompletedTimeUpToDate(milestoneDate, projectEvents);
      
      data.push({
        date: new Date(milestoneDate),
        estimatedProgress: cumulativeEstimatedHours,
        completedTime: completedTimeAtMilestone,
        plannedTime: getPlannedTimeUpToDate(milestoneDate, plannedTimeMap)
      });
    });
  }
  
  // Add end point
  const completedTimeAtEnd = getCompletedTimeUpToDate(endDate, projectEvents);
  
  data.push({
    date: new Date(endDate),
    estimatedProgress: project.estimatedHours,
    completedTime: completedTimeAtEnd,
    plannedTime: getPlannedTimeUpToDate(endDate, plannedTimeMap)
  });
  
  return data;
}

/**
 * Check if project is on track based on current date and progress
 */
export function isProjectOnTrack(
  project: Project,
  events: ProjectEvent[],
  milestones: Milestone[] = [],
  currentDate: Date = new Date()
): boolean {
  const expectedProgress = getEstimatedProgressForDate(currentDate, project, milestones);
  const actualProgress = getCompletedTimeUpToDate(currentDate, getProjectEvents(events, project.id));
  
  // Consider on track if within 10% of expected progress
  const tolerance = expectedProgress * 0.1;
  return actualProgress >= (expectedProgress - tolerance);
}

/**
 * Calculate comprehensive project status
 */
export function calculateProjectStatus(project: Project): ProjectStatus {
  const now = new Date();
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  
  // Determine project status
  let status: ProjectStatus['status'];
  if (now < startDate) {
    status = 'not-started';
  } else if (now > endDate) {
    status = 'overdue';
  } else {
    // Check if completed
    // This would need actual completion data - simplified for now
    status = 'in-progress';
  }
  
  // Calculate days remaining
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Calculate progress percentage (simplified - would need actual events)
  const totalDays = calculateProjectDuration(project);
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const progressPercentage = totalDays > 0 ? Math.min(100, (elapsedDays / totalDays) * 100) : 0;
  
  // Determine health based on progress vs time elapsed
  let health: ProjectStatus['health'];
  if (progressPercentage >= 90) {
    health = 'on-track';
  } else if (progressPercentage >= 70) {
    health = 'at-risk';
  } else {
    health = 'behind';
  }
  
  return {
    status,
    health,
    progressPercentage,
    daysRemaining,
    estimatedCompletion: endDate
  };
}

/**
 * Format project date range for display
 */
export function formatProjectDateRange(project: Project): string {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  
  const formatOptions: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  };
  
  const start = startDate.toLocaleDateString('en-US', formatOptions);
  const end = endDate.toLocaleDateString('en-US', formatOptions);
  
  return `${start} - ${end}`;
}

// =====================================================================================
// PROGRESS ANALYSIS FUNCTIONS
// =====================================================================================

/**
 * Analyze project progress with detailed metrics
 */
export function analyzeProjectProgress(
  project: Project,
  events: CalendarEvent[],
  milestones: Milestone[],
  holidays: Holiday[],
  settings: Settings
): {
  timeMetrics: ComprehensiveProjectTimeMetrics;
  progressData: DataPoint[];
  status: ProjectStatus;
  isOnTrack: boolean;
  milestoneProgress: Array<{
    milestone: Milestone;
    isCompleted: boolean;
    daysUntilDue: number;
    progressToward: number;
  }>;
} {
  // Convert CalendarEvent[] to ProjectEvent[] for progress calculations
  const projectEvents: ProjectEvent[] = events
    .filter(event => event.projectId === project.id)
    .map(event => ({
      id: event.id,
      projectId: event.projectId,
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime || event.startTime),
      completed: event.completed || false
    }));

  const timeMetrics = calculateProjectTimeMetrics(project, events, holidays, settings);
  const progressData = calculateProjectProgressData(project, projectEvents, milestones);
  const status = calculateProjectStatus(project);
  const isOnTrack = isProjectOnTrack(project, projectEvents, milestones);

  // Analyze milestone progress
  const relevantMilestones = getRelevantMilestones(milestones, project);
  const today = new Date();
  
  const milestoneProgress = relevantMilestones.map(milestone => {
    const dueDate = new Date(milestone.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const expectedProgress = getEstimatedProgressForDate(today, project, milestones);
    const actualProgress = getCompletedTimeUpToDate(today, projectEvents);
    
    return {
      milestone,
      isCompleted: milestone.completed || false,
      daysUntilDue,
      progressToward: milestone.timeAllocation > 0 ? (actualProgress / milestone.timeAllocation) * 100 : 0
    };
  });

  return {
    timeMetrics,
    progressData,
    status,
    isOnTrack,
    milestoneProgress
  };
}

// =====================================================================================
// EXPORTS (for backward compatibility)
// =====================================================================================

// Re-export key calculation functions for convenience
export {
  calculateProjectDuration,
  getProjectEvents,
  calculateEventDurationHours,
  buildPlannedTimeMap,
  getPlannedTimeUpToDate,
  getCompletedTimeUpToDate,
  calculateProgressPercentage,
  getRelevantMilestones,
  calculateProjectTimeMetrics
} from '../legacy/projects/projectProgressService';

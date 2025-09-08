/**
 * Project Progress Calculations
 * 
 * Extracted from projectProgressService.ts - handles project progress calculation logic
 * Part of unified calculations layer for consistent project progress tracking
 */

import type { Milestone as CoreMilestone } from '@/types/core';

export interface ProjectEvent {
  id: string;
  projectId: string;
  startTime: Date;
  endTime: Date;
  completed: boolean;
}

export interface Milestone {
  id: string;
  projectId: string;
  dueDate: string | Date;
  timeAllocation: number;
  completed?: boolean;
}

export interface ProgressProject {
  id: string;
  startDate: string | Date;
  endDate: string | Date;
  estimatedHours: number;
}

export interface DataPoint {
  date: Date;
  estimatedProgress: number;
  completedTime: number;
  plannedTime: number;
}

export interface ProgressCalculationOptions {
  includeIntermediatePoints?: boolean;
  interpolationSteps?: number;
}

export interface ComprehensiveProjectTimeMetrics {
  totalEstimatedHours: number;
  totalCompletedHours: number;
  totalPlannedHours: number;
  progressPercentage: number;
  remainingHours: number;
  daysRemaining: number;
  averageHoursPerDay: number;
  isOnTrack: boolean;
  efficiency: number;
  milestoneProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
  // Legacy compatibility properties
  plannedTime?: number;
  completedTime?: number;
  totalBudgetedTime?: number;
  workDaysLeft?: number;
  totalWorkDays?: number;
  originalDailyEstimateFormatted?: string;
}

/**
 * Calculate total project duration in days
 */
export function calculateProjectDuration(project: ProgressProject): number {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get project events filtered by project ID (alias for filterProjectEvents)
 */
export function getProjectEvents(events: ProjectEvent[], projectId: string): ProjectEvent[] {
  return filterProjectEvents(events, projectId);
}

/**
 * Calculate event duration in hours
 */
export function calculateEventDurationHours(event: ProjectEvent): number {
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
}

/**
 * Get completed time up to date - supports both legacy and new patterns
 */
export function getCompletedTimeUpToDate(
  firstArg: Date | ProjectEvent[],
  secondArg: Map<string, number> | string,
  thirdArg?: Date
): number {
  // New pattern: getCompletedTimeUpToDate(upToDate: Date, plannedTimeMap: Map<string, number>)
  if (firstArg instanceof Date && secondArg instanceof Map) {
    let completedTime = 0;
    const dateStr = firstArg.toISOString().split('T')[0];
    
    for (const [date, time] of secondArg.entries()) {
      if (date <= dateStr) {
        completedTime += time;
      }
    }
    
    return completedTime;
  }
  
  // Legacy pattern: getCompletedTimeUpToDate(events: ProjectEvent[], projectId: string, upToDate: Date)
  if (Array.isArray(firstArg) && typeof secondArg === 'string' && thirdArg instanceof Date) {
    return calculateCompletedTimeUpToDate(firstArg, secondArg, thirdArg);
  }
  
  return 0;
}

/**
 * Calculate completed time from events up to a specific date (internal function)
 */
function calculateCompletedTimeUpToDate(
  events: ProjectEvent[],
  projectId: string,
  upToDate: Date
): number {
  const projectEvents = filterProjectEvents(events, projectId).filter(event => 
    event.completed && new Date(event.endTime) <= upToDate
  );
  
  return projectEvents.reduce((total, event) => {
    const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
    return total + duration;
  }, 0);
}

/**
 * Calculate planned time from events up to a specific date - supports both patterns
 */
export function getPlannedTimeUpToDate(
  firstArg: ProjectEvent[] | Date,
  secondArg: string | Map<string, number>,
  thirdArg?: Date
): number {
  // New pattern: getPlannedTimeUpToDate(upToDate: Date, plannedTimeMap: Map<string, number>)
  if (firstArg instanceof Date && secondArg instanceof Map) {
    let plannedTime = 0;
    const dateStr = firstArg.toISOString().split('T')[0];
    
    for (const [date, time] of secondArg.entries()) {
      if (date <= dateStr) {
        plannedTime += time;
      }
    }
    
    return plannedTime;
  }
  
  // Legacy pattern: getPlannedTimeUpToDate(events: ProjectEvent[], projectId: string, upToDate: Date) 
  if (Array.isArray(firstArg) && typeof secondArg === 'string' && thirdArg instanceof Date) {
    const projectEvents = filterProjectEvents(firstArg, secondArg).filter(event => 
      new Date(event.endTime) <= thirdArg
    );
    
    return projectEvents.reduce((total, event) => {
      const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
      return total + duration;
    }, 0);
  }
  
  return 0;
}

/**
 * Get relevant milestones for a project
 */
export function getRelevantMilestones(
  milestones: Milestone[], 
  projectId: string, 
  startDate?: Date, 
  endDate?: Date
): Milestone[] {
  let filtered = milestones.filter(m => m.projectId === projectId);
  
  if (startDate) {
    filtered = filtered.filter(m => new Date(m.dueDate) >= startDate);
  }
  
  if (endDate) {
    filtered = filtered.filter(m => new Date(m.dueDate) <= endDate);
  }
  
  return filtered;
}

/**
 * Calculate progress percentage
 */
export function calculateProgressPercentage(
  completedTime: number,
  totalPlannedTime: number
): number {
  if (totalPlannedTime === 0) return 0;
  return Math.min(100, (completedTime / totalPlannedTime) * 100);
}

/**
 * Filter project events filtered by project ID
 */
export function filterProjectEvents(events: ProjectEvent[], projectId: string): ProjectEvent[] {
  return events.filter(event => event.projectId === projectId);
}

/**
 * Build a map of planned time by date
 */
export function buildPlannedTimeMap(
  events: ProjectEvent[],
  projectId: string,
  startDate: Date,
  endDate: Date
): Map<string, number> {
  const plannedTimeMap = new Map<string, number>();
  const projectEvents = filterProjectEvents(events, projectId);
  
  // Initialize all dates with 0
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0];
    plannedTimeMap.set(dateKey, 0);
    current.setDate(current.getDate() + 1);
  }
  
  // Add planned time for each event
  projectEvents.forEach(event => {
    const eventDate = new Date(event.startTime);
    const dateKey = eventDate.toISOString().split('T')[0];
    
    if (plannedTimeMap.has(dateKey)) {
      const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
      const currentTime = plannedTimeMap.get(dateKey) || 0;
      plannedTimeMap.set(dateKey, currentTime + duration);
    }
  });
  
  return plannedTimeMap;
}

/**
 * Calculate comprehensive project time metrics
 * Supports both new (3 args) and legacy (4 args) signatures
 */
export function calculateProjectTimeMetrics(
  project: ProgressProject,
  events: ProjectEvent[],
  milestonesOrHolidays?: Milestone[] | any[], // Accept milestones or holidays for backward compatibility
  settings?: any // Legacy settings parameter
): ComprehensiveProjectTimeMetrics {
  const milestones = Array.isArray(milestonesOrHolidays) && milestonesOrHolidays.length > 0 && 'id' in milestonesOrHolidays[0] ? milestonesOrHolidays as Milestone[] : [];
  
  const projectEvents = filterProjectEvents(events, project.id);
  const currentDate = new Date();
  
  // Calculate totals
  const totalEstimatedHours = project.estimatedHours;
  const totalCompletedHours = calculateCompletedTimeUpToDate(events, project.id, currentDate);
  const totalPlannedHours = getPlannedTimeUpToDate(events, project.id, new Date(project.endDate));
  
  // Calculate progress metrics
  const progressPercentage = totalEstimatedHours > 0 ? (totalCompletedHours / totalEstimatedHours) * 100 : 0;
  const remainingHours = Math.max(0, totalEstimatedHours - totalCompletedHours);
  
  // Calculate time remaining
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
  const totalWorkDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const averageHoursPerDay = daysRemaining > 0 ? remainingHours / daysRemaining : 0;
  
  // Determine if project is on track (simplified calculation)
  const expectedProgressAtCurrentDate = totalEstimatedHours * 
    (1 - (endDate.getTime() - currentDate.getTime()) / (endDate.getTime() - startDate.getTime()));
  const isOnTrack = totalCompletedHours >= expectedProgressAtCurrentDate * 0.9; // 90% tolerance
  
  // Calculate efficiency
  const efficiency = totalPlannedHours > 0 ? (totalCompletedHours / totalPlannedHours) * 100 : 0;
  
  // Calculate milestone progress
  const completedMilestones = milestones.filter(m => m.completed).length;
  const milestoneProgress = {
    completed: completedMilestones,
    total: milestones.length,
    percentage: milestones.length > 0 ? (completedMilestones / milestones.length) * 100 : 0
  };
  
  return {
    totalEstimatedHours,
    totalCompletedHours,
    totalPlannedHours,
    progressPercentage,
    remainingHours,
    daysRemaining,
    averageHoursPerDay,
    isOnTrack,
    efficiency,
    milestoneProgress,
    // Legacy compatibility properties
    plannedTime: totalPlannedHours,
    completedTime: totalCompletedHours,
    totalBudgetedTime: totalEstimatedHours,
    workDaysLeft: daysRemaining,
    totalWorkDays: totalWorkDays,
    originalDailyEstimateFormatted: `${averageHoursPerDay.toFixed(1)}h/day`
  };
}

/**
 * Generate progress data points for visualization
 */
export function generateProgressDataPoints(
  project: ProgressProject,
  events: ProjectEvent[],
  options: ProgressCalculationOptions = {}
): DataPoint[] {
  const { includeIntermediatePoints = true, interpolationSteps = 5 } = options;
  const dataPoints: DataPoint[] = [];
  
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const totalDays = calculateProjectDuration(project);
  
  // Create data points
  const stepSize = includeIntermediatePoints ? Math.ceil(totalDays / interpolationSteps) : totalDays;
  
  for (let day = 0; day <= totalDays; day += stepSize) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + day);
    
    // Ensure we don't go beyond end date
    if (currentDate > endDate) {
      currentDate.setTime(endDate.getTime());
    }
    
    const estimatedProgress = (day / totalDays) * project.estimatedHours;
    const completedTime = calculateCompletedTimeUpToDate(events, project.id, currentDate);
    const plannedTime = getPlannedTimeUpToDate(events, project.id, currentDate);
    
    dataPoints.push({
      date: new Date(currentDate),
      estimatedProgress,
      completedTime,
      plannedTime
    });
    
    // Break if we've reached the end date
    if (currentDate.getTime() === endDate.getTime()) {
      break;
    }
  }
  
  return dataPoints;
}

/**
 * Calculate project velocity (hours completed per day)
 */
export function calculateProjectVelocity(
  project: ProgressProject,
  events: ProjectEvent[],
  periodDays: number = 7
): number {
  const currentDate = new Date();
  const periodStart = new Date(currentDate);
  periodStart.setDate(periodStart.getDate() - periodDays);
  
  const projectEvents = filterProjectEvents(events, project.id).filter(event => 
    event.completed && 
    new Date(event.endTime) >= periodStart && 
    new Date(event.endTime) <= currentDate
  );
  
  const totalHoursCompleted = projectEvents.reduce((total, event) => {
    const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
    return total + duration;
  }, 0);
  
  return totalHoursCompleted / periodDays;
}

/**
 * Estimate project completion date based on current velocity
 */
export function estimateProjectCompletionDate(
  project: ProgressProject,
  events: ProjectEvent[]
): Date {
  const velocity = calculateProjectVelocity(project, events, 14); // Use 14-day velocity
  const metrics = calculateProjectTimeMetrics(project, events);
  
  if (velocity <= 0) {
    return new Date(project.endDate); // Return original end date if no velocity
  }
  
  const daysToCompletion = metrics.remainingHours / velocity;
  const estimatedCompletionDate = new Date();
  estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + Math.ceil(daysToCompletion));
  
  return estimatedCompletionDate;
}

// ============================================================================
// MIGRATED FROM TimelineBusinessLogicService (Legacy Compatibility Functions)
// ============================================================================

/**
 * Calculate project metrics including working days and height
 * Migrated from TimelineBusinessLogicService.ProjectMetricsCalculationService
 */
export function calculateProjectMetrics(
  projectStartDate: Date,
  projectEndDate: Date,
  estimatedHours: number,
  isWorkingDay: (date: Date) => boolean,
  autoEstimateDays?: any,
  settings?: any,
  holidays?: any[]
): {
  exactDailyHours: number;
  dailyHours: number;
  dailyMinutes: number;
  heightInPixels: number;
  workingDaysCount: number;
} {
  const projectStart = new Date(projectStartDate);
  const projectEnd = new Date(projectEndDate);

  let workingDays: Date[];
  
  // Use auto-estimate working days if available, otherwise fall back to basic working day calculation
  if (autoEstimateDays && settings && holidays) {
    // Inline the auto-estimate working days calculation logic (copied from other services)
    workingDays = [];
    
    for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      
      // Check if it's a basic working day first
      if (!isWorkingDay(currentDate)) {
        continue;
      }
      
      // Check if this day type is excluded in autoEstimateDays
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[currentDate.getDay()];
      
      if (autoEstimateDays && autoEstimateDays[dayName] === false) {
        continue; // Skip this day type
      }
      
      workingDays.push(currentDate);
    }
  } else {
    // Fallback to basic working day calculation
    workingDays = [];
    for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
      if (isWorkingDay(new Date(d))) {
        workingDays.push(new Date(d));
      }
    }
  }

  const totalWorkingDays = workingDays.length;

  // If no working days, don't divide by zero
  if (totalWorkingDays === 0) {
    return {
      exactDailyHours: 0,
      dailyHours: 0,
      dailyMinutes: 0,
      heightInPixels: 0,
      workingDaysCount: 0
    };
  }

  const exactHoursPerDay = estimatedHours / totalWorkingDays;
  const dailyHours = Math.floor(exactHoursPerDay);
  const dailyMinutes = Math.round((exactHoursPerDay - dailyHours) * 60);

  // Calculate precise height in pixels (minimum 3px only if estimated hours > 0)
  // Note: calculateProjectHeight needs to be imported from ui/TimelinePositioning
  // For now, we'll use a simple calculation
  const heightInPixels = estimatedHours > 0
    ? Math.max(3, Math.min(exactHoursPerDay * 5, 40)) // Simple height calculation
    : 0;

  return {
    exactDailyHours: exactHoursPerDay,
    dailyHours,
    dailyMinutes,
    heightInPixels,
    workingDaysCount: totalWorkingDays
  };
}

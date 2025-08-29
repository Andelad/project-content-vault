/**
 * Project progress calculation service
 * Extracted from ProjectProgressGraph component
 */

export interface ProjectEvent {
  id: string;
  projectId: string;
  startTime: Date;
  endTime: Date;
  completed: boolean;
}

export interface Milestone {
  id: string;
  dueDate: string | Date;
  timeAllocation: number;
  completed?: boolean;
}

export interface Project {
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

/**
 * Calculate total project duration in days
 */
export function calculateProjectDuration(project: Project): number {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Filter events for a specific project
 */
export function getProjectEvents(events: ProjectEvent[], projectId: string): ProjectEvent[] {
  return events.filter(event => event.projectId === projectId);
}

/**
 * Calculate event duration in hours
 */
export function calculateEventDurationHours(event: ProjectEvent): number {
  return (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60);
}

/**
 * Build planned time map by date
 */
export function buildPlannedTimeMap(events: ProjectEvent[]): Map<string, number> {
  const plannedTimeByDate = new Map<string, number>();
  
  events.forEach(event => {
    const eventDate = new Date(event.startTime);
    eventDate.setHours(0, 0, 0, 0);
    const dateString = eventDate.toISOString().split('T')[0];
    
    if (!plannedTimeByDate.has(dateString)) {
      plannedTimeByDate.set(dateString, 0);
    }
    
    const durationHours = calculateEventDurationHours(event);
    plannedTimeByDate.set(dateString, plannedTimeByDate.get(dateString)! + durationHours);
  });
  
  return plannedTimeByDate;
}

/**
 * Get planned time up to a specific date
 */
export function getPlannedTimeUpToDate(targetDate: Date, plannedTimeMap: Map<string, number>): number {
  let plannedTime = 0;
  const targetDateString = targetDate.toISOString().split('T')[0];
  
  for (const [dateString, hours] of plannedTimeMap.entries()) {
    if (dateString <= targetDateString) {
      plannedTime += hours;
    }
  }
  
  return plannedTime;
}

/**
 * Calculate completed time up to a specific date
 */
export function getCompletedTimeUpToDate(targetDate: Date, events: ProjectEvent[]): number {
  return events
    .filter(event => {
      const eventDate = new Date(event.startTime);
      eventDate.setHours(0, 0, 0, 0);
      const normalizedTargetDate = new Date(targetDate);
      normalizedTargetDate.setHours(0, 0, 0, 0);
      return event.completed && eventDate <= normalizedTargetDate;
    })
    .reduce((total, event) => {
      return total + calculateEventDurationHours(event);
    }, 0);
}

/**
 * Get relevant milestones within project timeframe
 */
export function getRelevantMilestones(milestones: Milestone[], project: Project): Milestone[] {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  
  return milestones
    .filter(m => {
      const milestoneDate = new Date(m.dueDate);
      return milestoneDate >= startDate && milestoneDate <= endDate;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

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
 * Calculate project progress percentage
 */
export function calculateProgressPercentage(project: Project, events: ProjectEvent[]): number {
  const projectEvents = getProjectEvents(events, project.id);
  const completedHours = projectEvents
    .filter(event => event.completed)
    .reduce((total, event) => total + calculateEventDurationHours(event), 0);
  
  if (project.estimatedHours === 0) return 0;
  return Math.min(100, (completedHours / project.estimatedHours) * 100);
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

// =====================================================================================
// COMPREHENSIVE PROJECT TIME METRICS
// =====================================================================================

import { CalendarEvent, Holiday, Settings } from '@/types/core';

export interface ComprehensiveProjectTimeMetrics {
  totalBudgetedTime: number; // hours
  plannedTime: number; // hours from calendar events
  completedTime: number; // hours from completed events
  autoEstimatedTime: number; // remaining hours to be allocated
  autoEstimatedDailyTime: string; // formatted as "3h 30m per day"
  workDaysLeft: number; // working days between now and project end
  totalWorkDays: number; // total working days in project timeframe
  // Add fields to match timeline bar calculations
  originalDailyEstimate: number; // total hours divided by total work days (like timeline)
  originalDailyEstimateFormatted: string; // formatted original daily estimate
}

/**
 * Calculates all project time metrics in one place to ensure consistency
 * Extracted from lib/projectCalculations.ts
 */
export function calculateProjectTimeMetrics(
  project: Project,
  events: CalendarEvent[],
  holidays: Holiday[],
  settings: Settings
): ComprehensiveProjectTimeMetrics {
  // Defensive defaults for safety during early renders or partial context
  const safeHolidays: Holiday[] = Array.isArray(holidays) ? holidays : [];
  const safeEvents: CalendarEvent[] = Array.isArray(events) ? events : [];
  const safeSettings: Settings = (settings as any) || ({ weeklyWorkHours: {} } as Settings);
  const projectStart = new Date(project.startDate);
  projectStart.setHours(0, 0, 0, 0);
  
  // For continuous projects, use a reasonable calculation end date (1 year from start or today, whichever is later)
  let projectEnd: Date;
  if ((project as any).continuous) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearFromStart = new Date(projectStart);
    oneYearFromStart.setFullYear(oneYearFromStart.getFullYear() + 1);
    const oneYearFromToday = new Date(today);
    oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + 1);
    
    // Use the later of one year from start or one year from today
    projectEnd = oneYearFromStart > oneYearFromToday ? oneYearFromStart : oneYearFromToday;
  } else {
    projectEnd = new Date(project.endDate);
    projectEnd.setHours(0, 0, 0, 0);
  }
  
  // Calculate total working days in project timeframe
  const allWorkDays = getWorkingDaysInRange(projectStart, projectEnd, safeHolidays, safeSettings);
  const totalWorkDays = allWorkDays.length;
  
  // Calculate total budgeted time (estimated hours)
  const totalBudgetedTime = project.estimatedHours || 0;
  
  // Calculate original daily estimate
  const originalDailyEstimate = totalWorkDays > 0 ? totalBudgetedTime / totalWorkDays : 0;
  const originalDailyEstimateFormatted = formatDailyTime(originalDailyEstimate);
  
  // Filter events for this project
  const projectEvents = safeEvents.filter(event => event.projectId === project.id);
  
  // Calculate planned time from events
  const plannedTime = projectEvents.reduce((total, event) => {
    if (event.endTime) {
      const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
      return total + duration;
    }
    return total;
  }, 0);
  
  // Calculate completed time from completed events
  const completedTime = projectEvents
    .filter(event => event.completed)
    .reduce((total, event) => {
      if (event.endTime) {
        const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
        return total + duration;
      }
      return total;
    }, 0);
  
  // Calculate work days left
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remainingWorkDays = allWorkDays.filter(day => day >= today);
  const workDaysLeft = remainingWorkDays.length;
  
  // Calculate auto-estimated time (remaining budgeted time to be allocated)
  const autoEstimatedTime = Math.max(0, totalBudgetedTime - plannedTime);
  const autoEstimatedDailyTime = workDaysLeft > 0 ? formatDailyTime(autoEstimatedTime / workDaysLeft) : '0h 0m';
  
  return {
    totalBudgetedTime,
    plannedTime,
    completedTime,
    autoEstimatedTime,
    autoEstimatedDailyTime,
    workDaysLeft,
    totalWorkDays,
    originalDailyEstimate,
    originalDailyEstimateFormatted
  };
}

/**
 * Get working days in a date range, excluding weekends and holidays
 */
function getWorkingDaysInRange(startDate: Date, endDate: Date, holidays: Holiday[], settings: Settings): Date[] {
  const workingDays: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
    const isHoliday = holidays.some(holiday => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      return currentDate >= holidayStart && currentDate <= holidayEnd;
    });
    
    if (!isWeekend && !isHoliday) {
      workingDays.push(new Date(currentDate));
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Format daily time as "Xh Ym"
 */
function formatDailyTime(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (wholeHours === 0 && minutes === 0) {
    return '0h 0m';
  }
  
  return `${wholeHours}h ${minutes}m`;
}

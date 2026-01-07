/**
 * Analytics Calculations
 * 
 * Consolidated calculations for:
 * - Business intelligence and reporting
 * - Completion tracking and statistics
 * - Work utilization analytics
 * 
 * Consolidated from:
 * - insightCalculations.ts
 * - completionCalculations.ts
 * 
 * Date: September 10, 2025
 */

import { calculateEventDurationOnDate } from '../events/EventCalculations';
import type { Project, CalendarEvent } from '@/types';

// =====================================================================================
// INTERFACES
// =====================================================================================

export interface WorkSlot {
  duration: number;
  startTime?: string;
  endTime?: string;
}

export interface WeeklyWorkHours {
  [dayName: string]: WorkSlot[] | number;
}

export interface ReportEvent {
  startTime: string | Date;
  endTime: string | Date;
  completed?: boolean;
  type?: string;
  duration?: number;
  projectId?: string;
}

export interface PlannedTimeCompletionStats {
  totalHours: number;
  completedHours: number;
  isFullyCompleted: boolean;
  completionPercentage: number;
  totalEvents: number;
  completedEvents: number;
}

export interface ProjectCompletionSummary {
  projectId: string;
  date: Date;
  stats: PlannedTimeCompletionStats;
  events: CalendarEvent[];
}

// =====================================================================================
// WORK CAPACITY & UTILIZATION
// =====================================================================================

/**
 * Calculate total weekly work capacity from settings
 */
export function calculateWeeklyCapacity(weeklyWorkHours: WeeklyWorkHours): number {
  let totalCapacity = 0;

  Object.entries(weeklyWorkHours).forEach(([dayName, workDay]) => {
    if (typeof workDay === 'number') {
      totalCapacity += workDay;
    } else if (Array.isArray(workDay)) {
      const dayCapacity = workDay.reduce((sum, slot) => sum + slot.duration, 0);
      totalCapacity += dayCapacity;
    }
  });

  return totalCapacity;
}

/**
 * Calculate daily work capacity for a specific date
 */
export function calculateDailyCapacity(date: Date, weeklyWorkHours: WeeklyWorkHours): number {
  if (!weeklyWorkHours) return 0;

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof weeklyWorkHours;
  const dayData = weeklyWorkHours[dayName];

  if (Array.isArray(dayData)) {
    // Use the same logic as calculateWeeklyCapacity for consistency
    return dayData.reduce((sum, slot) => sum + (slot.duration || 0), 0);
  }
  return dayData || 0;
}

/**
 * Calculate work utilization for a specific date range
 */
export function calculateWorkUtilization(
  trackedHours: number,
  weeklyCapacity: number
): {
  utilizationPercentage: number;
  isOverUtilized: boolean;
  remainingCapacity: number;
} {
  const utilizationPercentage = weeklyCapacity > 0 ? (trackedHours / weeklyCapacity) * 100 : 0;
  const isOverUtilized = utilizationPercentage > 100;
  const remainingCapacity = Math.max(0, weeklyCapacity - trackedHours);

  return {
    utilizationPercentage,
    isOverUtilized,
    remainingCapacity
  };
}

/**
 * Get current active projects
 */
export function getCurrentProjects(projects: Project[], referenceDate: Date = new Date()): Project[] {
  return projects.filter(project => {
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    return start <= referenceDate && end >= referenceDate;
  });
}

/**
 * Calculate future committed hours from projects starting after reference date
 */
export function calculateFutureCommitments(projects: Project[], referenceDate: Date = new Date()): number {
  return projects
    .filter(project => new Date(project.startDate) > referenceDate)
    .reduce((sum, project) => sum + project.estimatedHours, 0);
}

/**
 * Filter events within date range that are completed or tracked
 */
export function getRelevantEventsForPeriod(
  events: ReportEvent[],
  startDate: Date,
  endDate: Date
): ReportEvent[] {
  return events.filter(event => {
    try {
      const eventDate = new Date(event.startTime);
      const isInRange = eventDate >= startDate && eventDate <= endDate;
      const isCompleted = event.completed || event.type === 'tracked';
      return isInRange && isCompleted;
    } catch (error) {
      console.warn('Invalid event date:', event.startTime);
      return false;
    }
  });
}

/**
 * Filter events within date range that are completed or tracked
 */
export function filterCompletedEventsInRange(
  events: ReportEvent[],
  startDate: Date,
  endDate: Date
): ReportEvent[] {
  return events.filter(event => {
    const eventStartDate = new Date(event.startTime);
    
    if (eventStartDate >= startDate && eventStartDate <= endDate) {
      const isCompleted = event.completed || event.type === 'tracked';
      return isCompleted;
    }
    
    return false;
  });
}

/**
 * Calculate total tracked hours from events
 */
export function calculateTotalTrackedHours(events: ReportEvent[]): number {
  return events.reduce((total, event) => {
    if (event.duration) {
      return total + event.duration;
    }
    
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    
    return total + durationHours;
  }, 0);
}

/**
 * Generate weekly utilization report
 */
export function generateWeeklyUtilizationReport(
  projects: Project[],
  events: ReportEvent[],
  weeklyCapacity: number,
  startDate: Date,
  endDate: Date
) {
  const relevantEvents = getRelevantEventsForPeriod(events, startDate, endDate);
  const trackedHours = calculateTotalTrackedHours(relevantEvents);
  const currentProjects = getCurrentProjects(projects, startDate);
  const futureCommitments = calculateFutureCommitments(projects, endDate);
  
  const utilizationPercentage = weeklyCapacity > 0 ? (trackedHours / weeklyCapacity) * 100 : 0;
  
  return {
    period: {
      start: startDate,
      end: endDate
    },
    capacity: {
      total: weeklyCapacity,
      used: trackedHours,
      available: Math.max(0, weeklyCapacity - trackedHours),
      utilizationPercentage
    },
    projects: {
      active: currentProjects.length,
      futureCommitments
    },
    events: {
      total: relevantEvents.length,
      trackedHours
    }
  };
}

/**
 * Calculate comprehensive utilization report
 */
export function calculateUtilizationReport(
  events: ReportEvent[],
  weeklyWorkHours: WeeklyWorkHours,
  startDate: Date,
  endDate: Date
) {
  const completedEvents = filterCompletedEventsInRange(events, startDate, endDate);
  const trackedHours = calculateTotalTrackedHours(completedEvents);
  const weeklyCapacity = calculateWeeklyCapacity(weeklyWorkHours);
  const utilization = calculateWorkUtilization(trackedHours, weeklyCapacity);

  return {
    period: { startDate, endDate },
    trackedHours,
    weeklyCapacity,
    completedEvents: completedEvents.length,
    totalEvents: events.length,
    ...utilization
  };
}

// =====================================================================================
// COMPLETION TRACKING
// =====================================================================================

/**
 * Check if all planned time for a project on a specific date is completed
 */
export function isProjectFullyCompletedOnDate(
  projectId: string,
  events: CalendarEvent[],
  targetDate: Date
): boolean {
  const projectEvents = events.filter(event => 
    event.projectId === projectId &&
    new Date(event.startTime).toDateString() === targetDate.toDateString()
  );

  if (projectEvents.length === 0) {
    return false; // No events planned, so not "completed"
  }

  return projectEvents.every(event => event.completed);
}

/**
 * Calculate planned time completion statistics for a project on a specific date
 */
export function calculatePlannedTimeCompletionStats(
  projectId: string,
  events: CalendarEvent[],
  targetDate: Date
): PlannedTimeCompletionStats {
  const projectEvents = events.filter(event => 
    event.projectId === projectId &&
    new Date(event.startTime).toDateString() === targetDate.toDateString()
  );

  if (projectEvents.length === 0) {
    return {
      totalHours: 0,
      completedHours: 0,
      isFullyCompleted: false,
      completionPercentage: 0,
      totalEvents: 0,
      completedEvents: 0
    };
  }

  let totalHours = 0;
  let completedHours = 0;
  let completedEvents = 0;

  projectEvents.forEach(event => {
    const duration = calculateEventDurationOnDate({ event, targetDate });
    totalHours += duration;
    
    if (event.completed) {
      completedHours += duration;
      completedEvents++;
    }
  });

  const completionPercentage = totalHours > 0 ? (completedHours / totalHours) * 100 : 0;
  const isFullyCompleted = completedEvents === projectEvents.length;

  return {
    totalHours,
    completedHours,
    isFullyCompleted,
    completionPercentage,
    totalEvents: projectEvents.length,
    completedEvents
  };
}

/**
 * Get completion summary for a project on a specific date
 */
export function getProjectCompletionSummary(
  projectId: string,
  events: CalendarEvent[],
  targetDate: Date
): ProjectCompletionSummary {
  const projectEvents = events.filter(event => 
    event.projectId === projectId &&
    new Date(event.startTime).toDateString() === targetDate.toDateString()
  );

  const stats = calculatePlannedTimeCompletionStats(projectId, events, targetDate);

  return {
    projectId,
    date: targetDate,
    stats,
    events: projectEvents
  };
}

/**
 * Calculate completion rate for multiple projects across a date range
 */
export function calculateProjectCompletionRates(
  projectIds: string[],
  events: CalendarEvent[],
  startDate: Date,
  endDate: Date
): Map<string, { completedDays: number; totalDays: number; completionRate: number }> {
  const results = new Map();
  
  projectIds.forEach(projectId => {
    let completedDays = 0;
    let totalDays = 0;
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const stats = calculatePlannedTimeCompletionStats(projectId, events, currentDate);
      
      if (stats.totalEvents > 0) {
        totalDays++;
        if (stats.isFullyCompleted) {
          completedDays++;
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const completionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;
    
    results.set(projectId, {
      completedDays,
      totalDays,
      completionRate
    });
  });
  
  return results;
}

/**
 * Aggregate completion statistics across multiple dates
 * Useful for weekly/monthly completion reporting.
 */
export function aggregateCompletionStats(
  projectId: string,
  events: CalendarEvent[],
  dates: Date[]
): PlannedTimeCompletionStats {
  let totalHours = 0;
  let completedHours = 0;
  let totalEvents = 0;
  let completedEvents = 0;

  dates.forEach(date => {
    const stats = calculatePlannedTimeCompletionStats(projectId, events, date);
    totalHours += stats.totalHours;
    completedHours += stats.completedHours;
    totalEvents += stats.totalEvents;
    completedEvents += stats.completedEvents;
  });

  const completionPercentage = totalHours > 0 ? (completedHours / totalHours) * 100 : 0;
  const isFullyCompleted = completedEvents === totalEvents;

  return {
    totalHours,
    completedHours,
    isFullyCompleted,
    completionPercentage,
    totalEvents,
    completedEvents
  };
}

// =====================================================================================
// CROSS-CUTTING ANALYTICS
// =====================================================================================

/**
 * Calculate comprehensive project analytics
 */
export function calculateProjectAnalytics(
  projectId: string,
  events: CalendarEvent[],
  weeklyWorkHours: WeeklyWorkHours,
  startDate: Date,
  endDate: Date
) {
  const projectEvents = events.filter(event => event.projectId === projectId);
  const reportEvents: ReportEvent[] = projectEvents.map(event => ({
    startTime: event.startTime,
    endTime: event.endTime,
    completed: event.completed,
    type: event.type,
    duration: event.duration,
    projectId: event.projectId
  }));

  const utilizationReport = calculateUtilizationReport(reportEvents, weeklyWorkHours, startDate, endDate);
  const completionStats = aggregateCompletionStats(projectId, events, 
    getDatesInRange(startDate, endDate));

  return {
    projectId,
    period: { startDate, endDate },
    utilization: utilizationReport,
    completion: completionStats,
    totalEvents: projectEvents.length
  };
}

/**
 * Helper function to get all dates in a range
 */
function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

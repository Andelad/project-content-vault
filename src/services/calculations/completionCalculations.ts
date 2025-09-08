/**
 * Planned Time Completion Calculations
 * Pure business logic for tracking completion status of planned work
 * 
 * Migrated from legacy/events/plannedTimeCompletionService
 * Enhanced with better type safety and comprehensive completion tracking
 */

import { calculateEventDurationOnDate } from './eventCalculations';
import type { CalendarEvent } from '@/types/core';

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

/**
 * Check if all planned time for a project on a specific date is completed
 * 
 * This function properly handles events that cross midnight by only considering
 * the portion of the event that occurs on the specified date.
 * 
 * @param projectId - Project identifier
 * @param date - Date to check completion for
 * @param events - Array of calendar events
 * @returns true if all planned time is completed, false otherwise
 */
export function isPlannedTimeCompleted(
  projectId: string,
  date: Date,
  events: CalendarEvent[]
): boolean {
  if (!projectId || !date || !events.length) {
    return false;
  }

  // Get all events for this project that have duration on this date
  // This properly handles midnight-crossing events
  const projectEventsOnDate = events.filter(event => {
    if (event.projectId !== projectId) return false;
    
    // Use the same logic as calculatePlannedTimeForDate to check if event has duration on this date
    const durationOnDate = calculateEventDurationOnDate({ event, targetDate: date });
    return durationOnDate > 0;
  });

  // If there are no events for this project on this date, it's not planned time
  if (projectEventsOnDate.length === 0) {
    return false;
  }

  // Check if all events are completed
  return projectEventsOnDate.every(event => event.completed === true);
}

/**
 * Get detailed completion statistics for planned time on a specific date
 * 
 * Provides comprehensive metrics about completion status including hours and event counts.
 * 
 * @param projectId - Project identifier
 * @param date - Date to check completion for
 * @param events - Array of calendar events
 * @returns Detailed completion statistics
 */
export function getPlannedTimeCompletionStats(
  projectId: string,
  date: Date,
  events: CalendarEvent[]
): PlannedTimeCompletionStats {
  if (!projectId || !date || !events.length) {
    return {
      totalHours: 0,
      completedHours: 0,
      isFullyCompleted: false,
      completionPercentage: 0,
      totalEvents: 0,
      completedEvents: 0
    };
  }

  // Get all events for this project that have duration on this date
  // This properly handles midnight-crossing events
  const projectEventsOnDate = events.filter(event => {
    if (event.projectId !== projectId) return false;
    
    const durationOnDate = calculateEventDurationOnDate({ event, targetDate: date });
    return durationOnDate > 0;
  });

  let totalHours = 0;
  let completedHours = 0;
  let completedEvents = 0;

  projectEventsOnDate.forEach(event => {
    // Use the actual duration on this specific date (for midnight-crossing events)
    const eventDurationOnDate = calculateEventDurationOnDate({ event, targetDate: date });
    
    totalHours += eventDurationOnDate;
    
    if (event.completed) {
      completedHours += eventDurationOnDate;
      completedEvents++;
    }
  });

  const isFullyCompleted = totalHours > 0 && completedHours === totalHours;
  const completionPercentage = totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;

  return {
    totalHours,
    completedHours,
    isFullyCompleted,
    completionPercentage,
    totalEvents: projectEventsOnDate.length,
    completedEvents
  };
}

/**
 * Get completion status for multiple projects on a specific date
 * 
 * Useful for dashboard views showing overall project completion status.
 * 
 * @param projectIds - Array of project identifiers
 * @param date - Date to check completion for
 * @param events - Array of calendar events
 * @returns Array of completion summaries for each project
 */
export function getMultipleProjectCompletionStats(
  projectIds: string[],
  date: Date,
  events: CalendarEvent[]
): ProjectCompletionSummary[] {
  if (!projectIds.length || !date || !events.length) {
    return [];
  }

  return projectIds.map(projectId => {
    const projectEvents = events.filter(event => event.projectId === projectId);
    const stats = getPlannedTimeCompletionStats(projectId, date, events);
    
    return {
      projectId,
      date: new Date(date),
      stats,
      events: projectEvents.filter(event => {
        const durationOnDate = calculateEventDurationOnDate({ event, targetDate: date });
        return durationOnDate > 0;
      })
    };
  });
}

/**
 * Check if a specific event contributes to planned time on a date
 * 
 * Helper function to determine if an event should be counted in completion calculations.
 * 
 * @param event - Calendar event to check
 * @param date - Date to check against
 * @returns true if the event contributes planned time on the date
 */
export function isEventPlannedTimeOnDate(event: CalendarEvent, date: Date): boolean {
  if (!event || !date) {
    return false;
  }

  const durationOnDate = calculateEventDurationOnDate({ event, targetDate: date });
  return durationOnDate > 0 && !!event.projectId;
}

/**
 * Calculate the completion rate for a date range
 * 
 * Useful for weekly/monthly completion reporting.
 * 
 * @param projectId - Project identifier
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @param events - Array of calendar events
 * @returns Overall completion percentage for the date range
 */
export function getCompletionRateForDateRange(
  projectId: string,
  startDate: Date,
  endDate: Date,
  events: CalendarEvent[]
): {
  totalHours: number;
  completedHours: number;
  completionPercentage: number;
  daysWithWork: number;
  fullyCompletedDays: number;
} {
  if (!projectId || startDate >= endDate || !events.length) {
    return {
      totalHours: 0,
      completedHours: 0,
      completionPercentage: 0,
      daysWithWork: 0,
      fullyCompletedDays: 0
    };
  }

  let totalHours = 0;
  let completedHours = 0;
  let daysWithWork = 0;
  let fullyCompletedDays = 0;

  // Iterate through each day in the date range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayStats = getPlannedTimeCompletionStats(projectId, currentDate, events);
    
    if (dayStats.totalHours > 0) {
      daysWithWork++;
      totalHours += dayStats.totalHours;
      completedHours += dayStats.completedHours;
      
      if (dayStats.isFullyCompleted) {
        fullyCompletedDays++;
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const completionPercentage = totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;

  return {
    totalHours,
    completedHours,
    completionPercentage,
    daysWithWork,
    fullyCompletedDays
  };
}

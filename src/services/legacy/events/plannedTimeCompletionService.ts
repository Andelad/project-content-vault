/**
 * Planned Time Completion Service
 * Determines if planned time for a project on a specific date has been completed
 */

import { CalendarEvent } from '@/types/core';
import { calculateEventDurationOnDate } from '@/services';

/**
 * Check if all planned time for a project on a specific date is completed
 * 
 * @param projectId - Project identifier
 * @param date - Date to check
 * @param events - Array of calendar events
 * @returns true if all planned time is completed, false otherwise
 */
export function isPlannedTimeCompleted(
  projectId: string,
  date: Date,
  events: CalendarEvent[]
): boolean {
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
 * Get completion statistics for planned time on a specific date
 * 
 * @param projectId - Project identifier
 * @param date - Date to check
 * @param events - Array of calendar events
 * @returns Completion statistics
 */
export function getPlannedTimeCompletionStats(
  projectId: string,
  date: Date,
  events: CalendarEvent[]
): {
  totalHours: number;
  completedHours: number;
  isFullyCompleted: boolean;
  completionPercentage: number;
} {
  // Get all events for this project that have duration on this date
  // This properly handles midnight-crossing events
  const projectEventsOnDate = events.filter(event => {
    if (event.projectId !== projectId) return false;
    
    const durationOnDate = calculateEventDurationOnDate({ event, targetDate: date });
    return durationOnDate > 0;
  });

  let totalHours = 0;
  let completedHours = 0;

  projectEventsOnDate.forEach(event => {
    // Use the actual duration on this specific date (for midnight-crossing events)
    const eventDurationOnDate = calculateEventDurationOnDate({ event, targetDate: date });
    
    totalHours += eventDurationOnDate;
    
    if (event.completed) {
      completedHours += eventDurationOnDate;
    }
  });

  const isFullyCompleted = totalHours > 0 && completedHours === totalHours;
  const completionPercentage = totalHours > 0 ? (completedHours / totalHours) * 100 : 0;

  return {
    totalHours,
    completedHours,
    isFullyCompleted,
    completionPercentage
  };
}

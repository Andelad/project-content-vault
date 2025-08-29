/**
 * Planned Time Completion Service
 * Determines if planned time for a project on a specific date has been completed
 */

import { CalendarEvent } from '@/types/core';

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
  // Get all events for this project on this date
  const dateKey = date.toISOString().split('T')[0];
  
  const projectEventsOnDate = events.filter(event => {
    if (event.projectId !== projectId) return false;
    
    const eventDateKey = new Date(event.startTime).toISOString().split('T')[0];
    return eventDateKey === dateKey;
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
  const dateKey = date.toISOString().split('T')[0];
  
  const projectEventsOnDate = events.filter(event => {
    if (event.projectId !== projectId) return false;
    
    const eventDateKey = new Date(event.startTime).toISOString().split('T')[0];
    return eventDateKey === dateKey;
  });

  let totalHours = 0;
  let completedHours = 0;

  projectEventsOnDate.forEach(event => {
    const eventDuration = event.duration || 
      ((event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60));
    
    totalHours += eventDuration;
    
    if (event.completed) {
      completedHours += eventDuration;
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

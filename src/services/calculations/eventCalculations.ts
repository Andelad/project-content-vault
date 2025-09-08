/**
 * Event Duration Calculations
 * Pure business logic for calendar event duration calculations and formatting
 * 
 * Migrated from legacy/events/eventDurationService
 * Enhanced with better type safety and comprehensive documentation
 */

import { formatDuration as coreFormatDuration } from './dateCalculations';
import type { CalendarEvent } from '@/types';

export interface EventDurationParams {
  event: {
    startTime: Date;
    endTime?: Date;
    completed?: boolean;
  };
  targetDate: Date;
  currentTime?: Date;
}

export interface LiveTrackingResult {
  totalMinutes: number;
  dateMinutes: number;
}

/**
 * Calculate event duration on a specific date (handles midnight crossing)
 * This handles events that span multiple days by calculating only the portion
 * that occurs on the target date.
 * 
 * @param params - Event duration calculation parameters
 * @returns Duration in hours for the target date
 */
export function calculateEventDurationOnDate(params: EventDurationParams): number {
  const { event, targetDate, currentTime = new Date() } = params;
  
  if (!event.startTime) {
    return 0;
  }
  
  // If event has no end time and isn't completed, calculate from start to current time
  const eventStart = new Date(event.startTime);
  const eventEnd = event.endTime ? new Date(event.endTime) : currentTime;
  
  // Get the start and end of the target date
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);
  
  // Find the overlap between event duration and the target date
  const overlapStart = new Date(Math.max(eventStart.getTime(), dayStart.getTime()));
  const overlapEnd = new Date(Math.min(eventEnd.getTime(), dayEnd.getTime()));
  
  // If there's no overlap, return 0
  if (overlapStart >= overlapEnd) {
    return 0;
  }
  
  // Calculate duration in hours
  const durationMs = overlapEnd.getTime() - overlapStart.getTime();
  return durationMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Calculate total event duration across multiple dates
 * Useful for getting the total time span of an event across a date range
 * 
 * @param event - Event to calculate duration for
 * @param dates - Array of dates to check
 * @returns Total duration in hours across all dates
 */
export function calculateEventTotalDuration(event: EventDurationParams['event'], dates: Date[]): number {
  if (!dates.length) {
    return 0;
  }
  
  return dates.reduce((total, date) => {
    return total + calculateEventDurationOnDate({ event, targetDate: date });
  }, 0);
}

/**
 * Calculate live tracking duration for an ongoing event
 * Provides both total elapsed time and time specific to the target date
 * 
 * @param params - Live tracking calculation parameters
 * @returns Object with total minutes and date-specific minutes
 */
export function calculateLiveTrackingDuration(params: {
  event: EventDurationParams['event'];
  targetDate: Date;
  currentTime: Date;
}): LiveTrackingResult {
  const { event, targetDate, currentTime } = params;
  
  if (!event.startTime) {
    return { totalMinutes: 0, dateMinutes: 0 };
  }
  
  const trackingStart = new Date(event.startTime);
  const totalElapsedMs = currentTime.getTime() - trackingStart.getTime();
  const totalMinutes = Math.max(0, totalElapsedMs / (1000 * 60));
  
  // Calculate how much of the elapsed time is on the target date
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);
  
  const effectiveStart = new Date(Math.max(trackingStart.getTime(), dayStart.getTime()));
  const effectiveEnd = new Date(Math.min(currentTime.getTime(), dayEnd.getTime()));
  
  const dateMinutes = effectiveStart < effectiveEnd ? 
    (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60) : 0;
  
  return {
    totalMinutes: Math.round(totalMinutes),
    dateMinutes: Math.round(dateMinutes)
  };
}

/**
 * Aggregate event durations by date
 * Creates a summary of total event durations for each date
 * 
 * @param events - Array of events to aggregate
 * @param dates - Array of dates to check
 * @returns Record mapping date strings (YYYY-MM-DD) to total minutes
 */
export function aggregateEventDurationsByDate(
  events: EventDurationParams['event'][],
  dates: Date[]
): Record<string, number> {
  if (!events.length || !dates.length) {
    return {};
  }
  
  const totals: Record<string, number> = {};
  
  dates.forEach(date => {
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    totals[dateKey] = 0;
    
    events.forEach(event => {
      if (event.completed) {
        const durationHours = calculateEventDurationOnDate({ event, targetDate: date });
        if (durationHours > 0) {
          // Convert to minutes and round to avoid decimal minutes
          const durationMinutes = Math.round(durationHours * 60);
          totals[dateKey] += durationMinutes;
        }
      }
    });
  });
  
  return totals;
}

/**
 * Format duration from hours to human-readable string
 * Delegates to the centralized duration formatting function
 * 
 * @param hours - Duration in hours
 * @returns Human-readable duration string
 */
export function formatEventDuration(hours: number): string {
  if (hours < 0) {
    throw new Error('Duration cannot be negative');
  }
  
  return coreFormatDuration(hours);
}

/**
 * Constants for duration calculations
 */
export const EVENT_DURATION_CONSTANTS = {
  MS_PER_MINUTE: 1000 * 60,
  MS_PER_HOUR: 1000 * 60 * 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24
} as const;

/**
 * Check if an event spans multiple days
 * Useful for UI indicators and special handling
 * 
 * @param event - Event to check
 * @returns True if event spans multiple days
 */
export function isMultiDayEvent(event: EventDurationParams['event']): boolean {
  if (!event.startTime || !event.endTime) {
    return false;
  }
  
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  
  // Reset time portions for date comparison
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  return startDate.getTime() !== endDate.getTime();
}

/**
 * Get all dates that an event spans
 * Useful for timeline visualization
 * 
 * @param event - Event to analyze
 * @returns Array of dates the event spans
 */
export function getEventDateSpan(event: EventDurationParams['event']): Date[] {
  if (!event.startTime) {
    return [];
  }
  
  const endTime = event.endTime || new Date();
  const startDate = new Date(event.startTime);
  const endDate = new Date(endTime);
  
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

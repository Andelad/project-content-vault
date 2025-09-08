/**
 * Event Duration Service
 * Handles duration calculations and formatting for calendar events
 * Uses single source of truth for all calculations
 */

import { 
  formatDuration as coreFormatDuration 
} from '@/services/calculations/dateCalculations';

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

/**
 * Calculate event duration on a specific date (handles midnight crossing)
 * This should match the existing calculateEventDurationOnDate function behavior
 */
export function calculateEventDurationOnDate(params: EventDurationParams): number {
  const { event, targetDate, currentTime = new Date() } = params;
  
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
 */
export function calculateEventTotalDuration(event: EventDurationParams['event'], dates: Date[]): number {
  return dates.reduce((total, date) => {
    return total + calculateEventDurationOnDate({ event, targetDate: date });
  }, 0);
}

/**
 * Calculate live tracking duration for an ongoing event
 */
export function calculateLiveTrackingDuration(params: {
  event: EventDurationParams['event'];
  targetDate: Date;
  currentTime: Date;
}): { totalMinutes: number; dateMinutes: number } {
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
 */
export function aggregateEventDurationsByDate(
  events: EventDurationParams['event'][],
  dates: Date[]
): Record<string, number> {
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
 * DELEGATES to single source of truth
 */
export function formatDuration(hours: number): string {
  return coreFormatDuration(hours);
}

/**
 * Constants for duration calculations
 */
export const DURATION_CONSTANTS = {
  MS_PER_MINUTE: 1000 * 60,
  MS_PER_HOUR: 1000 * 60 * 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24
} as const;

/**
 * Legacy wrapper for calculateEventDurationOnDate that matches the old lib function signature
 * @deprecated Use calculateEventDurationOnDate with params object instead
 */
export function calculateEventDurationOnDateLegacy(
  event: CalendarEvent,
  targetDate: Date
): number {
  return calculateEventDurationOnDate({ event, targetDate });
}

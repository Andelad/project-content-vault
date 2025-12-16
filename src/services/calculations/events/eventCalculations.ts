/**
 * Event Duration Calculations
 * Pure business logic for calendar event duration calculations and formatting
 * 
 * Migrated from legacy/events/eventDurationService
 * Enhanced with better type safety and comprehensive documentation
 */

import type { CalendarEvent } from '@/types';
import { normalizeToMidnight, addDaysToDate } from '../../../services/calculations/general/dateCalculations';

import { getDateKey } from '@/utils/dateFormatUtils';

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
  const dayStart = normalizeToMidnight(new Date(targetDate));
  
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
  const dayStart = normalizeToMidnight(new Date(targetDate));
  
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
    const dateKey = getDateKey(date);
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
  
  const startDate = normalizeToMidnight(new Date(event.startTime));
  const endDate = normalizeToMidnight(new Date(event.endTime));
  
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
  let currentDate = normalizeToMidnight(new Date(startDate));
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate = addDaysToDate(currentDate, 1);
  }
  
  return dates;
}

// ===================================
// RECURRING EVENTS CALCULATIONS
// ===================================

/**
 * Generates recurring events based on the provided event data and recurrence configuration
 */
export function generateRecurringEvents(
  eventData: Omit<CalendarEvent, 'id'>, 
  maxOccurrences: number = 100
): { events: Omit<CalendarEvent, 'id'>[]; groupId: string | null } {
  if (!eventData.recurring) {
    return { events: [eventData], groupId: null };
  }

  const events: Omit<CalendarEvent, 'id'>[] = [];
  const { type, interval, endDate, count } = eventData.recurring;
  
  // Generate a unique group ID for this recurring series
  const groupId = crypto.randomUUID();
  
  // Start with the original event (without recurring metadata for individual instances)
  const baseEvent = { ...eventData };
  delete baseEvent.recurring; // Individual recurring instances don't need the recurring metadata
  
  let currentDate = new Date(eventData.startTime);
  let occurrenceCount = 0;
  
  // If no count or endDate is specified, generate a small initial batch for immediate performance
  // The maintenance system will generate more events as needed
  const maxCount = count || (endDate ? maxOccurrences : 4); // Default to 4 occurrences for "never ending" events
  const duration = eventData.endTime.getTime() - eventData.startTime.getTime();

  while (occurrenceCount < maxCount) {
    // Check if we've exceeded the end date
    if (endDate && currentDate > endDate) {
      break;
    }

    // Create event for current occurrence
    const eventStart = new Date(currentDate);
    const eventEnd = new Date(currentDate.getTime() + duration);
    
    events.push({
      ...baseEvent,
      startTime: eventStart,
      endTime: eventEnd,
    });

    occurrenceCount++;

    // Calculate next occurrence date based on recurrence type
    switch (type) {
      case 'daily':
        // Use setDate to preserve local time across DST boundaries
        currentDate = addDaysToDate(new Date(currentDate), interval);
        break;
      case 'weekly':
        {
          // Use setDate to preserve local time across DST boundaries
          const nextWeek = new Date(currentDate);
          nextWeek.setDate(nextWeek.getDate() + (interval * 7));
          currentDate = nextWeek;
        }
        break;
      case 'monthly':
        {
          // Enhanced monthly handling with pattern support
          const nextMonth = new Date(currentDate);
          
          if (eventData.recurring.monthlyPattern === 'date') {
            // Specific date pattern (e.g., 15th of each month)
            const targetDate = eventData.recurring.monthlyDate || currentDate.getDate();
            nextMonth.setMonth(nextMonth.getMonth() + interval);
            
            // Handle months with fewer days (e.g., February 31st -> February 28th)
            const daysInTargetMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
            nextMonth.setDate(Math.min(targetDate, daysInTargetMonth));
          } else {
            // Day of week pattern (e.g., 3rd Tuesday)
            const targetWeekOfMonth = eventData.recurring.monthlyWeekOfMonth || 1;
            const targetDayOfWeek = eventData.recurring.monthlyDayOfWeek || currentDate.getDay();
            
            nextMonth.setMonth(nextMonth.getMonth() + interval);
            
            if (targetWeekOfMonth === 6) {
              // "Last" occurrence - find the last occurrence of the target day in the month
              const lastDayOfMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
              const lastDayWeekday = lastDayOfMonth.getDay();
              const daysToSubtract = (lastDayWeekday - targetDayOfWeek + 7) % 7;
              nextMonth.setDate(lastDayOfMonth.getDate() - daysToSubtract);
            } else if (targetWeekOfMonth === 5) {
              // "2nd last" occurrence - find the second last occurrence of the target day in the month
              const lastDayOfMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
              const lastDayWeekday = lastDayOfMonth.getDay();
              const daysToSubtract = (lastDayWeekday - targetDayOfWeek + 7) % 7;
              const lastOccurrence = lastDayOfMonth.getDate() - daysToSubtract;
              const secondLastOccurrence = lastOccurrence - 7;
              
              // Use second last if it's valid (positive), otherwise use last
              nextMonth.setDate(secondLastOccurrence > 0 ? secondLastOccurrence : lastOccurrence);
            } else {
              // Find the nth occurrence of the target day in the month
              const firstDayOfMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
              const firstDayWeekday = firstDayOfMonth.getDay();
              const daysToAdd = (targetDayOfWeek - firstDayWeekday + 7) % 7;
              const firstOccurrence = 1 + daysToAdd;
              const targetDate = firstOccurrence + ((targetWeekOfMonth - 1) * 7);
              
              // Check if the calculated date exists in the month
              const daysInMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
              if (targetDate <= daysInMonth) {
                nextMonth.setDate(targetDate);
              } else {
                // If the target week doesn't exist, use the last occurrence
                const lastOccurrence = targetDate - 7;
                nextMonth.setDate(lastOccurrence > 0 ? lastOccurrence : firstOccurrence);
              }
            }
          }
          
          currentDate = nextMonth;
        }
        break;
      case 'yearly':
        {
          // Use setFullYear to handle leap years correctly
          const nextYear = new Date(currentDate);
          nextYear.setFullYear(nextYear.getFullYear() + interval);
          currentDate = nextYear;
        }
        break;
    }
  }

  return { events, groupId };
}

/**
 * Validates recurring event configuration
 */
export function validateRecurringConfig(recurring: CalendarEvent['recurring']): string | null {
  if (!recurring) return null;

  if (recurring.interval <= 0) {
    return 'Interval must be greater than 0';
  }

  if (recurring.endDate && recurring.count) {
    return 'Cannot specify both end date and count';
  }

  if (recurring.count && recurring.count <= 0) {
    return 'Count must be greater than 0';
  }

  return null;
}

// =====================================================================================
// EVENT OVERLAP CALCULATIONS
// =====================================================================================

/**
 * Consolidated event overlap calculations from eventOverlapCalculations.ts
 * Added: September 10, 2025
 */

export interface EventOverlapParams {
  events: Array<{
    id: string;
    type: 'planned' | 'tracked' | string;
    startTime: Date;
    endTime: Date;
  }>;
  trackingStart: Date;
  trackingEnd: Date;
  currentEventId?: string;
}

export interface OverlapAction {
  type: 'delete' | 'split' | 'trim_start' | 'trim_end';
  eventId: string;
  originalEvent: {
    id: string;
    startTime: Date;
    endTime: Date;
  };
  newEvent?: {
    startTime: Date;
    endTime: Date;
  };
}

export interface TimeOverlapResult {
  hasOverlap: boolean;
  overlapDuration: number; // in milliseconds
  overlapStart?: Date;
  overlapEnd?: Date;
}

/**
 * Find all events that overlap with a tracking period
 */
export function findOverlappingEvents(params: EventOverlapParams): Array<EventOverlapParams['events'][0]> {
  const { events, trackingStart, trackingEnd, currentEventId } = params;
  
  if (!events.length || trackingStart >= trackingEnd) {
    return [];
  }
  
  return events.filter(event => 
    event.type === 'planned' && 
    event.id !== currentEventId &&
    (
      (event.startTime >= trackingStart && event.startTime < trackingEnd) ||
      (event.endTime > trackingStart && event.endTime <= trackingEnd) ||
      (event.startTime <= trackingStart && event.endTime >= trackingEnd) ||
      (trackingStart <= event.startTime && trackingEnd >= event.endTime)
    )
  );
}

/**
 * Calculate the appropriate action for each overlapping event
 */
export function calculateOverlapActions(params: EventOverlapParams): OverlapAction[] {
  const { trackingStart, trackingEnd } = params;
  
  if (trackingStart >= trackingEnd) {
    return [];
  }
  
  const overlappingEvents = findOverlappingEvents(params);
  
  return overlappingEvents.map(event => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    
    if (trackingStart <= eventStart && trackingEnd >= eventEnd) {
      return {
        type: 'delete',
        eventId: event.id,
        originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd }
      };
    } else if (trackingStart > eventStart && trackingEnd < eventEnd) {
      return {
        type: 'split',
        eventId: event.id,
        originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd },
        newEvent: { startTime: trackingEnd, endTime: eventEnd }
      };
    } else if (trackingStart <= eventStart && trackingEnd > eventStart && trackingEnd < eventEnd) {
      return {
        type: 'trim_start',
        eventId: event.id,
        originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd },
        newEvent: { startTime: trackingEnd, endTime: eventEnd }
      };
    } else if (trackingStart > eventStart && trackingStart < eventEnd && trackingEnd >= eventEnd) {
      return {
        type: 'trim_end',
        eventId: event.id,
        originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd },
        newEvent: { startTime: eventStart, endTime: trackingStart }
      };
    }
    
    return {
      type: 'delete',
      eventId: event.id,
      originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd }
    };
  });
}

/**
 * Check if two time periods overlap
 */
export function isTimeOverlap(
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): boolean {
  if (!start1 || !end1 || !start2 || !end2) {
    return false;
  }
  
  return start1 < end2 && end1 > start2;
}

/**
 * Get the overlap duration between two time periods (in milliseconds)
 */
export function getOverlapDuration(
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): number {
  if (!isTimeOverlap(start1, end1, start2, end2)) {
    return 0;
  }
  
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  
  return Math.max(0, overlapEnd.getTime() - overlapStart.getTime());
}

/**
 * Get detailed overlap information between two time periods
 */
export function getOverlapDetails(
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): TimeOverlapResult {
  if (!isTimeOverlap(start1, end1, start2, end2)) {
    return {
      hasOverlap: false,
      overlapDuration: 0
    };
  }
  
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  const overlapDuration = overlapEnd.getTime() - overlapStart.getTime();
  
  return {
    hasOverlap: true,
    overlapDuration,
    overlapStart,
    overlapEnd
  };
}

/**
 * Check if an event overlaps with multiple other events
 */
export function findMultipleOverlaps(
  targetEvent: { startTime: Date; endTime: Date; id: string },
  otherEvents: Array<{ startTime: Date; endTime: Date; id: string }>
): Array<{ event: typeof otherEvents[0]; overlapDuration: number }> {
  return otherEvents
    .filter(event => event.id !== targetEvent.id)
    .map(event => ({
      event,
      overlapDuration: getOverlapDuration(
        targetEvent.startTime,
        targetEvent.endTime,
        event.startTime,
        event.endTime
      )
    }))
    .filter(result => result.overlapDuration > 0)
    .sort((a, b) => b.overlapDuration - a.overlapDuration);
}

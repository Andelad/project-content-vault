/**
 * Event splitting service for handling split operations during event creation
 * Uses single source of truth for all calculations
 */

import { 
  calculateDurationHours as coreCalculateDurationHours 
} from '@/services/core/calculations/dateCalculations';

import type { CalendarEvent } from '@/types';

export interface Event {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  projectId?: string;
  color?: string;
  description?: string;
  duration?: number;
  type?: 'planned' | 'tracked' | 'completed';
  completed?: boolean;
}

export interface EventSplitResult {
  action: 'delete' | 'split' | 'trim-start' | 'trim-end' | 'no-overlap';
  originalEvent: Event;
  updatedEvent?: Partial<Event>;
  newEvent?: Omit<Event, 'id'>;
  reason: string;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

const MINIMUM_EVENT_DURATION_HOURS = 0.1; // 6 minutes minimum

/**
 * Calculate duration between two dates in hours
 * DELEGATES to single source of truth
 */
export function calculateDurationHours(startTime: Date, endTime: Date): number {
  return coreCalculateDurationHours(startTime, endTime);
}

/**
 * Check if a duration is long enough to keep (> 6 minutes)
 */
export function isViableDuration(durationHours: number): boolean {
  return durationHours > MINIMUM_EVENT_DURATION_HOURS;
}

/**
 * Determine how a tracking period overlaps with a planned event
 */
export function analyzeEventOverlap(
  event: Event,
  trackingRange: TimeRange
): EventSplitResult {
  const { start: trackingStart, end: trackingEnd } = trackingRange;
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  
  // Case 1: Tracking completely overlaps the planned event - delete it
  if (trackingStart <= eventStart && trackingEnd >= eventEnd) {
    return {
      action: 'delete',
      originalEvent: event,
      reason: 'Tracking completely overlaps planned event'
    };
  }
  
  // Case 2: Tracking is in the middle of planned event - split it
  if (trackingStart > eventStart && trackingEnd < eventEnd) {
    const firstPartDuration = calculateDurationHours(eventStart, trackingStart);
    const secondPartDuration = calculateDurationHours(trackingEnd, eventEnd);
    
    const updatedEvent: Partial<Event> = {
      endTime: new Date(trackingStart),
      duration: firstPartDuration
    };
    
    let newEvent: Omit<Event, 'id'> | undefined;
    if (isViableDuration(secondPartDuration)) {
      newEvent = {
        title: event.title,
        startTime: new Date(trackingEnd),
        endTime: new Date(eventEnd),
        projectId: event.projectId,
        color: event.color,
        description: event.description,
        duration: secondPartDuration,
        type: event.type || 'planned'
      };
    }
    
    return {
      action: 'split',
      originalEvent: event,
      updatedEvent,
      newEvent,
      reason: `Split event: first part ${firstPartDuration.toFixed(1)}h, second part ${secondPartDuration.toFixed(1)}h`
    };
  }
  
  // Case 3: Tracking overlaps start of planned event - trim the start
  if (trackingStart <= eventStart && trackingEnd > eventStart) {
    const newDuration = calculateDurationHours(trackingEnd, eventEnd);
    
    if (isViableDuration(newDuration)) {
      return {
        action: 'trim-start',
        originalEvent: event,
        updatedEvent: {
          startTime: new Date(trackingEnd),
          duration: newDuration
        },
        reason: `Trimmed start, remaining duration: ${newDuration.toFixed(1)}h`
      };
    } else {
      return {
        action: 'delete',
        originalEvent: event,
        reason: `Remaining duration too short: ${newDuration.toFixed(1)}h`
      };
    }
  }
  
  // Case 4: Tracking overlaps end of planned event - trim the end
  if (trackingStart < eventEnd && trackingEnd >= eventEnd) {
    const newDuration = calculateDurationHours(eventStart, trackingStart);
    
    if (isViableDuration(newDuration)) {
      return {
        action: 'trim-end',
        originalEvent: event,
        updatedEvent: {
          endTime: new Date(trackingStart),
          duration: newDuration
        },
        reason: `Trimmed end, remaining duration: ${newDuration.toFixed(1)}h`
      };
    } else {
      return {
        action: 'delete',
        originalEvent: event,
        reason: `Remaining duration too short: ${newDuration.toFixed(1)}h`
      };
    }
  }
  
  // Case 5: No overlap
  return {
    action: 'no-overlap',
    originalEvent: event,
    reason: 'No overlap detected'
  };
}

/**
 * Process multiple events for overlap with a tracking period
 */
export function processEventOverlaps(
  events: Event[],
  trackingRange: TimeRange
): EventSplitResult[] {
  return events
    .filter(event => event.type === 'planned' || !event.type) // Handle events without type as planned
    .map(event => analyzeEventOverlap(event, trackingRange))
    .filter(result => result.action !== 'no-overlap');
}

/**
 * Calculate elapsed time since tracking started
 */
export function calculateElapsedTime(startTime: Date, currentTime: Date = new Date()): {
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const totalSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return {
    totalSeconds,
    hours,
    minutes,
    seconds
  };
}

/**
 * Validate that a time range is valid
 */
export function validateTimeRange(range: TimeRange): boolean {
  return range.start < range.end;
}

/**
 * Create a time range from start and end dates
 */
export function createTimeRange(start: Date, end: Date): TimeRange {
  const range = { start: new Date(start), end: new Date(end) };
  
  if (!validateTimeRange(range)) {
    throw new Error('Invalid time range: start must be before end');
  }
  
  return range;
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
  return range1.start < range2.end && range2.start < range1.end;
}

/**
 * Get the intersection of two time ranges
 */
export function getTimeRangeIntersection(range1: TimeRange, range2: TimeRange): TimeRange | null {
  if (!timeRangesOverlap(range1, range2)) {
    return null;
  }
  
  const start = new Date(Math.max(range1.start.getTime(), range2.start.getTime()));
  const end = new Date(Math.min(range1.end.getTime(), range2.end.getTime()));
  
  return { start, end };
}

// =====================================================================================
// MIDNIGHT CROSSING EVENT UTILITIES
// =====================================================================================

/**
 * Split events that cross midnight into separate events for each day
 * This ensures events are properly displayed and calculated across day boundaries
 */
export function splitMidnightCrossingEvents(events: CalendarEvent[]): CalendarEvent[] {
  const splitEvents: CalendarEvent[] = [];

  events.forEach(event => {
    const startDate = new Date(event.startTime);
    const endDate = new Date(event.endTime);
    
    // Check if event crosses midnight (end date is different from start date)
    if (startDate.toDateString() !== endDate.toDateString()) {
      // Split into multiple single-day events
      const currentDate = new Date(startDate);
      let dayCounter = 1;
      
      while (currentDate < endDate) {
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999); // End of current day
        
        // If this is the last segment, use the actual end time
        const segmentEnd = dayEnd > endDate ? endDate : dayEnd;
        
        // Only create segment if it has meaningful duration (> 1 minute)
        const segmentDuration = (segmentEnd.getTime() - dayStart.getTime()) / (1000 * 60);
        if (segmentDuration > 1) {
          splitEvents.push({
            ...event,
            id: `${event.id}-split-${currentDate.toISOString().split('T')[0]}`,
            startTime: currentDate.getTime() === startDate.getTime() ? startDate : 
                       new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0),
            endTime: segmentEnd,
            duration: segmentDuration / 60, // Convert to hours
            title: event.title + (dayCounter > 1 || segmentEnd < endDate ? ` (Day ${dayCounter})` : ''),
            originalEventId: event.id, // Track original event for reference
            isSplitEvent: true
          } as CalendarEvent);
        }
        
        // Move to next day
        dayCounter++;
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      }
    } else {
      // Event doesn't cross midnight, add as-is
      splitEvents.push(event);
    }
  });

  return splitEvents;
}

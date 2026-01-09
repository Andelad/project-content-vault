/**
 * Event Splitting and Overlap Calculations
 * 
 * Pure calculation functions for event splitting, trimming, and overlap detection
 * Used primarily by time tracking to handle planned event overlaps
 */

import { 
  calculateDurationHours 
} from '@/presentation/utils/dateCalculations';
import type { CalendarEvent } from '@/shared/types/core';

// Use core CalendarEvent as the single source of truth
export type Event = CalendarEvent;

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

/**
 * Check if a duration is viable for an event (minimum 15 minutes)
 */
export function isViableDuration(durationHours: number): boolean {
  return durationHours >= 0.25; // 15 minutes minimum
}

/**
 * Process event overlap with tracking time range
 */
export function processEventOverlaps(
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
      reason: 'Tracking splits planned event into two parts'
    };
  }
  
  // Case 3: Tracking overlaps the start of the planned event - trim start
  if (trackingStart <= eventStart && trackingEnd > eventStart && trackingEnd < eventEnd) {
    const remainingDuration = calculateDurationHours(trackingEnd, eventEnd);
    
    if (!isViableDuration(remainingDuration)) {
      return {
        action: 'delete',
        originalEvent: event,
        reason: 'Remaining duration after trim-start is too small'
      };
    }
    
    return {
      action: 'trim-start',
      originalEvent: event,
      updatedEvent: {
        startTime: new Date(trackingEnd),
        duration: remainingDuration
      },
      reason: 'Tracking overlaps start of planned event'
    };
  }
  
  // Case 4: Tracking overlaps the end of the planned event - trim end
  if (trackingStart > eventStart && trackingStart < eventEnd && trackingEnd >= eventEnd) {
    const remainingDuration = calculateDurationHours(eventStart, trackingStart);
    
    if (!isViableDuration(remainingDuration)) {
      return {
        action: 'delete',
        originalEvent: event,
        reason: 'Remaining duration after trim-end is too small'
      };
    }
    
    return {
      action: 'trim-end',
      originalEvent: event,
      updatedEvent: {
        endTime: new Date(trackingStart),
        duration: remainingDuration
      },
      reason: 'Tracking overlaps end of planned event'
    };
  }
  
  // Case 5: No overlap
  return {
    action: 'no-overlap',
    originalEvent: event,
    reason: 'No overlap between tracking and planned event'
  };
}

/**
 * Calculate elapsed time in hours
 */
export function calculateElapsedTime(start: Date, end: Date): number {
  return calculateDurationHours(start, end);
}

/**
 * Create a time range object
 */
export function createTimeRange(start: Date, end: Date): TimeRange {
  return { start, end };
}

/**
 * Validate event overlap scenarios for drag operations
 */
export function validateEventForSplit(event: Event, trackingRange: TimeRange): boolean {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  const { start: trackingStart, end: trackingEnd } = trackingRange;
  
  // Basic validation - events must have valid time ranges
  if (eventStart >= eventEnd || trackingStart >= trackingEnd) {
    return false;
  }
  
  // Check for any overlap
  return trackingStart < eventEnd && trackingEnd > eventStart;
}

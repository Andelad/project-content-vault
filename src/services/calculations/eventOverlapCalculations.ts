/**
 * Event Overlap Calculations
 * Pure business logic for detecting and resolving event overlaps in timeline scheduling
 * 
 * Migrated from legacy/events/eventOverlapService
 * Enhanced with better type safety and comprehensive documentation
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
 * Used to identify which events need to be modified when creating new time entries
 * 
 * @param params - Event overlap detection parameters
 * @returns Array of overlapping events
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
      // Event starts during tracking period
      (event.startTime >= trackingStart && event.startTime < trackingEnd) ||
      // Event ends during tracking period  
      (event.endTime > trackingStart && event.endTime <= trackingEnd) ||
      // Event completely contains tracking period
      (event.startTime <= trackingStart && event.endTime >= trackingEnd) ||
      // Tracking period completely contains event
      (trackingStart <= event.startTime && trackingEnd >= event.endTime)
    )
  );
}

/**
 * Calculate the appropriate action for each overlapping event
 * Determines how to resolve conflicts when creating new time entries
 * 
 * @param params - Event overlap calculation parameters
 * @returns Array of actions to resolve overlaps
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
      // Tracking completely overlaps the planned event - delete it
      return {
        type: 'delete',
        eventId: event.id,
        originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd }
      };
    } else if (trackingStart > eventStart && trackingEnd < eventEnd) {
      // Tracking is in the middle of event - split the event
      return {
        type: 'split',
        eventId: event.id,
        originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd },
        newEvent: { startTime: trackingEnd, endTime: eventEnd }
      };
    } else if (trackingStart <= eventStart && trackingEnd > eventStart && trackingEnd < eventEnd) {
      // Tracking overlaps the start of event - trim event start
      return {
        type: 'trim_start',
        eventId: event.id,
        originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd },
        newEvent: { startTime: trackingEnd, endTime: eventEnd }
      };
    } else if (trackingStart > eventStart && trackingStart < eventEnd && trackingEnd >= eventEnd) {
      // Tracking overlaps the end of event - trim event end
      return {
        type: 'trim_end',
        eventId: event.id,
        originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd },
        newEvent: { startTime: eventStart, endTime: trackingStart }
      };
    }
    
    // Fallback - shouldn't happen with current logic but provides safety
    return {
      type: 'delete',
      eventId: event.id,
      originalEvent: { id: event.id, startTime: eventStart, endTime: eventEnd }
    };
  });
}

/**
 * Check if two time periods overlap
 * Simple boolean check for time range intersection
 * 
 * @param start1 - Start of first time period
 * @param end1 - End of first time period
 * @param start2 - Start of second time period
 * @param end2 - End of second time period
 * @returns True if the periods overlap
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
 * Calculates the exact duration of intersection between two time ranges
 * 
 * @param start1 - Start of first time period
 * @param end1 - End of first time period
 * @param start2 - Start of second time period
 * @param end2 - End of second time period
 * @returns Overlap duration in milliseconds (0 if no overlap)
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
 * Provides comprehensive overlap analysis including exact time ranges
 * 
 * @param start1 - Start of first time period
 * @param end1 - End of first time period
 * @param start2 - Start of second time period
 * @param end2 - End of second time period
 * @returns Detailed overlap result with duration and time ranges
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
 * Useful for complex scheduling scenarios with multiple conflicts
 * 
 * @param targetEvent - Event to check for overlaps
 * @param otherEvents - Array of events to check against
 * @returns Array of overlapping events
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
    .sort((a, b) => b.overlapDuration - a.overlapDuration); // Sort by overlap duration, longest first
}

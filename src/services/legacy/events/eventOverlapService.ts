/**
 * Event overlap detection and resolution service
 * Extracted from TimeTracker for reusability and testing
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

/**
 * Find all events that overlap with a tracking period
 */
export function findOverlappingEvents(params: EventOverlapParams): Array<EventOverlapParams['events'][0]> {
  const { events, trackingStart, trackingEnd, currentEventId } = params;
  
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
 */
export function calculateOverlapActions(params: EventOverlapParams): OverlapAction[] {
  const { trackingStart, trackingEnd } = params;
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
    
    // Fallback - shouldn't happen with current logic
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
  
  return overlapEnd.getTime() - overlapStart.getTime();
}

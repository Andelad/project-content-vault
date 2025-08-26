import { CalendarEvent } from '../types';

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
          });
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

/**
 * Calculate the total duration of an event on a specific date
 * Properly handles events that span across midnight
 */
export function calculateEventDurationOnDate(
  event: CalendarEvent,
  targetDate: Date
): number {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const checkDate = new Date(targetDate);
  
  // Normalize all dates to midnight for comparison
  const normalizedTargetDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
  const normalizedStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const normalizedEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  // Check if the event occurs on the target date
  if (normalizedTargetDate < normalizedStartDate || normalizedTargetDate > normalizedEndDate) {
    return 0; // Event doesn't occur on this date
  }
  
  // Calculate the portion of the event that occurs on the target date
  const dayStart = new Date(normalizedTargetDate);
  const dayEnd = new Date(normalizedTargetDate);
  dayEnd.setHours(23, 59, 59, 999);
  
  // Find the overlap between the event and the target date
  const effectiveStart = startDate > dayStart ? startDate : dayStart;
  const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;
  
  if (effectiveStart >= effectiveEnd) {
    return 0; // No overlap
  }
  
  // Return duration in hours
  return (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
}

/**
 * Check if an event spans across midnight
 */
export function eventSpansMidnight(event: CalendarEvent): boolean {
  return event.startTime.toDateString() !== event.endTime.toDateString();
}

/**
 * Get all dates that an event spans across
 */
export function getEventDates(event: CalendarEvent): Date[] {
  const dates: Date[] = [];
  const currentDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  
  while (currentDate.toDateString() !== endDate.toDateString() || dates.length === 0) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Add the end date if it's different
  if (endDate.toDateString() !== dates[dates.length - 1]?.toDateString()) {
    dates.push(new Date(endDate));
  }
  
  return dates;
}

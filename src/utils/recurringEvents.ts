import { CalendarEvent } from '../types';

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
  
  // If no count or endDate is specified, default to a reasonable limit
  const maxCount = count || (endDate ? maxOccurrences : 52); // Default to 52 occurrences (1 year of weekly events)
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
        currentDate = new Date(currentDate.getTime() + (interval * 24 * 60 * 60 * 1000));
        break;
      case 'weekly':
        currentDate = new Date(currentDate.getTime() + (interval * 7 * 24 * 60 * 60 * 1000));
        break;
      case 'monthly':
        // Use setMonth to handle month boundaries correctly
        const nextMonth = new Date(currentDate);
        nextMonth.setMonth(nextMonth.getMonth() + interval);
        currentDate = nextMonth;
        break;
      case 'yearly':
        // Use setFullYear to handle leap years correctly
        const nextYear = new Date(currentDate);
        nextYear.setFullYear(nextYear.getFullYear() + interval);
        currentDate = nextYear;
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

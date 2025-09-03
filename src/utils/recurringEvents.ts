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
        const nextDay = new Date(currentDate);
        nextDay.setDate(nextDay.getDate() + interval);
        currentDate = nextDay;
        break;
      case 'weekly':
        // Use setDate to preserve local time across DST boundaries
        const nextWeek = new Date(currentDate);
        nextWeek.setDate(nextWeek.getDate() + (interval * 7));
        currentDate = nextWeek;
        break;
      case 'monthly':
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

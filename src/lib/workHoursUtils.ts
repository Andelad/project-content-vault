import { CalendarEvent, WorkHour } from '../types';

export interface WorkHourCapacity {
  totalHours: number;
  allocatedHours: number;
  availableHours: number;
  events: CalendarEvent[];
}

/**
 * Calculate how events reduce available work hours for a given date
 */
export function calculateWorkHourCapacity(
  workHours: WorkHour[], 
  events: CalendarEvent[], 
  date: Date
): WorkHourCapacity {
  // Filter work hours and events for the specific date
  const dateKey = date.toISOString().split('T')[0];
  
  const dayWorkHours = workHours.filter(wh => {
    const whDateKey = wh.startTime.toISOString().split('T')[0];
    return whDateKey === dateKey;
  });
  
  const dayEvents = events.filter(event => {
    const eventDateKey = event.startTime.toISOString().split('T')[0];
    return eventDateKey === dateKey;
  });
  
  // Calculate total work hours for the day
  const totalHours = dayWorkHours.reduce((sum, wh) => sum + wh.duration, 0);
  
  // Calculate overlapping event time with work hours
  let allocatedHours = 0;
  const overlappingEvents: CalendarEvent[] = [];
  
  dayEvents.forEach(event => {
    dayWorkHours.forEach(workHour => {
      const overlap = calculateTimeOverlap(
        event.startTime,
        event.endTime,
        workHour.startTime,
        workHour.endTime
      );
      
      if (overlap > 0) {
        allocatedHours += overlap;
        if (!overlappingEvents.find(e => e.id === event.id)) {
          overlappingEvents.push(event);
        }
      }
    });
  });
  
  return {
    totalHours,
    allocatedHours: Math.min(allocatedHours, totalHours), // Can't allocate more than total
    availableHours: Math.max(totalHours - allocatedHours, 0), // Can't be negative
    events: overlappingEvents
  };
}

/**
 * Calculate time overlap between two time periods in hours
 */
export function calculateTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): number {
  const latestStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const earliestEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  
  if (latestStart >= earliestEnd) {
    return 0; // No overlap
  }
  
  return (earliestEnd.getTime() - latestStart.getTime()) / (1000 * 60 * 60); // Convert to hours
}

/**
 * Check if an event overlaps with any work hours on a given date
 */
export function eventOverlapsWorkHours(
  event: CalendarEvent,
  workHours: WorkHour[],
  date: Date
): boolean {
  const dateKey = date.toISOString().split('T')[0];
  const eventDateKey = event.startTime.toISOString().split('T')[0];
  
  if (eventDateKey !== dateKey) {
    return false;
  }
  
  const dayWorkHours = workHours.filter(wh => {
    const whDateKey = wh.startTime.toISOString().split('T')[0];
    return whDateKey === dateKey;
  });
  
  return dayWorkHours.some(workHour => 
    calculateTimeOverlap(
      event.startTime,
      event.endTime,
      workHour.startTime,
      workHour.endTime
    ) > 0
  );
}

/**
 * Get work hours capacity for multiple dates
 */
export function getWorkHoursCapacityForPeriod(
  workHours: WorkHour[],
  events: CalendarEvent[],
  startDate: Date,
  numDays: number
): Map<string, WorkHourCapacity> {
  const capacityMap = new Map<string, WorkHourCapacity>();
  
  for (let i = 0; i < numDays; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    const dateKey = currentDate.toISOString().split('T')[0];
    const capacity = calculateWorkHourCapacity(workHours, events, currentDate);
    
    capacityMap.set(dateKey, capacity);
  }
  
  return capacityMap;
}

/**
 * Calculate percentage of work hours used by events
 */
export function calculateWorkHourUtilization(capacity: WorkHourCapacity): number {
  if (capacity.totalHours === 0) return 0;
  return (capacity.allocatedHours / capacity.totalHours) * 100;
}

/**
 * Determine if a day is overbooked (events exceed work hours)
 */
export function isDayOverbooked(capacity: WorkHourCapacity): boolean {
  return capacity.allocatedHours > capacity.totalHours;
}

/**
 * Check if a date is a holiday
 */
export function isHolidayDate(date: Date, holidays: any[]): boolean {
  const checkDateString = date.toDateString();
  
  return holidays.some(holiday => {
    const startDate = new Date(holiday.startDate);
    const endDate = new Date(holiday.endDate);
    
    // Check all dates in the holiday range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.toDateString() === checkDateString) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Enhanced work hour capacity calculation that accounts for holidays
 */
export function calculateWorkHourCapacityWithHolidays(
  workHours: WorkHour[], 
  events: CalendarEvent[], 
  date: Date,
  holidays: any[]
): WorkHourCapacity {
  // If it's a holiday, return zero capacity
  if (isHolidayDate(date, holidays)) {
    return {
      totalHours: 0,
      allocatedHours: 0,
      availableHours: 0,
      events: []
    };
  }
  
  // Otherwise use the regular calculation
  return calculateWorkHourCapacity(workHours, events, date);
}

/**
 * Check if a date range would overlap with any existing holidays
 */
export function wouldOverlapHolidays(startDate: Date, endDate: Date, holidays: any[], excludeHolidayId?: string): boolean {
  return holidays.some(holiday => {
    // Skip the holiday we're excluding (for editing existing holidays)
    if (excludeHolidayId && holiday.id === excludeHolidayId) {
      return false;
    }
    
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    
    // Check if the ranges overlap
    return startDate <= holidayEnd && endDate >= holidayStart;
  });
}

/**
 * Get all holidays that overlap with a specific date range
 */
export function getOverlappingHolidays(startDate: Date, endDate: Date, holidays: any[]): any[] {
  return holidays.filter(holiday => {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    
    // Check if the ranges overlap
    return startDate <= holidayEnd && endDate >= holidayStart;
  });
}
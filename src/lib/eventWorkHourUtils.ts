import { CalendarEvent, WorkHour } from '../types';
import { memoizeExpensiveCalculation, timelineCalculationCache } from './memoization';
import { calculateEventDurationOnDate } from './midnightEventUtils';

// Debug counters
let allocationCallCount = 0;

/**
 * Calculates the overlap between an event and work hours in minutes
 */
export function calculateEventWorkHourOverlap(
  event: CalendarEvent,
  workHours: WorkHour[]
): number {
  let totalOverlapMinutes = 0;

  for (const workHour of workHours) {
    // Check if event and work hour are on the same day
    const eventDate = event.startTime.toDateString();
    const workDate = workHour.startTime.toDateString();
    
    if (eventDate !== workDate) {
      continue;
    }

    // Calculate overlap
    const eventStart = event.startTime.getTime();
    const eventEnd = event.endTime.getTime();
    const workStart = workHour.startTime.getTime();
    const workEnd = workHour.endTime.getTime();

    // Find the overlapping period
    const overlapStart = Math.max(eventStart, workStart);
    const overlapEnd = Math.min(eventEnd, workEnd);

    if (overlapStart < overlapEnd) {
      totalOverlapMinutes += (overlapEnd - overlapStart) / (1000 * 60);
    }
  }

  return totalOverlapMinutes;
}

/**
 * Calculates planned time for a project on a specific date
 */
export function calculatePlannedTimeForDate(
  projectId: string,
  date: Date,
  events: CalendarEvent[]
): number {
  return events
    .filter(event => event.projectId === projectId)
    .reduce((total, event) => {
      // Use the new function to properly calculate duration for events that may cross midnight
      const durationOnDate = calculateEventDurationOnDate(event, date);
      return total + durationOnDate;
    }, 0);
}

/**
 * Calculates total availability reduction for a date due to events
 */
export function calculateAvailabilityReduction(
  date: Date,
  events: CalendarEvent[],
  workHours: WorkHour[]
): number {
  const targetDateString = date.toDateString();
  
  // Get events for this date
  const dayEvents = events.filter(event => 
    event.startTime.toDateString() === targetDateString
  );

  let totalReductionHours = 0;

  for (const event of dayEvents) {
    const overlapMinutes = calculateEventWorkHourOverlap(event, workHours);
    totalReductionHours += overlapMinutes / 60;
  }

  return totalReductionHours;
}

/**
 * Generates work hours for a specific date based on settings
 */
export function generateWorkHoursForDate(
  date: Date,
  settings: any
): WorkHour[] {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
  const workSlots = settings.weeklyWorkHours[dayName] || [];

  if (!Array.isArray(workSlots)) {
    return [];
  }

  return workSlots.map((slot, index) => {
    const startTime = new Date(date);
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(date);
    const [endHour, endMin] = slot.endTime.split(':').map(Number);
    endTime.setHours(endHour, endMin, 0, 0);

    return {
      id: `work-${String(dayName)}-${index}`,
      title: 'Work Hours',
      startTime,
      endTime,
      duration: Number(slot.duration),
      type: 'work' as const
    };
  });
}

/**
 * Memoized calculation of working days for a project
 * This is the expensive calculation that was causing performance issues
 */
export const memoizedProjectWorkingDays = memoizeExpensiveCalculation(
  (projectStart: Date, projectEnd: Date, settings: any, holidays: any[]) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const projectWorkingDays = [];
    
    for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
      const checkDate = new Date(d);
      const checkDayName = dayNames[checkDate.getDay()] as keyof typeof settings.weeklyWorkHours;
      const checkWorkSlots = settings.weeklyWorkHours[checkDayName] || [];
      const checkIsHoliday = holidays.some(holiday => 
        checkDate >= new Date(holiday.startDate) && checkDate <= new Date(holiday.endDate)
      );
      
      if (!checkIsHoliday && Array.isArray(checkWorkSlots) && 
          checkWorkSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0) {
        projectWorkingDays.push(new Date(checkDate));
      }
    }
    
    return projectWorkingDays;
  },
  timelineCalculationCache,
  (projectStart, projectEnd, settings, holidays) => {
    // More efficient cache key generation
    const settingsHash = Object.keys(settings.weeklyWorkHours || {}).map(day => {
      const slots = settings.weeklyWorkHours[day];
      return Array.isArray(slots) ? slots.reduce((sum, slot) => sum + slot.duration, 0) : (slots || 0);
    }).join('-');
    
    const holidaysHash = holidays.map(h => `${h.id}`).join(',');
    
    return `days-${projectStart.getTime()}-${projectEnd.getTime()}-${settingsHash}-${holidaysHash}`;
  }
);

/**
 * Calculates project time allocation type for a specific date
 */
export function getProjectTimeAllocation(
  projectId: string,
  date: Date,
  events: CalendarEvent[],
  project: any,
  settings: any,
  holidays: any[]
): {
  type: 'planned' | 'auto-estimate' | 'none';
  hours: number;
  isWorkingDay: boolean;
} {
  allocationCallCount++;
  const startTime = performance.now();
  
  if (allocationCallCount % 100 === 0) {
    console.log(`📊 getProjectTimeAllocation called ${allocationCallCount} times`);
  }
  
  // Check if it's a working day
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
  const workSlots = settings.weeklyWorkHours[dayName] || [];
  
  // Check if it's a holiday
  const isHoliday = holidays.some(holiday => 
    date >= new Date(holiday.startDate) && date <= new Date(holiday.endDate)
  );
  
  const isWorkingDay = !isHoliday && Array.isArray(workSlots) && 
    workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;

  if (!isWorkingDay) {
    return { type: 'none', hours: 0, isWorkingDay: false };
  }

  // Check for planned time (events connected to this project)
  const plannedHours = calculatePlannedTimeForDate(projectId, date, events);
  
  if (plannedHours > 0) {
    return { type: 'planned', hours: plannedHours, isWorkingDay: true };
  }

  // Check if this date is within the project timeframe
  // Normalize dates to remove time components for accurate comparison
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  const projectStart = new Date(project.startDate);
  projectStart.setHours(0, 0, 0, 0);
  
  // For continuous projects, only check start date
  if (project.continuous) {
    if (normalizedDate < projectStart) {
      return { type: 'none', hours: 0, isWorkingDay: true };
    }
  } else {
    const projectEnd = new Date(project.endDate);
    projectEnd.setHours(0, 0, 0, 0);
    
    if (normalizedDate < projectStart || normalizedDate > projectEnd) {
      return { type: 'none', hours: 0, isWorkingDay: true };
    }
  }

  // For continuous projects, calculate working days using a reasonable time frame
  let effectiveProjectEnd: Date;
  if (project.continuous) {
    // Use a reasonable calculation window for continuous projects (1 year from start or today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearFromStart = new Date(projectStart);
    oneYearFromStart.setFullYear(oneYearFromStart.getFullYear() + 1);
    const oneYearFromToday = new Date(today);
    oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + 1);
    
    effectiveProjectEnd = oneYearFromStart > oneYearFromToday ? oneYearFromStart : oneYearFromToday;
  } else {
    effectiveProjectEnd = new Date(project.endDate);
    effectiveProjectEnd.setHours(0, 0, 0, 0);
  }

  // Use memoized calculation for project working days
  const projectWorkingDays = memoizedProjectWorkingDays(projectStart, effectiveProjectEnd, settings, holidays);

  if (projectWorkingDays.length === 0) {
    return { type: 'none', hours: 0, isWorkingDay: true };
  }

  const autoEstimateHours = project.estimatedHours / projectWorkingDays.length;
  
  const endTime = performance.now();
  if (endTime - startTime > 1) { // Log if it takes more than 1ms
    console.log(`⚠️ Slow getProjectTimeAllocation: ${(endTime - startTime).toFixed(2)}ms for project ${projectId} on ${date.toDateString()}`);
  }
  
  return { type: 'auto-estimate', hours: autoEstimateHours, isWorkingDay: true };
}

/**
 * Memoized version of getProjectTimeAllocation for performance
 */
export const memoizedGetProjectTimeAllocation = memoizeExpensiveCalculation(
  getProjectTimeAllocation,
  timelineCalculationCache,
  (projectId, date, events, project, settings, holidays) => {
    // More efficient cache key - avoid expensive JSON.stringify and reduce granularity
    const settingsHash = Object.keys(settings.weeklyWorkHours || {}).map(day => {
      const slots = settings.weeklyWorkHours[day];
      return Array.isArray(slots) ? slots.reduce((sum, slot) => sum + slot.duration, 0) : (slots || 0);
    }).join('-');
    
    const holidaysHash = holidays.map(h => `${h.id}`).join(',');
    
    // Include events in cache key - critical for planned time detection
    const eventsHash = events
      .filter(e => e.projectId === projectId) // Only consider events for this project
      .map(e => `${e.id}-${e.startTime.getTime()}-${e.endTime.getTime()}`)
      .sort() // Ensure consistent order
      .join(',');
    
    return `alloc-${projectId}-${date.getTime()}-${project.estimatedHours}-${project.startDate.getTime()}-${project.endDate.getTime()}-${settingsHash}-${holidaysHash}-${eventsHash}`;
  }
);

/**
 * Calculates overtime planned hours for a specific date
 * Shows time that is planned AND attributed to a project outside of work hours
 */
export function calculateOvertimePlannedHours(
  date: Date,
  events: CalendarEvent[],
  workHours: WorkHour[]
): number {
  // Get events that occur on this date and have a projectId (attributed to projects)
  const dayProjectEvents = events.filter(event => 
    event.projectId && calculateEventDurationOnDate(event, date) > 0
  );

  let overtimeHours = 0;

  for (const event of dayProjectEvents) {
    // Calculate total event duration for this specific date
    const eventDurationHours = calculateEventDurationOnDate(event, date);
    
    if (eventDurationHours === 0) continue;
    
    // Calculate overlap with work hours - only consider the portion of the event on this date
    const overlapMinutes = calculateEventWorkHourOverlap(event, workHours);
    const overlapHours = overlapMinutes / 60;
    
    // For events that cross midnight, we need to limit the overlap to this date's portion
    const dailyOverlapHours = Math.min(overlapHours, eventDurationHours);
    
    // Overtime is the portion that doesn't overlap with work hours
    const eventOvertimeHours = Math.max(0, eventDurationHours - dailyOverlapHours);
    overtimeHours += eventOvertimeHours;
  }

  return overtimeHours;
}

/**
 * Calculates total planned/completed hours for a specific date
 * Shows all work that has been planned in the calendar AND attributed to a project
 */
export function calculateTotalPlannedHours(
  date: Date,
  events: CalendarEvent[]
): number {
  return events
    .filter(event => event.projectId) // Only events attributed to projects
    .reduce((total, event) => {
      // Use the new function to properly calculate duration for events that may cross midnight
      const durationOnDate = calculateEventDurationOnDate(event, date);
      return total + durationOnDate;
    }, 0);
}

/**
 * Calculates other time for a specific date
 * Shows any event not attributed to a project
 */
export function calculateOtherTime(
  date: Date,
  events: CalendarEvent[]
): number {
  return events
    .filter(event => !event.projectId) // Only events NOT attributed to projects
    .reduce((total, event) => {
      // Use the new function to properly calculate duration for events that may cross midnight
      const durationOnDate = calculateEventDurationOnDate(event, date);
      return total + durationOnDate;
    }, 0);
}
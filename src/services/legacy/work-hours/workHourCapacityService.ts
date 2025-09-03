/**
 * Work Hour Capacity Service
 * Handles complex capacity calculations and work hour analysis
 * Uses single source of truth for all calculations
 */

import { 
  calculateTimeOverlapMinutes 
} from '@/services/core/calculations/dateCalculations';

import type { CalendarEvent, WorkHour } from '@/types';

/**
 * Interface for work hour capacity analysis
 */
export interface WorkHourCapacity {
  totalHours: number;
  allocatedHours: number;
  availableHours: number;
  events: CalendarEvent[];
}

/**
 * Interface for utilization metrics
 */
export interface UtilizationMetrics {
  percentage: number;
  isOverbooked: boolean;
  efficiency: 'low' | 'optimal' | 'high' | 'overbooked';
  recommendation: string;
}

/**
 * Interface for capacity planning results
 */
export interface CapacityPlanningResult {
  capacityMap: Map<string, WorkHourCapacity>;
  totalCapacity: number;
  totalAllocated: number;
  averageUtilization: number;
  overbookedDays: string[];
  underutilizedDays: string[];
}

/**
 * Interface for holiday overlap analysis
 */
export interface HolidayOverlapAnalysis {
  hasOverlap: boolean;
  overlappingHolidays: any[];
  affectedDays: number;
  recommendations: string[];
}

/**
 * Configuration constants for capacity management
 */
export const CAPACITY_MANAGEMENT_CONFIG = {
  OPTIMAL_UTILIZATION_MIN: 70, // percentage
  OPTIMAL_UTILIZATION_MAX: 90, // percentage
  OVERBOOK_TOLERANCE: 1.1, // 110% capacity before warning
  LOW_UTILIZATION_THRESHOLD: 50, // percentage
  HOURS_PER_DAY_STANDARD: 8,
  MINUTES_PER_HOUR: 60
} as const;

/**
 * Calculate how events reduce available work hours for a given date
 * 
 * @param workHours - Array of work hours for the date
 * @param events - Array of calendar events
 * @param date - Date to analyze
 * @returns Comprehensive capacity analysis
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
    allocatedHours: Math.min(allocatedHours, totalHours * CAPACITY_MANAGEMENT_CONFIG.OVERBOOK_TOLERANCE),
    availableHours: Math.max(totalHours - allocatedHours, 0),
    events: overlappingEvents
  };
}

/**
 * Calculate time overlap between two time periods in hours
 * 
 * @param start1 - Start time of first period
 * @param end1 - End time of first period
 * @param start2 - Start time of second period
 * @param end2 - End time of second period
 * @returns Overlap duration in hours
 */
/**
 * Calculate time overlap between two periods in hours
 * DELEGATES to single source of truth
 */
export function calculateTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): number {
  return calculateTimeOverlapMinutes(start1, end1, start2, end2) / 60;
}

/**
 * Check if an event overlaps with any work hours on a given date
 * 
 * @param event - Calendar event to check
 * @param workHours - Array of work hours
 * @param date - Date to check
 * @returns True if event overlaps with work hours
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
 * 
 * @param workHours - Array of work hours
 * @param events - Array of calendar events
 * @param startDate - Start date for analysis
 * @param numDays - Number of days to analyze
 * @returns Map of date strings to capacity data
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
 * 
 * @param capacity - Work hour capacity data
 * @returns Utilization percentage (0-100+)
 */
export function calculateWorkHourUtilization(capacity: WorkHourCapacity): number {
  if (capacity.totalHours === 0) return 0;
  return (capacity.allocatedHours / capacity.totalHours) * 100;
}

/**
 * Determine if a day is overbooked (events exceed work hours)
 * 
 * @param capacity - Work hour capacity data
 * @returns True if day is overbooked
 */
export function isDayOverbooked(capacity: WorkHourCapacity): boolean {
  return capacity.allocatedHours > capacity.totalHours;
}

/**
 * Analyze utilization efficiency and provide recommendations
 * 
 * @param capacity - Work hour capacity data
 * @returns Utilization metrics with recommendations
 */
export function analyzeUtilizationEfficiency(capacity: WorkHourCapacity): UtilizationMetrics {
  const percentage = calculateWorkHourUtilization(capacity);
  const isOverbooked = isDayOverbooked(capacity);
  
  let efficiency: UtilizationMetrics['efficiency'];
  let recommendation: string;
  
  if (isOverbooked) {
    efficiency = 'overbooked';
    recommendation = `Reduce workload by ${(capacity.allocatedHours - capacity.totalHours).toFixed(1)} hours to avoid burnout.`;
  } else if (percentage >= CAPACITY_MANAGEMENT_CONFIG.OPTIMAL_UTILIZATION_MIN && 
             percentage <= CAPACITY_MANAGEMENT_CONFIG.OPTIMAL_UTILIZATION_MAX) {
    efficiency = 'optimal';
    recommendation = 'Utilization is within optimal range. Good work-life balance.';
  } else if (percentage > CAPACITY_MANAGEMENT_CONFIG.OPTIMAL_UTILIZATION_MAX) {
    efficiency = 'high';
    recommendation = 'High utilization detected. Consider scheduling breaks or reducing workload.';
  } else if (percentage < CAPACITY_MANAGEMENT_CONFIG.LOW_UTILIZATION_THRESHOLD) {
    efficiency = 'low';
    recommendation = 'Low utilization detected. Consider adding more tasks or reducing scheduled work hours.';
  } else {
    efficiency = 'optimal';
    recommendation = 'Utilization is reasonable with room for additional tasks.';
  }
  
  return {
    percentage,
    isOverbooked,
    efficiency,
    recommendation
  };
}

/**
 * Check if a date is a holiday
 * 
 * @param date - Date to check
 * @param holidays - Array of holiday definitions
 * @returns True if date is a holiday
 */
export function isHolidayDateCapacity(date: Date, holidays: any[]): boolean {
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
 * 
 * @param workHours - Array of work hours
 * @param events - Array of calendar events
 * @param date - Date to analyze
 * @param holidays - Array of holiday definitions
 * @returns Capacity analysis considering holidays
 */
export function calculateWorkHourCapacityWithHolidays(
  workHours: WorkHour[], 
  events: CalendarEvent[], 
  date: Date,
  holidays: any[]
): WorkHourCapacity {
  // If it's a holiday, return zero capacity
  if (isHolidayDateCapacity(date, holidays)) {
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
 * 
 * @param startDate - Start date of range
 * @param endDate - End date of range
 * @param holidays - Array of holiday definitions
 * @param excludeHolidayId - Optional holiday ID to exclude from check
 * @returns True if range overlaps with holidays
 */
export function wouldOverlapHolidays(
  startDate: Date, 
  endDate: Date, 
  holidays: any[], 
  excludeHolidayId?: string
): boolean {
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
 * 
 * @param startDate - Start date of range
 * @param endDate - End date of range
 * @param holidays - Array of holiday definitions
 * @returns Array of overlapping holidays
 */
export function getOverlappingHolidays(startDate: Date, endDate: Date, holidays: any[]): any[] {
  return holidays.filter(holiday => {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    
    // Check if the ranges overlap
    return startDate <= holidayEnd && endDate >= holidayStart;
  });
}

/**
 * Analyze holiday overlap with a date range
 * 
 * @param startDate - Start date of range
 * @param endDate - End date of range
 * @param holidays - Array of holiday definitions
 * @returns Comprehensive holiday overlap analysis
 */
export function analyzeHolidayOverlap(
  startDate: Date, 
  endDate: Date, 
  holidays: any[]
): HolidayOverlapAnalysis {
  const overlappingHolidays = getOverlappingHolidays(startDate, endDate, holidays);
  const hasOverlap = overlappingHolidays.length > 0;
  
  let affectedDays = 0;
  if (hasOverlap) {
    // Calculate total affected days
    overlappingHolidays.forEach(holiday => {
      const holidayStart = new Date(Math.max(startDate.getTime(), new Date(holiday.startDate).getTime()));
      const holidayEnd = new Date(Math.min(endDate.getTime(), new Date(holiday.endDate).getTime()));
      const days = Math.ceil((holidayEnd.getTime() - holidayStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      affectedDays += days;
    });
  }
  
  const recommendations: string[] = [];
  if (hasOverlap) {
    recommendations.push(`${affectedDays} day(s) affected by ${overlappingHolidays.length} holiday(s).`);
    recommendations.push('Consider adjusting deadlines or work schedule to account for holidays.');
    if (affectedDays > 5) {
      recommendations.push('Significant holiday impact detected. Plan buffer time for project completion.');
    }
  } else {
    recommendations.push('No holiday conflicts detected. Schedule looks good.');
  }
  
  return {
    hasOverlap,
    overlappingHolidays,
    affectedDays,
    recommendations
  };
}

/**
 * Perform comprehensive capacity planning for a period
 * 
 * @param workHours - Array of work hours
 * @param events - Array of calendar events
 * @param startDate - Start date for planning
 * @param numDays - Number of days to plan
 * @param holidays - Array of holiday definitions
 * @returns Comprehensive capacity planning results
 */
export function performCapacityPlanning(
  workHours: WorkHour[],
  events: CalendarEvent[],
  startDate: Date,
  numDays: number,
  holidays: any[] = []
): CapacityPlanningResult {
  const capacityMap = new Map<string, WorkHourCapacity>();
  let totalCapacity = 0;
  let totalAllocated = 0;
  const overbookedDays: string[] = [];
  const underutilizedDays: string[] = [];
  
  for (let i = 0; i < numDays; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    const dateKey = currentDate.toISOString().split('T')[0];
    
    const capacity = calculateWorkHourCapacityWithHolidays(workHours, events, currentDate, holidays);
    capacityMap.set(dateKey, capacity);
    
    totalCapacity += capacity.totalHours;
    totalAllocated += capacity.allocatedHours;
    
    const utilization = calculateWorkHourUtilization(capacity);
    
    if (isDayOverbooked(capacity)) {
      overbookedDays.push(dateKey);
    } else if (utilization < CAPACITY_MANAGEMENT_CONFIG.LOW_UTILIZATION_THRESHOLD && capacity.totalHours > 0) {
      underutilizedDays.push(dateKey);
    }
  }
  
  const averageUtilization = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0;
  
  return {
    capacityMap,
    totalCapacity,
    totalAllocated,
    averageUtilization,
    overbookedDays,
    underutilizedDays
  };
}

/**
 * Generate capacity recommendations based on analysis
 * 
 * @param planningResult - Capacity planning results
 * @returns Array of actionable recommendations
 */
export function generateCapacityRecommendations(planningResult: CapacityPlanningResult): string[] {
  const recommendations: string[] = [];
  
  if (planningResult.overbookedDays.length > 0) {
    recommendations.push(`${planningResult.overbookedDays.length} day(s) are overbooked. Consider redistributing workload.`);
  }
  
  if (planningResult.underutilizedDays.length > 0) {
    recommendations.push(`${planningResult.underutilizedDays.length} day(s) are underutilized. Opportunity to schedule additional tasks.`);
  }
  
  if (planningResult.averageUtilization > CAPACITY_MANAGEMENT_CONFIG.OPTIMAL_UTILIZATION_MAX) {
    recommendations.push('Overall utilization is high. Consider adding buffer time or reducing commitments.');
  } else if (planningResult.averageUtilization < CAPACITY_MANAGEMENT_CONFIG.LOW_UTILIZATION_THRESHOLD) {
    recommendations.push('Overall utilization is low. Consider increasing productivity or reducing scheduled hours.');
  } else {
    recommendations.push('Capacity utilization is within optimal range.');
  }
  
  const efficiencyRatio = planningResult.totalAllocated / planningResult.totalCapacity;
  if (efficiencyRatio > 1.1) {
    recommendations.push('Severe overbooking detected. Immediate schedule adjustment required.');
  }
  
  return recommendations;
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
 * Calculate overlap between an event and work hours in minutes
 */
function calculateEventWorkHourOverlap(event: CalendarEvent, workHours: WorkHour[]): number {
  let totalOverlapMinutes = 0;

  for (const workHour of workHours) {
    const overlap = calculateTimeOverlap(
      event.startTime,
      event.endTime,
      workHour.startTime,
      workHour.endTime
    );

    if (overlap > 0) {
      totalOverlapMinutes += overlap * 60; // Convert hours to minutes
    }
  }

  return totalOverlapMinutes;
}

/**
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
    .filter(event => !event.projectId) // Events not attributed to projects
    .reduce((total, event) => {
      const durationOnDate = calculateEventDurationOnDate(event, date);
      return total + durationOnDate;
    }, 0);
}

/**
 * Calculate event duration on a specific date (handles midnight crossing)
 */
function calculateEventDurationOnDate(event: CalendarEvent, date: Date): number {
  const targetDateString = date.toDateString();
  const eventStartDateString = event.startTime.toDateString();
  const eventEndDateString = event.endTime.toDateString();

  // If event doesn't span this date, return 0
  if (eventStartDateString !== targetDateString && eventEndDateString !== targetDateString) {
    return 0;
  }

  // If event is entirely within this date
  if (eventStartDateString === targetDateString && eventEndDateString === targetDateString) {
    return event.duration;
  }

  // Handle midnight crossing events
  if (eventStartDateString === targetDateString) {
    // Event starts on this date, calculate time until midnight
    const midnight = new Date(date);
    midnight.setHours(23, 59, 59, 999);
    const timeUntilMidnight = (midnight.getTime() - event.startTime.getTime()) / (1000 * 60 * 60);
    return Math.min(timeUntilMidnight, event.duration);
  }

  if (eventEndDateString === targetDateString) {
    // Event ends on this date, calculate time from midnight
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 0);
    const timeFromMidnight = (event.endTime.getTime() - midnight.getTime()) / (1000 * 60 * 60);
    return Math.min(timeFromMidnight, event.duration);
  }

  return 0;
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
 * Calculate working days for a project (non-memoized version)
 */
export function calculateProjectWorkingDays(
  projectStart: Date,
  projectEnd: Date,
  settings: any,
  holidays: any[]
): Date[] {
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
}

/**
 * Get project time allocation for a specific date (non-memoized version)
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

  // Calculate project working days
  const projectWorkingDays = calculateProjectWorkingDays(projectStart, effectiveProjectEnd, settings, holidays);

  if (projectWorkingDays.length === 0) {
    return { type: 'none', hours: 0, isWorkingDay: true };
  }

  const autoEstimateHours = project.estimatedHours / projectWorkingDays.length;

  return { type: 'auto-estimate', hours: autoEstimateHours, isWorkingDay: true };
}

/**
 * Calculate planned time for a specific date and project
 */
function calculatePlannedTimeForDate(projectId: string, date: Date, events: CalendarEvent[]): number {
  const dateKey = date.toISOString().split('T')[0];
  return events
    .filter(event => {
      const eventDate = event.startTime.toISOString().split('T')[0];
      return eventDate === dateKey && event.projectId === projectId;
    })
    .reduce((total, event) => total + event.duration, 0);
}

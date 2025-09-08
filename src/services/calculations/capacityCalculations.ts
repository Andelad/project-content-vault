/**
 * Capacity Calculations Service
 * 
 * Pure calculation functions for work hour capacity analysis and utilization metrics.
 * Moved from legacy workHourCapacityService to follow new architecture patterns.
 * Uses single source of truth for all basic calculations.
 */

import { 
  calculateTimeOverlapMinutes 
} from './dateCalculations';

import { calculateEventDurationOnDate } from './eventCalculations';

import type { CalendarEvent, WorkHour } from '@/types';

// ===== INTERFACES =====

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

// ===== CONFIGURATION =====

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

// ===== CORE CAPACITY CALCULATIONS =====

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
 */
export function eventOverlapsWorkHours(
  event: CalendarEvent,
  workHours: WorkHour[],
  date: Date
): boolean {
  const dateKey = date.toISOString().split('T')[0];
  
  const dayWorkHours = workHours.filter(wh => {
    const whDateKey = wh.startTime.toISOString().split('T')[0];
    return whDateKey === dateKey;
  });
  
  return dayWorkHours.some(workHour => {
    return calculateTimeOverlap(
      event.startTime,
      event.endTime,
      workHour.startTime,
      workHour.endTime
    ) > 0;
  });
}

/**
 * Get work hour capacity analysis for a date range
 */
export function getWorkHoursCapacityForPeriod(
  workHours: WorkHour[],
  events: CalendarEvent[],
  startDate: Date,
  endDate: Date
): Map<string, WorkHourCapacity> {
  const capacityMap = new Map<string, WorkHourCapacity>();
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const capacity = calculateWorkHourCapacity(workHours, events, currentDate);
    capacityMap.set(dateKey, capacity);
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return capacityMap;
}

// ===== UTILIZATION ANALYSIS =====

/**
 * Calculate work hour utilization percentage
 */
export function calculateWorkHourUtilization(capacity: WorkHourCapacity): number {
  if (capacity.totalHours === 0) return 0;
  return Math.round((capacity.allocatedHours / capacity.totalHours) * 100);
}

/**
 * Check if a day is overbooked based on capacity
 */
export function isDayOverbooked(capacity: WorkHourCapacity): boolean {
  if (capacity.totalHours === 0) return false;
  return capacity.allocatedHours > capacity.totalHours * CAPACITY_MANAGEMENT_CONFIG.OVERBOOK_TOLERANCE;
}

/**
 * Analyze utilization efficiency and provide recommendations
 */
export function analyzeUtilizationEfficiency(capacity: WorkHourCapacity): UtilizationMetrics {
  const utilization = calculateWorkHourUtilization(capacity);
  let efficiency: UtilizationMetrics['efficiency'];
  let recommendation: string;
  
  if (utilization > 100) {
    efficiency = 'overbooked';
    recommendation = 'Consider rescheduling some events to avoid overcommitment.';
  } else if (utilization >= CAPACITY_MANAGEMENT_CONFIG.OPTIMAL_UTILIZATION_MIN && 
             utilization <= CAPACITY_MANAGEMENT_CONFIG.OPTIMAL_UTILIZATION_MAX) {
    efficiency = 'optimal';
    recommendation = 'Great work-life balance! Current scheduling is optimal.';
  } else if (utilization > CAPACITY_MANAGEMENT_CONFIG.OPTIMAL_UTILIZATION_MAX) {
    efficiency = 'high';
    recommendation = 'High utilization detected. Consider scheduling breaks.';
  } else {
    efficiency = 'low';
    recommendation = 'Low utilization - opportunity for additional tasks or projects.';
  }
  
  return {
    percentage: utilization,
    isOverbooked: isDayOverbooked(capacity),
    efficiency,
    recommendation
  };
}

// ===== HOLIDAY INTEGRATION =====

/**
 * Check if a date is a holiday
 */
export function isHolidayDateCapacity(date: Date, holidays: any[]): boolean {
  return holidays.some(holiday => {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    
    // Normalize dates to avoid time zone issues
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const startDate = new Date(holidayStart.getFullYear(), holidayStart.getMonth(), holidayStart.getDate());
    const endDate = new Date(holidayEnd.getFullYear(), holidayEnd.getMonth(), holidayEnd.getDate());
    
    return checkDate >= startDate && checkDate <= endDate;
  });
}

/**
 * Calculate work hour capacity with holiday considerations
 */
export function calculateWorkHourCapacityWithHolidays(
  workHours: WorkHour[],
  events: CalendarEvent[],
  date: Date,
  holidays: any[] = []
): WorkHourCapacity {
  // If it's a holiday, capacity is typically zero unless explicitly scheduled
  if (isHolidayDateCapacity(date, holidays)) {
    return {
      totalHours: 0,
      allocatedHours: 0,
      availableHours: 0,
      events: []
    };
  }
  
  return calculateWorkHourCapacity(workHours, events, date);
}

/**
 * Check if a date range would overlap with holidays
 */
export function wouldOverlapHolidays(
  startDate: Date,
  endDate: Date,
  holidays: any[]
): boolean {
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (isHolidayDateCapacity(currentDate, holidays)) {
      return true;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return false;
}

/**
 * Get all holidays that overlap with a date range
 */
export function getOverlappingHolidays(startDate: Date, endDate: Date, holidays: any[]): any[] {
  return holidays.filter(holiday => {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    
    // Check if date ranges overlap
    return (holidayStart <= endDate && holidayEnd >= startDate);
  });
}

/**
 * Analyze holiday overlap impact on capacity planning
 */
export function analyzeHolidayOverlap(
  startDate: Date,
  endDate: Date,
  holidays: any[]
): HolidayOverlapAnalysis {
  const overlappingHolidays = getOverlappingHolidays(startDate, endDate, holidays);
  const hasOverlap = overlappingHolidays.length > 0;
  
  // Count affected days
  let affectedDays = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (isHolidayDateCapacity(currentDate, holidays)) {
      affectedDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const recommendations: string[] = [];
  
  if (hasOverlap) {
    recommendations.push('Consider adjusting project timeline to account for holidays.');
    
    if (affectedDays > 3) {
      recommendations.push('Significant holiday impact detected - plan for reduced capacity.');
    }
    
    recommendations.push('Review team availability during holiday periods.');
  }
  
  return {
    hasOverlap,
    overlappingHolidays,
    affectedDays,
    recommendations
  };
}

// ===== CAPACITY PLANNING =====

/**
 * Perform comprehensive capacity planning for a period
 */
export function performCapacityPlanning(
  workHours: WorkHour[],
  events: CalendarEvent[],
  startDate: Date,
  endDate: Date,
  holidays: any[] = []
): CapacityPlanningResult {
  const capacityMap = new Map<string, WorkHourCapacity>();
  let totalCapacity = 0;
  let totalAllocated = 0;
  const overbookedDays: string[] = [];
  const underutilizedDays: string[] = [];
  
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const capacity = calculateWorkHourCapacityWithHolidays(workHours, events, currentDate, holidays);
    
    capacityMap.set(dateKey, capacity);
    totalCapacity += capacity.totalHours;
    totalAllocated += capacity.allocatedHours;
    
    // Analyze utilization
    const utilization = calculateWorkHourUtilization(capacity);
    
    if (isDayOverbooked(capacity)) {
      overbookedDays.push(dateKey);
    } else if (utilization < CAPACITY_MANAGEMENT_CONFIG.LOW_UTILIZATION_THRESHOLD && capacity.totalHours > 0) {
      underutilizedDays.push(dateKey);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
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
 * Generate capacity optimization recommendations
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

// ===== ADDITIONAL CAPACITY FUNCTIONS =====

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
    event.projectId && calculateEventDurationOnDate({ event, targetDate: date }) > 0
  );

  let overtimeHours = 0;

  for (const event of dayProjectEvents) {
    // Calculate total event duration for this specific date
    const eventDurationHours = calculateEventDurationOnDate({ event, targetDate: date });

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
      return total + calculateEventDurationOnDate({ event, targetDate: date });
    }, 0);
}

/**
 * Calculate "other time" - time that's occupied but not attributed to projects
 */
export function calculateOtherTime(
  date: Date,
  events: CalendarEvent[],
  workHours: WorkHour[]
): number {
  // Get non-project events for this date
  const nonProjectEvents = events.filter(event => 
    !event.projectId && calculateEventDurationOnDate({ event, targetDate: date }) > 0
  );

  let otherTimeHours = 0;

  for (const event of nonProjectEvents) {
    // Calculate overlap with work hours
    const overlapMinutes = calculateEventWorkHourOverlap(event, workHours);
    otherTimeHours += overlapMinutes / 60;
  }

  return otherTimeHours;
}

/**
 * Generate work hours for a specific date based on settings
 */
export function generateWorkHoursForDate(
  date: Date,
  settings: any
): WorkHour[] {
  if (!settings?.weeklyWorkHours) return [];

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];
  const daySlots = settings.weeklyWorkHours[dayName] || [];

  return daySlots.map((slot: any) => {
    const workHourDate = new Date(date);
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    const [endHour, endMin] = slot.endTime.split(':').map(Number);

    const startDateTime = new Date(workHourDate);
    startDateTime.setHours(startHour, startMin, 0, 0);

    const endDateTime = new Date(workHourDate);
    endDateTime.setHours(endHour, endMin, 0, 0);

    return {
      id: `${dayName}-${slot.startTime}-${slot.endTime}-${date.toISOString().split('T')[0]}`,
      title: 'Work Hours',
      description: `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} work hours`,
      startTime: startDateTime,
      endTime: endDateTime,
      duration: slot.duration,
      type: 'work' as const
    };
  });
}

/**
 * Calculate project working days within a date range
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
 * Get project time allocation for a specific date
 */
export function getProjectTimeAllocation(
  date: Date,
  projectId: string,
  events: CalendarEvent[]
): { plannedHours: number; overtimeHours: number } {
  const projectEvents = events.filter(event => 
    event.projectId === projectId && calculateEventDurationOnDate({ event, targetDate: date }) > 0
  );

  const plannedHours = projectEvents.reduce((total, event) => {
    return total + calculateEventDurationOnDate({ event, targetDate: date });
  }, 0);

  // For overtime calculation, we'd need work hours, but this is a simplified version
  const overtimeHours = 0; // Would require work hours parameter

  return { plannedHours, overtimeHours };
}

// ===== BACKWARDS COMPATIBILITY =====

// Re-export all functions individually for easy migration
export {
  // Core functions
  calculateWorkHourCapacity as legacyCalculateWorkHourCapacity,
  calculateTimeOverlap as legacyCalculateTimeOverlap,
  eventOverlapsWorkHours as legacyEventOverlapsWorkHours,
  getWorkHoursCapacityForPeriod as legacyGetWorkHoursCapacityForPeriod,
  
  // Utilization functions  
  calculateWorkHourUtilization as legacyCalculateWorkHourUtilization,
  isDayOverbooked as legacyIsDayOverbooked,
  analyzeUtilizationEfficiency as legacyAnalyzeUtilizationEfficiency,
  
  // Holiday functions
  isHolidayDateCapacity as legacyIsHolidayDateCapacity,
  calculateWorkHourCapacityWithHolidays as legacyCalculateWorkHourCapacityWithHolidays,
  wouldOverlapHolidays as legacyWouldOverlapHolidays,
  getOverlappingHolidays as legacyGetOverlappingHolidays,
  analyzeHolidayOverlap as legacyAnalyzeHolidayOverlap,
  
  // Planning functions
  performCapacityPlanning as legacyPerformCapacityPlanning,
  generateCapacityRecommendations as legacyGenerateCapacityRecommendations,
  
  // Additional functions
  calculateAvailabilityReduction as legacyCalculateAvailabilityReduction,
  calculateOvertimePlannedHours as legacyCalculateOvertimePlannedHours,
  calculateTotalPlannedHours as legacyCalculateTotalPlannedHours,
  calculateOtherTime as legacyCalculateOtherTime,
  generateWorkHoursForDate as legacyGenerateWorkHoursForDate,
  calculateProjectWorkingDays as legacyCalculateProjectWorkingDays,
  getProjectTimeAllocation as legacyGetProjectTimeAllocation
};

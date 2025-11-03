/**
 * Capacity Calculations Service
 * 
 * Pure calculation functions for work hour capacity analysis and utilization metrics.
 * Moved from legacy workHourCapacityService to follow new architecture patterns.
 * Uses single source of truth for all basic calculations.
 */

import { 
  calculateTimeOverlapMinutes 
} from '../general/dateCalculations';

import { calculateEventDurationOnDate } from '../events/eventCalculations';
import { calculateWorkHoursTotal, calculateDayWorkHours } from '../../ui/positioning/ProjectBarPositioning';
import { getDateKey } from '@/utils/dateFormatUtils';

// Import unified functions - these are the single source of truth
import { 
  generateWorkHoursForDate as unifiedGenerateWorkHoursForDate,
  calculateProjectWorkingDays as unifiedCalculateProjectWorkingDays,
  calculateOvertimePlannedHours as unifiedCalculateOvertimePlannedHours
} from '../../unified/UnifiedEventWorkHourService';

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
  const dateKey = getDateKey(date);
  
  const dayWorkHours = workHours.filter(wh => {
    const whDateKey = getDateKey(wh.startTime);
    return whDateKey === dateKey;
  });
  
  const dayEvents = events.filter(event => {
    const eventDateKey = getDateKey(event.startTime);
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
  const dateKey = getDateKey(date);
  
  const dayWorkHours = workHours.filter(wh => {
    const whDateKey = getDateKey(wh.startTime);
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
    const dateKey = getDateKey(currentDate);
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
    const dateKey = getDateKey(currentDate);
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
 * DELEGATES to single source of truth in UnifiedEventWorkHourService
 */
export function calculateOvertimePlannedHours(
  date: Date,
  events: CalendarEvent[],
  workHours: WorkHour[]
): number {
  return unifiedCalculateOvertimePlannedHours(date, events, workHours);
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
    .filter(event => 
      event.projectId && // Only events attributed to projects
      event.category !== 'habit' && // Habits never count toward project time
      event.category !== 'task' // Tasks never count toward project time
    )
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
 * DELEGATES to single source of truth in UnifiedEventWorkHourService
 */
export function generateWorkHoursForDate(
  date: Date,
  settings: any
): WorkHour[] {
  return unifiedGenerateWorkHoursForDate(date, settings);
}

/**
 * Calculate project working days within a date range
 * DELEGATES to single source of truth in UnifiedEventWorkHourService
 */
export function calculateProjectWorkingDays(
  projectStart: Date,
  projectEnd: Date,
  settings: any,
  holidays: any[]
): Date[] {
  const result = unifiedCalculateProjectWorkingDays(projectStart, projectEnd, settings, holidays);
  return result.workingDays;
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

/**
 * Calculate committed hours from calendar events for a specific date and project
 * Unified function for timeline business logic
 */
export function calculateCommittedHoursForDate(
  date: Date,
  projectId: string,
  events: CalendarEvent[]
): number {
  return events
    .filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      // Check if event occurs on the target date
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      return event.projectId === projectId &&
        event.category !== 'habit' && // Defensive: habits never belong to projects
        event.category !== 'task' && // Defensive: tasks never belong to projects
        eventStart < nextDay &&
        eventEnd >= targetDate;
    })
    .reduce((total, event) => {
      return total + calculateEventDurationOnDate({ event, targetDate: date });
    }, 0);
}

// ============================================================================
// WORK HOURS VALIDATION FUNCTIONS (Migrated from TimelineBusinessLogicService)
// ============================================================================

/**
 * Check if work slots array has any work hours configured
 * Migrated from TimelineBusinessLogicService.WorkHoursValidationService
 */
export function hasWorkHoursConfigured(workSlots: any[]): boolean {
  return Array.isArray(workSlots) && calculateWorkHoursTotal(workSlots) > 0;
}

/**
 * Check if a specific day has work hours configured in settings
 * Migrated from TimelineBusinessLogicService.WorkHoursValidationService
 */
export function dayHasWorkHoursConfigured(date: Date, settings: any): boolean {
  const dayWorkHours = calculateDayWorkHours(date, settings);
  return hasWorkHoursConfigured(dayWorkHours);
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

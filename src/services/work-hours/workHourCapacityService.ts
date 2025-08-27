/**
 * Work Hour Capacity Management Service
 * 
 * This service handles work hour capacity calculations, utilization analysis,
 * holiday management, and workload planning extracted from the workHoursUtils
 * library. It provides comprehensive work hour management and optimization.
 * 
 * Key Features:
 * - Work hour capacity calculation and analysis
 * - Event overlap detection with work schedules
 * - Holiday integration and management
 * - Workload utilization tracking
 * - Overbooking detection and prevention
 * - Multi-day capacity planning
 * 
 * @module WorkHourCapacityService
 */

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
  
  const overlapMilliseconds = earliestEnd.getTime() - latestStart.getTime();
  return overlapMilliseconds / (1000 * 60 * 60); // Convert to hours
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

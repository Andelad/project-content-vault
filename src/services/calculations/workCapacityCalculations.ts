/**
 * Work & Capacity Calculations Service
 * 
 * Consolidated calculation functions for:
 * - Work hour duration calculations and schedule logic
 * - Capacity analysis and utilization metrics
 * 
 * Consolidated from:
 * - workHourCalculations.ts
 * - capacityCalculations.ts
 * 
 * Date: September 10, 2025
 */

import { 
  calculateDurationHours,
  calculateDurationMinutes,
  calculateTimeOverlapMinutes 
} from './dateCalculations';
import { 
  getWeekStart as coreGetWeekStart,
  getCurrentWeekStart as coreGetCurrentWeekStart
} from './timeCalculations';
import { calculateEventDurationOnDate } from './eventCalculations';
import { calculateWorkHoursTotal, calculateDayWorkHours } from './timelineCalculations';

import { WorkHour, WorkSlot } from '@/types/core';

// =====================================================================================
// WORK HOUR CALCULATIONS
// =====================================================================================

/**
 * Calculate duration in hours between two times
 * Uses the core dateCalculations service as single source of truth
 */
export function calculateWorkHourDuration(startTime: Date, endTime: Date): number {
  return calculateDurationHours(startTime, endTime);
}

/**
 * Validate work hour data
 */
export function validateWorkHour(workHour: Partial<WorkHour>): { 
  isValid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];

  if (!workHour.startTime) {
    errors.push('Start time is required');
  }

  if (!workHour.endTime) {
    errors.push('End time is required');
  }

  if (workHour.startTime && workHour.endTime) {
    const start = new Date(workHour.startTime);
    const end = new Date(workHour.endTime);
    
    if (start >= end) {
      errors.push('End time must be after start time');
    }

    if (calculateWorkHourDuration(start, end) > 24) {
      errors.push('Work hour duration cannot exceed 24 hours');
    }
  }

  if (workHour.duration !== undefined && workHour.duration < 0) {
    errors.push('Duration cannot be negative');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create a new work hour with calculated duration
 */
export function createWorkHour(startTime: Date, endTime: Date, title: string = 'Work', description?: string): WorkHour {
  const duration = calculateWorkHourDuration(
    new Date(startTime), 
    new Date(endTime)
  );

  return {
    id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    description,
    startTime,
    endTime,
    duration,
    type: 'work' as const
  };
}

/**
 * Update work hour with recalculated duration if times changed
 */
export function updateWorkHour(
  workHour: WorkHour, 
  updates: Partial<WorkHour>
): WorkHour {
  const updatedWorkHour = { ...workHour, ...updates };

  // Recalculate duration if start or end time changed
  if (updates.startTime || updates.endTime) {
    updatedWorkHour.duration = calculateWorkHourDuration(
      new Date(updatedWorkHour.startTime),
      new Date(updatedWorkHour.endTime)
    );
  }

  return updatedWorkHour;
}

// =====================================================================================
// CAPACITY CALCULATIONS
// =====================================================================================

/**
 * Calculate work capacity percentage
 */
export function calculateCapacityPercentage(usedHours: number, totalCapacity: number): number {
  if (totalCapacity <= 0) return 0;
  return Math.round((usedHours / totalCapacity) * 100);
}

/**
 * Calculate remaining capacity
 */
export function calculateRemainingCapacity(usedHours: number, totalCapacity: number): number {
  return Math.max(0, totalCapacity - usedHours);
}

/**
 * Calculate overtime hours
 */
export function calculateOvertimeHours(actualHours: number, standardHours: number): number {
  return Math.max(0, actualHours - standardHours);
}

/**
 * Calculate utilization rate
 */
export function calculateUtilizationRate(productiveHours: number, totalHours: number): number {
  if (totalHours <= 0) return 0;
  return Math.round((productiveHours / totalHours) * 100);
}

// =====================================================================================
// WORK SCHEDULE CALCULATIONS
// =====================================================================================

/**
 * Calculate total work hours for a date range
 */
export function calculateTotalWorkHours(workHours: WorkHour[]): number {
  return workHours.reduce((total, workHour) => {
    return total + (workHour.duration || 0);
  }, 0);
}

/**
 * Group work hours by date
 */
export function groupWorkHoursByDate(workHours: WorkHour[]): Record<string, WorkHour[]> {
  return workHours.reduce((groups, workHour) => {
    const dateKey = new Date(workHour.startTime).toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(workHour);
    return groups;
  }, {} as Record<string, WorkHour[]>);
}

/**
 * Calculate work hours for a specific date
 */
export function calculateWorkHoursForDate(workHours: WorkHour[], date: Date): number {
  const targetDate = new Date(date).toDateString();
  const dayWorkHours = workHours.filter(wh => 
    new Date(wh.startTime).toDateString() === targetDate
  );
  return calculateTotalWorkHours(dayWorkHours);
}

// =====================================================================================
// LEGACY COMPATIBILITY LAYER
// =====================================================================================

/**
 * WorkHourCalculationService - Legacy compatibility class
 * @deprecated Use individual functions instead
 */
export class WorkHourCalculationService {
  // Duration calculations
  static calculateDuration = calculateWorkHourDuration;
  
  // Work hour operations
  static create = createWorkHour;
  static update = updateWorkHour;
  static validate = validateWorkHour;
  
  // Aggregate calculations
  static calculateTotal = calculateTotalWorkHours;
  static groupByDate = groupWorkHoursByDate;
  static calculateForDate = calculateWorkHoursForDate;
}

/**
 * CapacityCalculationService - Legacy compatibility class
 * @deprecated Use individual functions instead
 */
export class CapacityCalculationService {
  static calculatePercentage = calculateCapacityPercentage;
  static calculateRemaining = calculateRemainingCapacity;
  static calculateOvertime = calculateOvertimeHours;
  static calculateUtilization = calculateUtilizationRate;
}

// Re-export for backward compatibility
export { 
  calculateWorkHourDuration as calculateDuration,
  calculateTotalWorkHours as calculateTotal,
  calculateCapacityPercentage as calculatePercentage
};

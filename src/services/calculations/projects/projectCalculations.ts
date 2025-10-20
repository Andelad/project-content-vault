/**
 * Duration Formatting Service
 * Handles formatting of time durations and date ranges for project displays
 * Uses single source of truth for all calculations
 */

import { Project } from '@/types';
import { 
  datesOverlap as coreDatesOverlap,
  calculateDurationDays,
  formatDuration as coreFormatDuration
} from '../general/dateCalculations';

// ===== WORKING DAYS INTERFACES =====
export interface ProjectWorkSlot {
  startTime: string;
  endTime: string;
  duration: number;
}

export interface ProjectWeeklyWorkHours {
  sunday: ProjectWorkSlot[];
  monday: ProjectWorkSlot[];
  tuesday: ProjectWorkSlot[];
  wednesday: ProjectWorkSlot[];
  thursday: ProjectWorkSlot[];
  friday: ProjectWorkSlot[];
  saturday: ProjectWorkSlot[];
}

export interface ProjectHoliday {
  startDate: string | Date;
  endDate: string | Date;
  title: string;
}

export interface ProjectWorkingDaysSettings {
  weeklyWorkHours?: ProjectWeeklyWorkHours;
}

const DAY_NAMES: (keyof ProjectWeeklyWorkHours)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

/**
 * Calculate working days for auto-estimation excluding specified days
 */
export function calculateAutoEstimateWorkingDays(
  startDate: Date,
  endDate: Date,
  autoEstimateDays: Project['autoEstimateDays'],
  settings?: any,
  holidays: any[] = []  // Accept both Date[] and Holiday[] objects
): Date[] {
  const workingDays: Date[] = [];
  const current = new Date(startDate);
  
  // Default to all days enabled if not specified
  const enabledDays = autoEstimateDays || {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true,
  };

  const dayMap = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  } as const;

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const dayName = dayMap[dayOfWeek as keyof typeof dayMap];
    
    // Check if this day is enabled for auto-estimation
    const isDayEnabled = enabledDays[dayName];
    
    // Check if it's a holiday - handle both Date[] and Holiday[] arrays
    const isHoliday = holidays.some(holiday => {
      // If holiday is a Date object or date string
      if (holiday instanceof Date || typeof holiday === 'string') {
        const holidayDate = new Date(holiday);
        return holidayDate.toDateString() === current.toDateString();
      }
      // If holiday is a Holiday object with startDate/endDate
      if (holiday.startDate && holiday.endDate) {
        const holidayStart = new Date(holiday.startDate);
        const holidayEnd = new Date(holiday.endDate);
        const currentNormalized = new Date(current);
        currentNormalized.setHours(0, 0, 0, 0);
        holidayStart.setHours(0, 0, 0, 0);
        holidayEnd.setHours(0, 0, 0, 0);
        return currentNormalized >= holidayStart && currentNormalized <= holidayEnd;
      }
      return false;
    });

    if (isDayEnabled && !isHoliday) {
      workingDays.push(new Date(current));
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

/**
 * Calculate auto-estimate hours per day for a project
 */
export function calculateAutoEstimateHoursPerDay(
  project: Project,
  settings?: any,
  holidays: Date[] = []
): number {
  const startDate = new Date(project.startDate);
  const endDate = project.continuous ? new Date() : new Date(project.endDate);
  
  const workingDays = calculateAutoEstimateWorkingDays(
    startDate,
    endDate,
    project.autoEstimateDays,
    settings,
    holidays
  );

  if (workingDays.length === 0) {
    return 0;
  }

  return project.estimatedHours / workingDays.length;
}

/**
 * Check if two date ranges overlap (delegates to core date calculations)
 */
export function datesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  // Delegate to core date calculations for single source of truth
  return coreDatesOverlap(startA, endA, startB, endB);
}

// ===== WORKING DAYS CALCULATIONS =====

/**
 * Calculate working days remaining until end date
 */
export function calculateWorkingDaysRemaining(
  endDate: Date, 
  settings: ProjectWorkingDaysSettings, 
  holidays: ProjectHoliday[] = []
): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetEndDate = new Date(endDate);
  targetEndDate.setHours(0, 0, 0, 0);
  
  // If end date is in the past or today, return 0
  if (targetEndDate <= today) {
    return 0;
  }
  
  // If no settings, return 0
  if (!settings?.weeklyWorkHours) {
    return 0;
  }
  
  let workingDays = 0;
  const current = new Date(today);
  current.setDate(current.getDate() + 1); // Start from tomorrow
  
  while (current <= targetEndDate) {
    if (isWorkingDay(current, settings, holidays)) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Calculate total working days between start and end dates
 */
export function calculateTotalWorkingDays(
  startDate: Date, 
  endDate: Date, 
  settings: ProjectWorkingDaysSettings, 
  holidays: ProjectHoliday[] = []
): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  // If no settings, return 0
  if (!settings?.weeklyWorkHours) {
    return 0;
  }
  
  let workingDays = 0;
  const current = new Date(start);
  
  while (current <= end) {
    if (isWorkingDay(current, settings, holidays)) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Calculate valid days in a period based on included days filter
 */
export function calculateValidDaysInPeriod(
  startDate: Date,
  endDate: Date,
  includedDays: Record<keyof ProjectWeeklyWorkHours, boolean>
): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayName = DAY_NAMES[current.getDay()];
    
    if (includedDays[dayName]) {
      count++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

// calculateDayWorkHours function moved to timelineCalculations.ts for consolidation

/**
 * Get all working days between two dates
 */
export function getWorkingDaysBetween(
  startDate: Date,
  endDate: Date,
  settings: ProjectWorkingDaysSettings,
  holidays: ProjectHoliday[] = []
): Date[] {
  const workingDays: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  while (current <= end) {
    if (isWorkingDay(current, settings, holidays)) {
      workingDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Check if a specific date is a working day
 */
function isWorkingDay(
  date: Date, 
  settings: ProjectWorkingDaysSettings, 
  holidays: ProjectHoliday[] = []
): boolean {
  // Check if it's a holiday
  const isHoliday = holidays.some(holiday => {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    holidayStart.setHours(0, 0, 0, 0);
    holidayEnd.setHours(0, 0, 0, 0);
    return date >= holidayStart && date <= holidayEnd;
  });
  
  if (isHoliday) {
    return false;
  }
  
  // Check if it's a day with work hours configured
  const dayName = DAY_NAMES[date.getDay()];
  const workSlots = settings.weeklyWorkHours?.[dayName] || [];
  
  const hasWorkHours = Array.isArray(workSlots) && 
    workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;
  
  return hasWorkHours;
}

export class DurationFormattingService {
  /**
   * Format a date range as a human-readable duration string
   * @param startDate - Start date of the period
   * @param endDate - End date of the period
   * @returns Formatted duration string (e.g., "2w 3d", "5 days", "3 weeks")
   */
  static formatDuration(startDate: Date, endDate: Date): string {
    const diffDays = calculateDurationDays(startDate, endDate);
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    if (weeks === 0) return `${diffDays} days`;
    if (days === 0) return `${weeks} weeks`;
    return `${weeks}w ${days}d`;
  }

  /**
   * Format duration in days only
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of days as string
   */
  static formatDurationInDays(startDate: Date, endDate: Date): string {
    const diffDays = calculateDurationDays(startDate, endDate);
    return `${diffDays} days`;
  }

  /**
   * Format duration in weeks only
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of weeks as string
   */
  static formatDurationInWeeks(startDate: Date, endDate: Date): string {
    const diffDays = calculateDurationDays(startDate, endDate);
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} weeks`;
  }
}

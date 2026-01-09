/**
 * Holiday and date range utilities
 * Extracted from TimelineView and other components
 */

import { calculateDurationDays, normalizeToMidnight, addDaysToDate } from '@/presentation/utils/dateCalculations';
import { APP_LOCALE } from '@/presentation/utils/dateFormatUtils';

export interface Holiday {
  startDate: Date;
  endDate: Date;
  name: string;
  id?: string;
}

export interface HolidayDate {
  date: Date;
  name: string;
  holidayId: string;
}

/**
 * Expand holiday ranges into individual Date objects for fast lookup
 */
export function expandHolidayDates(holidays: Holiday[]): Date[] {
  if (!holidays || holidays.length === 0) return [];
  
  const result: Date[] = [];
  for (const holiday of holidays) {
    let start = new Date(holiday.startDate);
    let end = new Date(holiday.endDate);
    start = normalizeToMidnight(start);
    end = normalizeToMidnight(end);
    
    for (let d = new Date(start); d <= end; d = addDaysToDate(d, 1)) {
      result.push(new Date(d));
    }
  }
  
  return result;
}

/**
 * Check if a specific date is a holiday
 */
export function isHolidayDate(date: Date, holidayDates: Date[]): boolean {
  let normalizedDate = new Date(date);
  normalizedDate = normalizeToMidnight(normalizedDate);
  
  return holidayDates.some(holidayDate => {
    let normalizedHoliday = new Date(holidayDate);
    normalizedHoliday = normalizeToMidnight(normalizedHoliday);
    return normalizedDate.getTime() === normalizedHoliday.getTime();
  });
}

/**
 * Get holidays that fall within a date range
 */
export function getHolidaysInRange(holidays: Holiday[], startDate: Date, endDate: Date): Holiday[] {
  return holidays.filter(holiday => {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    
    // Check if holiday overlaps with the date range
    return holidayStart <= endDate && holidayEnd >= startDate;
  });
}

/**
 * Expand holiday date ranges into individual HolidayDate objects for detailed lookup
 * Migrated from legacy/HolidayCalculationService
 */
export function expandHolidayDatesDetailed(holidays: Holiday[]): HolidayDate[] {
  const holidayDates: HolidayDate[] = [];

  holidays.forEach(holiday => {
    const startDate = new Date(holiday.startDate);
    const endDate = new Date(holiday.endDate);
    const holidayName = holiday.name || 'Holiday';
    const holidayId = holiday.id || 'unknown';

    // Iterate through each day in the holiday range
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      holidayDates.push({
        date: new Date(currentDate),
        name: holidayName,
        holidayId: holidayId
      });

      // Move to next day
      currentDate = addDaysToDate(currentDate, 1);
    }
  });

  return holidayDates;
}

/**
 * Checks if a given date falls within any holiday period
 * Migrated from legacy/HolidayCalculationService
 */
export function getHolidayForDate(date: Date, holidays: Holiday[]): HolidayDate | null {
  const holidayDates = expandHolidayDatesDetailed(holidays);

  const holidayDate = holidayDates.find(holidayDate =>
    holidayDate.date.toDateString() === date.toDateString()
  );

  return holidayDate || null;
}

/**
 * Gets all holidays within a date range (detailed format)
 * Migrated from legacy/HolidayCalculationService
 */
export function getHolidaysInRangeDetailed(
  startDate: Date,
  endDate: Date,
  holidays: Holiday[]
): HolidayDate[] {
  const holidayDates = expandHolidayDatesDetailed(holidays);

  return holidayDates.filter(holidayDate =>
    holidayDate.date >= startDate && holidayDate.date <= endDate
  );
}

/**
 * Calculates the number of holiday days within a date range
 * Migrated from legacy/HolidayCalculationService
 */
export function countHolidayDaysInRange(
  startDate: Date,
  endDate: Date,
  holidays: Holiday[]
): number {
  return getHolidaysInRangeDetailed(startDate, endDate, holidays).length;
}

/**
 * Generate a sequence of dates between start and end
 */
export function generateDateSequence(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  let current = new Date(startDate);
  current = normalizeToMidnight(current);
  
  let end = new Date(endDate);
  end = normalizeToMidnight(end);
  
  while (current <= end) {
    dates.push(new Date(current));
    current = addDaysToDate(current, 1);
  }
  
  return dates;
}

/**
 * Calculate business days (excluding weekends) between dates
 */
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  let current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current = addDaysToDate(current, 1);
  }
  
  return count;
}

/**
 * Check if a date falls on a weekend
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
}

/**
 * Check if a date is a working day (not weekend, not holiday)
 * 
 * @deprecated Use isWorkingDay from utils/dateCalculations instead (single source of truth)
 * This function is kept for backward compatibility but delegates to the canonical implementation.
 * 
 * @param date - Date to check
 * @param holidays - List of holidays
 * @returns true if the date is a working day
 */
export function isWorkingDay(date: Date, holidays: Holiday[]): boolean {
  // Delegate to single source of truth in utils/dateCalculations
  // Note: utils version expects Settings and Date[] for holidays
  // This is a compatibility shim - callers should migrate to utils version
  const holidayDates = expandHolidayDates(holidays);
  
  // Check weekend
  if (isWeekend(date)) {
    return false;
  }
  
  // Check holiday
  return !isHolidayDate(date, holidayDates);
}

/**
 * Validate holiday placement
 * 
 * Business Rules:
 * - Start date must be before or equal to end date
 * - Holiday must have a name
 * - Holiday duration should be reasonable (not more than 365 days)
 * - Holiday dates should not overlap with existing holidays (optional check)
 * 
 * @param holiday - Holiday to validate
 * @param existingHolidays - Existing holidays to check for overlaps (optional)
 * @returns Validation result
 */
export function validateHolidayPlacement(
  holiday: Partial<Holiday>,
  existingHolidays: Holiday[] = []
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate name
  if (!holiday.name || holiday.name.trim() === '') {
    errors.push('Holiday name is required');
  }
  
  // Validate dates exist
  if (!holiday.startDate) {
    errors.push('Start date is required');
  }
  
  if (!holiday.endDate) {
    errors.push('End date is required');
  }
  
  // Validate date range
  if (holiday.startDate && holiday.endDate) {
    const start = new Date(holiday.startDate);
    const end = new Date(holiday.endDate);
    
    if (start > end) {
      errors.push('Start date must be before or equal to end date');
    }
    
    // Check for unreasonably long holidays
    const durationDays = calculateDurationDays(start, end);
    if (durationDays > 365) {
      warnings.push('Holiday duration exceeds 1 year - this may be unintentional');
    }
    
    // Check for overlaps with existing holidays
    if (existingHolidays.length > 0) {
      const overlapping = getHolidaysInRange(existingHolidays, start, end);
      
      if (overlapping.length > 0) {
        warnings.push(
          `This holiday overlaps with ${overlapping.length} existing holiday(s): ${
            overlapping.map(h => h.name).join(', ')
          }`
        );
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate working days (excluding weekends and holidays) between dates
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @param holidays - List of holidays
 * @returns Number of working days
 */
export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: Holiday[]
): number {
  let count = 0;
  let current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWorkingDay(current, holidays)) {
      count++;
    }
    current = addDaysToDate(current, 1);
  }
  
  return count;
}

/**
 * Get the number of days between two dates - REMOVED, using core calculateDurationDays
 * This function was a duplicate of core functionality.
 */

/**
 * Date range constants
 */
export const DATE_RANGE_CONSTANTS = {
  DAYS_PER_WEEK: 7,
  MONTHS_PER_YEAR: 12,
  WEEKEND_DAYS: [0, 6], // Sunday, Saturday
  WEEKDAY_DAYS: [1, 2, 3, 4, 5] // Monday through Friday
} as const;

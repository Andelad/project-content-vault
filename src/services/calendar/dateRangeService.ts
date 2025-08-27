/**
 * Holiday and date range utilities
 * Extracted from TimelineView and other components
 */

export interface Holiday {
  startDate: Date;
  endDate: Date;
  name: string;
  id?: string;
}

export interface DateRangeFormatOptions {
  includeYear?: boolean;
  format?: 'short' | 'long';
  locale?: string;
}

/**
 * Expand holiday ranges into individual Date objects for fast lookup
 */
export function expandHolidayDates(holidays: Holiday[]): Date[] {
  if (!holidays || holidays.length === 0) return [];
  
  const result: Date[] = [];
  for (const holiday of holidays) {
    const start = new Date(holiday.startDate);
    const end = new Date(holiday.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      result.push(new Date(d));
    }
  }
  
  return result;
}

/**
 * Check if a specific date is a holiday
 */
export function isHolidayDate(date: Date, holidayDates: Date[]): boolean {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  return holidayDates.some(holidayDate => {
    const normalizedHoliday = new Date(holidayDate);
    normalizedHoliday.setHours(0, 0, 0, 0);
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
 * Format a date range with intelligent formatting
 */
export function formatDateRange(
  startDate: Date, 
  endDate: Date, 
  options: DateRangeFormatOptions = {}
): string {
  const { format = 'short', locale = 'en-US' } = options;
  
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  
  if (sameMonth && sameYear) {
    return `${startDate.toLocaleDateString(locale, { 
      month: format === 'long' ? 'long' : 'short',
      day: 'numeric'
    })} - ${endDate.toLocaleDateString(locale, { 
      day: 'numeric',
      year: 'numeric'
    })}`;
  } else if (sameYear) {
    return `${startDate.toLocaleDateString(locale, { 
      month: 'short',
      day: 'numeric'
    })} - ${endDate.toLocaleDateString(locale, { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })}`;
  } else {
    return `${startDate.toLocaleDateString(locale, { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })} - ${endDate.toLocaleDateString(locale, { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })}`;
  }
}

/**
 * Generate a sequence of dates between start and end
 */
export function generateDateSequence(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Calculate business days (excluding weekends) between dates
 */
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
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
 * Get the number of days between two dates
 */
export function getDaysDifference(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Date range constants
 */
export const DATE_RANGE_CONSTANTS = {
  DAYS_PER_WEEK: 7,
  MONTHS_PER_YEAR: 12,
  WEEKEND_DAYS: [0, 6], // Sunday, Saturday
  WEEKDAY_DAYS: [1, 2, 3, 4, 5] // Monday through Friday
} as const;

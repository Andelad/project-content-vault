/**
 * Pure Date Calculations
 * 
 * Contains only pure mathematical functions for date operations.
 * No side effects, no caching, no external dependencies beyond date-fns.
 * 
 * ✅ Pure functions only - no side effects
 * ✅ Testable without mocks
 * ✅ Deterministic outputs
 */

import { addDays, subDays, endOfWeek, isWeekend } from 'date-fns';
import { getDateKey } from '@/utils/dateFormatUtils';

/**
 * SINGLE SOURCE OF TRUTH - Duration Calculations
 * All duration calculations throughout the app MUST use these functions
 */

/**
 * Calculate duration between two dates in hours
 * THE authoritative duration calculation used everywhere
 */
export function calculateDurationHours(startTime: Date, endTime: Date): number {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
}

/**
 * Calculate duration between two dates in minutes  
 * THE authoritative minute calculation used everywhere
 */
export function calculateDurationMinutes(startTime: Date, endTime: Date): number {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60);
}

/**
 * Calculate duration between two dates in days
 * THE authoritative day calculation used everywhere
 */
export function calculateDurationDays(startDate: Date, endDate: Date): number {
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format duration from hours to human-readable string
 * THE authoritative duration formatting used everywhere
 */
export function formatDuration(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (wholeHours > 0 && minutes > 0) {
    return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
  } else if (wholeHours > 0) {
    return `${wholeHours}:00`;
  } else {
    return `0:${minutes.toString().padStart(2, '0')}`;
  }
}

/**
 * Format duration from minutes to human-readable string
 * THE authoritative minute formatting used everywhere
 */
export function formatDurationFromMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`;
  } else if (hours > 0) {
    return `${hours}:00`;
  } else {
    return `0:${remainingMinutes.toString().padStart(2, '0')}`;
  }
}

/**
 * SINGLE SOURCE OF TRUTH - Overlap Calculations
 * All overlap detection throughout the app MUST use these functions
 */

/**
 * Calculate overlap between two time ranges in hours
 * THE authoritative overlap calculation used everywhere
 */
export function calculateTimeOverlapHours(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): number {
  const overlapStart = Math.max(startA.getTime(), startB.getTime());
  const overlapEnd = Math.min(endA.getTime(), endB.getTime());
  
  if (overlapStart < overlapEnd) {
    return (overlapEnd - overlapStart) / (1000 * 60 * 60);
  }
  
  return 0;
}

/**
 * Calculate overlap between two time ranges in minutes
 * THE authoritative overlap calculation in minutes used everywhere
 */
export function calculateTimeOverlapMinutes(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): number {
  const overlapStart = Math.max(startA.getTime(), startB.getTime());
  const overlapEnd = Math.min(endA.getTime(), endB.getTime());
  
  if (overlapStart < overlapEnd) {
    return (overlapEnd - overlapStart) / (1000 * 60);
  }
  
  return 0;
}

/**
 * Check if two date ranges overlap (inclusive)
 * THE authoritative overlap detection used everywhere
 */
export function datesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA <= endB && endA >= startB;
}

/**
 * Calculate business days between two dates
 */
export function calculateBusinessDaysBetween(startDate: Date, endDate: Date, holidays: Date[] = []): number {
  let businessDays = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (!isWeekend(current) && !isHoliday(current, holidays)) {
      businessDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return businessDays;
}

/**
 * Get all business days in a date range
 */
export function calculateBusinessDaysInRange(startDate: Date, endDate: Date, holidays: Date[] = []): Date[] {
  const businessDays: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (!isWeekend(current) && !isHoliday(current, holidays)) {
      businessDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return businessDays;
}

/**
 * Check if a date falls on a holiday
 */
export function isHoliday(date: Date, holidays: Date[]): boolean {
  const dateStr = getDateKey(date);
  return holidays.some(holiday => 
    getDateKey(holiday) === dateStr
  );
}

/**
 * Calculate working days in a specific week
 */
export function calculateWorkingDaysInWeek(weekStart: Date, holidays: Date[] = []): Date[] {
  const weekEnd = endOfWeek(weekStart);
  return calculateBusinessDaysInRange(weekStart, weekEnd, holidays);
}

/**
 * Calculate date range for timeline viewport
 */
export function calculateTimelineViewport(
  currentDate: Date, 
  mode: 'days' | 'weeks', 
  count: number
): { start: Date; end: Date } {
  if (mode === 'weeks') {
    const start = subDays(currentDate, count * 7);
    const end = addDays(currentDate, count * 7);
    return { start, end };
  } else {
    const start = subDays(currentDate, count);
    const end = addDays(currentDate, count);
    return { start, end };
  }
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Calculate overlap between two date ranges
 */
export function calculateDateRangeOverlap(
  range1: { start: Date; end: Date },
  range2: { start: Date; end: Date }
): { start: Date; end: Date } | null {
  const start = new Date(Math.max(range1.start.getTime(), range2.start.getTime()));
  const end = new Date(Math.min(range1.end.getTime(), range2.end.getTime()));
  
  if (start <= end) {
    return { start, end };
  }
  
  return null; // No overlap
}

/**
 * Calculate the difference in days between two dates
 */
export function calculateDayDifference(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Add business days to a date (excluding weekends and holidays)
 */
export function addBusinessDays(startDate: Date, businessDays: number, holidays: Date[] = []): Date {
  let current = new Date(startDate);
  let addedDays = 0;
  
  while (addedDays < businessDays) {
    current = addDays(current, 1);
    if (!isWeekend(current) && !isHoliday(current, holidays)) {
      addedDays++;
    }
  }
  
  return current;
}

/**
 * Subtract business days from a date (excluding weekends and holidays)
 */
export function subtractBusinessDays(startDate: Date, businessDays: number, holidays: Date[] = []): Date {
  let current = new Date(startDate);
  let subtractedDays = 0;
  
  while (subtractedDays < businessDays) {
    current = subDays(current, 1);
    if (!isWeekend(current) && !isHoliday(current, holidays)) {
      subtractedDays++;
    }
  }
  
  return current;
}

/**
 * Calculate duration between dates in various units
 */
export function calculateDateDuration(
  startDate: Date, 
  endDate: Date, 
  unit: 'days' | 'weeks' | 'months' | 'businessDays' = 'days',
  holidays: Date[] = []
): number {
  switch (unit) {
    case 'days':
      return calculateDayDifference(startDate, endDate);
    case 'weeks':
      return Math.round(calculateDayDifference(startDate, endDate) / 7);
    case 'months':
      return Math.round(calculateDayDifference(startDate, endDate) / 30);
    case 'businessDays':
      return calculateBusinessDaysBetween(startDate, endDate, holidays);
    default:
      return calculateDayDifference(startDate, endDate);
  }
}

/**
 * Check if a date falls within a date range
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Get the next business day after a given date
 */
export function getNextBusinessDay(date: Date, holidays: Date[] = []): Date {
  return addBusinessDays(date, 1, holidays);
}

/**
 * Get the previous business day before a given date
 */
export function getPreviousBusinessDay(date: Date, holidays: Date[] = []): Date {
  return subtractBusinessDays(date, 1, holidays);
}

/**
 * SINGLE SOURCE OF TRUTH - Date Normalization
 * All date normalization throughout the app MUST use these functions
 */

/**
 * Normalize date to midnight for consistent comparison
 * THE authoritative date normalization used everywhere
 */
export function normalizeToMidnight(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Normalize date to end of day (23:59:59.999) for range comparisons
 * THE authoritative end-of-day normalization used everywhere
 */
export function normalizeToEndOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

/**
 * SINGLE SOURCE OF TRUTH - Date Validation
 * All date validation throughout the app MUST use these functions
 */

/**
 * Check if a date is valid
 * THE authoritative date validation used everywhere
 */
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Check if a date is a business day (Monday-Friday, excluding holidays)
 * THE authoritative business day check used everywhere
 */
export function isBusinessDay(date: Date, holidays: Date[] = []): boolean {
  if (!isValidDate(date)) return false;
  
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  
  if (isWeekend) return false;
  
  // Check if it's a holiday
  const normalizedDate = normalizeToMidnight(date);
  return !holidays.some(holiday => 
    normalizeToMidnight(holiday).getTime() === normalizedDate.getTime()
  );
}

/**
 * Check if a time falls within typical business hours
 * THE authoritative business hours check used everywhere
 */
export function isBusinessHour(date: Date, startHour: number = 9, endHour: number = 17): boolean {
  if (!isValidDate(date)) return false;
  
  const hour = date.getHours();
  return hour >= startHour && hour < endHour;
}

/**
 * Check if a date falls within a working day based on settings
 * THE authoritative working day check used everywhere
 */
export function isWorkingDay(date: Date, settings: any, holidays: Date[] = []): boolean {
  if (!isValidDate(date) || !settings?.weeklyWorkHours) return false;
  
  // Check if it's a holiday first
  const normalizedDate = normalizeToMidnight(date);
  const isHoliday = holidays.some(holiday =>
    normalizeToMidnight(holiday).getTime() === normalizedDate.getTime()
  );
  
  if (isHoliday) return false;
  
  // Check if the day has any work slots defined
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];
  const workSlots = settings.weeklyWorkHours[dayName] || [];
  
  return Array.isArray(workSlots) && 
         workSlots.reduce((total, slot) => total + (slot.duration || 0), 0) > 0;
}

/**
 * SINGLE SOURCE OF TRUTH - Timeline Date Operations
 * All timeline date operations MUST use these functions
 */

/**
 * Check if a date is today
 * THE authoritative today check used everywhere
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Check if today falls within a week range
 * THE authoritative week-today check used everywhere
 */
export function isTodayInWeek(weekStart: Date): boolean {
  const today = new Date();
  const weekEnd = addDays(weekStart, 6);
  return today >= weekStart && today <= weekEnd;
}

/**
 * Check if a date is weekend (Saturday or Sunday)
 * THE authoritative weekend check used everywhere
 */
export function isWeekendDate(date: Date): boolean {
  return isWeekend(date);
}

/**
 * Get week end date from week start
 * THE authoritative week end calculation used everywhere
 */
export function getWeekEndDate(weekStart: Date): Date {
  return addDays(weekStart, 6);
}

/**
 * Format week date range (e.g., "4 - 11")
 * THE authoritative week range formatting used everywhere
 */
export function formatWeekDateRange(weekStart: Date): string {
  const weekEnd = getWeekEndDate(weekStart);
  const startDate = weekStart.getDate();
  const endDate = weekEnd.getDate();
  return `${startDate} - ${endDate}`;
}

/**
 * Get day of week for a date (0 = Sunday, 6 = Saturday)
 * Pure calculation function for date operations
 */
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Get day name from date
 * Pure calculation function returning day names array index
 */
export function getDayName(date: Date): string {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayNames[date.getDay()];
}

/**
 * Generate date range between two dates
 * Pure calculation function for date iteration
 */
export function generateDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Check if date matches any date in array
 * Pure calculation function for date matching
 */
export function isDateInArray(targetDate: Date, dates: Date[]): boolean {
  return dates.some(date => targetDate.toDateString() === date.toDateString());
}

/**
 * Group dates by month for timeline display
 * Pure calculation function following single source of truth pattern
 */
export function groupDatesByMonth(dates: Date[]): Array<{
  monthName: string;
  startIndex: number;
  endIndex: number;
}> {
  const monthGroups: Array<{
    monthName: string;
    startIndex: number;
    endIndex: number;
  }> = [];
  let currentMonth = -1;
  let currentYear = -1;
  
  dates.forEach((date, index) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    if (month !== currentMonth || year !== currentYear) {
      // End the previous month group
      if (monthGroups.length > 0) {
        monthGroups[monthGroups.length - 1].endIndex = index - 1;
      }
      
      // Start a new month group
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = `${monthNames[month]} ${year}`;
      
      monthGroups.push({
        monthName,
        startIndex: index,
        endIndex: dates.length - 1 // Will be updated when next month starts
      });
      
      currentMonth = month;
      currentYear = year;
    }
  });
  
  return monthGroups;
}

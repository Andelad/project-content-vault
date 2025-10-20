// Centralized Date Formatting Utilities
// Single source of truth for all date formatting in the application

// APPLICATION-WIDE LOCALE SETTING
export const APP_LOCALE = 'en-GB';

// Common date format options
const DATE_FORMAT_OPTIONS = {
  shortMonth: { month: 'short' as const },
  longMonth: { month: 'long' as const },
  dayOnly: { day: 'numeric' as const },
  monthDay: { month: 'short' as const, day: 'numeric' as const },
  monthDayYear: { month: 'short' as const, day: 'numeric' as const, year: 'numeric' as const },
  fullDate: { weekday: 'long' as const, year: 'numeric' as const, month: 'long' as const, day: 'numeric' as const },
  weekdayShort: { weekday: 'short' as const, month: 'short' as const, day: 'numeric' as const },
  monthYear: { month: 'short' as const, year: 'numeric' as const },
  monthLongYear: { month: 'long' as const, year: 'numeric' as const },
  yearOnly: { year: 'numeric' as const },
  monthYearShort: { month: 'short' as const, year: '2-digit' as const }
};

// Primary date formatting functions
export const formatDate = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.monthDay);
};

export const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Specific date formatting functions for different use cases
export const formatDateShort = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.monthDay);
};

export const formatDateLong = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.fullDate);
};

export const formatDateWithYear = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.monthDayYear);
};

export const formatMonthYear = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.monthYear);
};

export const formatMonthLongYear = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.monthLongYear);
};

export const formatWeekdayDate = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.weekdayShort);
};

export const formatMonth = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.shortMonth);
};

export const formatMonthLong = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.longMonth);
};

export const formatDay = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.dayOnly);
};

// Date range formatting
export const formatDateRange = (startDate: Date, endDate: Date) => {
  const startFormatted = startDate.toLocaleDateString(APP_LOCALE, { 
    day: 'numeric', 
    month: 'short' 
  });
  const endFormatted = endDate.toLocaleDateString(APP_LOCALE, { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });
  
  return `${startFormatted} - ${endFormatted}`;
};

// Project date range formatting
export const formatProjectDateRange = (startDate: Date, endDate: Date, isContinuous = false) => {
  const startFormatted = startDate.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.monthDay);
  
  if (isContinuous) {
    return `${startFormatted} - ongoing`;
  }

  // If same year, don't repeat year
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  const endFormatted = endDate.toLocaleDateString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: startYear === endYear ? undefined : 'numeric'
  });

  return `${startFormatted} - ${endFormatted}`;
};

// Chart/Analysis specific formatting
export const formatChartDate = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.monthYearShort);
};

export const formatTooltipDate = (date: Date) => {
  return date.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.weekdayShort);
};

// Date comparison utilities
export const isSameDate = (date1: Date, date2: Date): boolean => {
  return date1.toDateString() === date2.toDateString();
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return isSameDate(date1, date2);
};

// Date key utilities (timezone-safe)
/**
 * Convert a date to a timezone-safe date key in format 'YYYY-MM-DD'
 * 
 * CRITICAL: This function is timezone-safe and prevents the common bug where
 * using .toISOString().split('T')[0] shifts dates by timezone offset.
 * 
 * Example bug scenario (UTC-8 timezone):
 * - Event on Oct 14th at 2pm local
 * - new Date("2024-10-14T14:00:00").toISOString() → "2024-10-13T22:00:00Z"
 * - .split('T')[0] → "2024-10-13" ❌ WRONG DATE!
 * 
 * This function uses local date components to construct the key, avoiding timezone issues.
 * 
 * @param date - The date to convert to a key
 * @returns Date key in format 'YYYY-MM-DD' (e.g., '2024-10-14')
 */
export const getDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Time range formatting
export const formatTimeRange = (startDate: Date, endDate: Date): string => {
  const startFormatted = startDate.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.monthDay);
  const endFormatted = endDate.toLocaleDateString(APP_LOCALE, DATE_FORMAT_OPTIONS.monthDay);
  return `${startFormatted} - ${endFormatted}`;
};

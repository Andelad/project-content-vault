/**
 * Date and Time Calculation Service
 * Centralizes all date/time math to eliminate duplication
 */

import { addDays, subDays, differenceInDays, startOfWeek, endOfWeek, isWeekend } from 'date-fns';

export class DateCalculationService {
  // Date caching for performance
  private static dateCache = new Map<string, Date>();
  
  /**
   * Get cached date instance to avoid repeated parsing
   */
  static getCachedDate(dateString: string): Date {
    if (!this.dateCache.has(dateString)) {
      this.dateCache.set(dateString, new Date(dateString));
    }
    return this.dateCache.get(dateString)!;
  }

  /**
   * Calculate business days between two dates
   */
  static getBusinessDaysBetween(startDate: Date, endDate: Date, holidays: Date[] = []): number {
    let businessDays = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      if (!isWeekend(current) && !this.isHoliday(current, holidays)) {
        businessDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return businessDays;
  }

  /**
   * Get all business days in a date range
   */
  static getBusinessDaysInRange(startDate: Date, endDate: Date, holidays: Date[] = []): Date[] {
    const businessDays: Date[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      if (!isWeekend(current) && !this.isHoliday(current, holidays)) {
        businessDays.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    
    return businessDays;
  }

  /**
   * Check if a date falls on a holiday
   */
  static isHoliday(date: Date, holidays: Date[]): boolean {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.some(holiday => 
      holiday.toISOString().split('T')[0] === dateStr
    );
  }

  /**
   * Calculate working days in a specific week
   */
  static getWorkingDaysInWeek(weekStart: Date, holidays: Date[] = []): Date[] {
    const weekEnd = endOfWeek(weekStart);
    return this.getBusinessDaysInRange(weekStart, weekEnd, holidays);
  }

  /**
   * Get date range visible in timeline viewport
   */
  static getTimelineViewport(currentDate: Date, mode: 'days' | 'weeks', count: number): { start: Date; end: Date } {
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
  static isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Calculate overlap between two date ranges
   */
  static getDateRangeOverlap(
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
}

/**
 * Date and Time Calculation Service (UPDATED)
 * 
 * Now properly separated into pure calculations and cached infrastructure.
 * This service provides the existing API while delegating to the new structure.
 * 
 * ✅ Backward compatibility maintained
 * ✅ Delegates to pure calculations and caching infrastructure
 * ✅ Easy migration path for existing code
 */

import { CachedDateCalculationService } from './dateCache';
import * as DateCalculations from '../calculations/general/dateCalculations';

export class DateCalculationService {
  /**
   * Get cached date instance to avoid repeated parsing
   * @deprecated Use CachedDateCalculationService.getCachedDate() instead
   */
  static getCachedDate(dateString: string): Date {
    return CachedDateCalculationService.getCachedDate(dateString);
  }

  /**
   * Calculate business days between two dates
   * @deprecated Use DateCalculations.calculateBusinessDaysBetween() for pure calculation or CachedDateCalculationService.getBusinessDaysBetween() for cached
   */
  static getBusinessDaysBetween(startDate: Date, endDate: Date, holidays: Date[] = []): number {
    return CachedDateCalculationService.getBusinessDaysBetween(startDate, endDate, holidays);
  }

  /**
   * Get all business days in a date range
   * @deprecated Use DateCalculations.calculateBusinessDaysInRange() for pure calculation or CachedDateCalculationService.getBusinessDaysInRange() for cached
   */
  static getBusinessDaysInRange(startDate: Date, endDate: Date, holidays: Date[] = []): Date[] {
    return CachedDateCalculationService.getBusinessDaysInRange(startDate, endDate, holidays);
  }

  /**
   * Check if a date falls on a holiday
   * @deprecated Use DateCalculations.isHoliday() for pure calculation or CachedDateCalculationService.isHoliday() for cached
   */
  static isHoliday(date: Date, holidays: Date[]): boolean {
    return CachedDateCalculationService.isHoliday(date, holidays);
  }

  /**
   * Calculate working days in a specific week
   * @deprecated Use DateCalculations.calculateWorkingDaysInWeek() instead
   */
  static getWorkingDaysInWeek(weekStart: Date, holidays: Date[] = []): Date[] {
    return DateCalculations.calculateWorkingDaysInWeek(weekStart, holidays);
  }

  /**
   * Get date range visible in timeline viewport
   * @deprecated Use DateCalculations.calculateTimelineViewport() for pure calculation or CachedDateCalculationService.getTimelineViewport() for cached
   */
  static getTimelineViewport(currentDate: Date, mode: 'days' | 'weeks', count: number): { start: Date; end: Date } {
    return CachedDateCalculationService.getTimelineViewport(currentDate, mode, count);
  }
}

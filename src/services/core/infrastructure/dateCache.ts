/**
 * Date Cache Infrastructure
 * 
 * Handles caching and performance optimizations for date operations.
 * This is infrastructure concern - separate from pure calculations.
 * 
 * ✅ Handles caching and performance
 * ✅ Manages side effects
 * ✅ Can be mocked for testing
 */

import * as DateCalculations from '../calculations/dateCalculations';

export class DateCache {
  private static dateCache = new Map<string, Date>();
  private static calculationCache = new Map<string, any>();

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
   * Clear date cache (for testing or memory management)
   */
  static clearDateCache(): void {
    this.dateCache.clear();
  }

  /**
   * Get cached calculation result
   */
  static getCachedCalculation<T>(key: string): T | undefined {
    return this.calculationCache.get(key);
  }

  /**
   * Set cached calculation result
   */
  static setCachedCalculation<T>(key: string, result: T): void {
    this.calculationCache.set(key, result);
  }

  /**
   * Clear calculation cache
   */
  static clearCalculationCache(): void {
    this.calculationCache.clear();
  }

  /**
   * Clear all caches
   */
  static clearAllCaches(): void {
    this.clearDateCache();
    this.clearCalculationCache();
  }
}

/**
 * Cached Date Calculation Service
 * 
 * Wraps pure date calculations with caching for performance.
 * Uses pure calculations internally but adds caching layer.
 */
export class CachedDateCalculationService {
  /**
   * Calculate business days between dates with caching
   */
  static getBusinessDaysBetween(startDate: Date, endDate: Date, holidays: Date[] = []): number {
    const cacheKey = `businessDays_${startDate.toISOString()}_${endDate.toISOString()}_${holidays.length}`;
    
    let result = DateCache.getCachedCalculation<number>(cacheKey);
    if (result === undefined) {
      result = DateCalculations.calculateBusinessDaysBetween(startDate, endDate, holidays);
      DateCache.setCachedCalculation(cacheKey, result);
    }
    
    return result;
  }

  /**
   * Get business days in range with caching
   */
  static getBusinessDaysInRange(startDate: Date, endDate: Date, holidays: Date[] = []): Date[] {
    const cacheKey = `businessDaysRange_${startDate.toISOString()}_${endDate.toISOString()}_${holidays.length}`;
    
    let result = DateCache.getCachedCalculation<Date[]>(cacheKey);
    if (result === undefined) {
      result = DateCalculations.calculateBusinessDaysInRange(startDate, endDate, holidays);
      DateCache.setCachedCalculation(cacheKey, result);
    }
    
    return result;
  }

  /**
   * Get timeline viewport with caching
   */
  static getTimelineViewport(currentDate: Date, mode: 'days' | 'weeks', count: number): { start: Date; end: Date } {
    const cacheKey = `viewport_${currentDate.toISOString()}_${mode}_${count}`;
    
    let result = DateCache.getCachedCalculation<{ start: Date; end: Date }>(cacheKey);
    if (result === undefined) {
      result = DateCalculations.calculateTimelineViewport(currentDate, mode, count);
      DateCache.setCachedCalculation(cacheKey, result);
    }
    
    return result;
  }

  /**
   * Check if date is holiday with caching
   */
  static isHoliday(date: Date, holidays: Date[]): boolean {
    const cacheKey = `holiday_${date.toISOString()}_${holidays.length}`;
    
    let result = DateCache.getCachedCalculation<boolean>(cacheKey);
    if (result === undefined) {
      result = DateCalculations.isHoliday(date, holidays);
      DateCache.setCachedCalculation(cacheKey, result);
    }
    
    return result;
  }

  /**
   * Get cached date instance
   */
  static getCachedDate(dateString: string): Date {
    return DateCache.getCachedDate(dateString);
  }

  // Expose all pure calculation methods for direct access when caching isn't needed
  static readonly pure = DateCalculations;
}

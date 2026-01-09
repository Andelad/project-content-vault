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

import * as DateCalculations from '@/presentation/utils/dateCalculations';
import type { Holiday, Settings, WorkSlot } from '@/shared/types/core';

interface CacheStats {
  hits: number;
  misses: number;
  checks: number;
}

export class DateCache {
  private static dateCache = new Map<string, Date>();
  private static calculationCache = new Map<string, unknown>();
  private static workingDayCache = new Map<string, boolean>();
  private static cacheStats: CacheStats = { hits: 0, misses: 0, checks: 0 };

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
    return this.calculationCache.get(key) as T | undefined;
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

/**
 * Working Day Cache Service
 * Handles caching specifically for working day calculations
 */
export class WorkingDayCache {
  private static workingDayCache = new Map<string, boolean>();
  private static cacheStats: CacheStats = { hits: 0, misses: 0, checks: 0 };

  private static ensureWeeklyWorkHours(weeklyWorkHours: Settings['weeklyWorkHours']): Settings['weeklyWorkHours'] {
    const days: (keyof Settings['weeklyWorkHours'])[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days.reduce((acc, day) => {
      acc[day] = weeklyWorkHours?.[day] ?? [];
      return acc;
    }, {} as Settings['weeklyWorkHours']);
  }

  /**
   * Generate cache key for working day calculations
   */
  static generateWorkingDayKey(
    date: Date,
    settingsHash: string,
    holidaysHash: string
  ): string {
    const dateKey = date.toDateString();
    return `${dateKey}-${settingsHash}-${holidaysHash}`;
  }

  /**
   * Create hash from work schedule settings
   */
  static hashSettings(weeklyWorkHours: Settings['weeklyWorkHours']): string {
    const weekly = this.ensureWeeklyWorkHours(weeklyWorkHours);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days.map(day => {
      const slots = weekly?.[day as keyof Settings['weeklyWorkHours']] || [];
      return Array.isArray(slots)
        ? slots.reduce((sum: number, slot: WorkSlot) => sum + (slot.duration || 0), 0)
        : 0;
    }).join('-');
  }

  /**
   * Create hash from holidays list
   */
  static hashHolidays(holidays: Holiday[]): string {
    return holidays.map(h => h.id).sort().join(',');
  }

  /**
   * Cached working day checker - wraps existing logic with caching
   */
  static isWorkingDay(
    date: Date,
    weeklyWorkHours: Settings['weeklyWorkHours'],
    holidays: Holiday[],
    originalChecker?: (date: Date, weeklyWorkHours: Settings['weeklyWorkHours'], holidays: Holiday[]) => boolean
  ): boolean {
    this.cacheStats.checks++;

    const normalizedWeekly = this.ensureWeeklyWorkHours(weeklyWorkHours);
    const settingsHash = this.hashSettings(normalizedWeekly);
    const holidaysHash = this.hashHolidays(holidays);
    const cacheKey = this.generateWorkingDayKey(date, settingsHash, holidaysHash);

    if (this.workingDayCache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.workingDayCache.get(cacheKey)!;
    }

    this.cacheStats.misses++;

    const holidayDates = holidays.map(h => h.startDate);
  const settings = { weeklyWorkHours: normalizedWeekly } as Pick<Settings, 'weeklyWorkHours'>;

    // Use provided checker or fall back to DateCalculations
    const isWorking = originalChecker ? 
      originalChecker(date, normalizedWeekly, holidays) :
      DateCalculations.isWorkingDay(date, settings, holidayDates);

    this.workingDayCache.set(cacheKey, isWorking);

    // Auto-cleanup when cache gets too large
    if (this.workingDayCache.size > 5000) {
      const keysToDelete = Array.from(this.workingDayCache.keys()).slice(0, 1000);
      keysToDelete.forEach(key => this.workingDayCache.delete(key));
    }

    return isWorking;
  }

  /**
   * Create a hook-compatible cached working day checker
   */
  static createCachedWorkingDayChecker(
    weeklyWorkHours: Settings['weeklyWorkHours'],
    holidays: Holiday[],
    originalChecker?: (date: Date, weeklyWorkHours: Settings['weeklyWorkHours'], holidays: Holiday[]) => boolean
  ) {
    return (date: Date) => this.isWorkingDay(date, weeklyWorkHours, holidays, originalChecker);
  }

  /**
   * Get working day cache statistics
   */
  static getWorkingDayStats(): CacheStats {
    return { ...this.cacheStats };
  }

  /**
   * Clear working day cache (for testing or memory management)
   */
  static clearWorkingDayCache(): void {
    this.workingDayCache.clear();
    this.cacheStats = { hits: 0, misses: 0, checks: 0 };
  }
}

/**
 * Working Day Cache - Performance Optimization Layer
 *
 * Provides caching for working day calculations without changing
 * any existing business logic or service architecture.
 */

import * as React from 'react';

// Cache storage with automatic cleanup
const workingDayCache = new Map<string, boolean>();
let cacheStats = { hits: 0, misses: 0, checks: 0 };

/**
 * Generate cache key for working day calculations
 */
function generateCacheKey(
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
function hashSettings(weeklyWorkHours: any): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days.map(day => {
    const slots = weeklyWorkHours[day] || [];
    return Array.isArray(slots)
      ? slots.reduce((sum: number, slot: any) => sum + (slot.duration || 0), 0)
      : 0;
  }).join('-');
}

/**
 * Create hash from holidays list
 */
function hashHolidays(holidays: any[]): string {
  return holidays.map(h => h.id).sort().join(',');
}

/**
 * Cached working day checker - wraps existing logic with caching
 */
export function cachedIsWorkingDay(
  date: Date,
  weeklyWorkHours: any,
  holidays: any[],
  originalCalculation: (date: Date, weeklyWorkHours: any, holidays: any[]) => boolean
): boolean {
  cacheStats.checks++;

  // Generate cache key
  const settingsHash = hashSettings(weeklyWorkHours);
  const holidaysHash = hashHolidays(holidays);
  const cacheKey = generateCacheKey(date, settingsHash, holidaysHash);

  // Check cache first
  const cached = workingDayCache.get(cacheKey);
  if (cached !== undefined) {
    cacheStats.hits++;
    return cached;
  }

  // Cache miss - use original calculation
  cacheStats.misses++;
  const result = originalCalculation(date, weeklyWorkHours, holidays);

  // Store result and manage cache size
  workingDayCache.set(cacheKey, result);

  // Auto cleanup if cache gets too large
  if (workingDayCache.size > 1000) {
    const keys = Array.from(workingDayCache.keys());
    for (let i = 0; i < 200; i++) {
      workingDayCache.delete(keys[i]);
    }
  }

  return result;
}

/**
 * Performance monitoring utilities
 */
export const workingDayStats = {
  getStats: () => ({
    totalChecks: cacheStats.checks,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: cacheStats.checks > 0 ? (cacheStats.hits / cacheStats.checks * 100).toFixed(1) : '0',
    cacheSize: workingDayCache.size
  }),

  logStats: () => {
    if (cacheStats.checks > 0) {
      const stats = workingDayStats.getStats();
      console.log(`🗓️ Working Day Cache: ${stats.totalChecks} checks, ${stats.hitRate}% hit rate, ${stats.cacheSize} entries`);
    }
  },

  clear: () => {
    workingDayCache.clear();
    cacheStats = { hits: 0, misses: 0, checks: 0 };
  }
};

/**
 * React hook for timeline components
 * Provides cached working day checker with embedded business logic
 */
export function useCachedWorkingDayChecker(
  weeklyWorkHours: any,
  holidays: any[]
) {
  return React.useCallback((date: Date) => {
    return cachedIsWorkingDay(
      date,
      weeklyWorkHours,
      holidays,
      // Embedded working day logic - no external dependencies
      (date: Date, weeklyWorkHours: any, holidays: any[]) => {
        // Normalize date to avoid time component issues
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        // Check holidays first (fastest rejection)
        const isHoliday = holidays.some(holiday => {
          const startDate = new Date(holiday.startDate);
          const endDate = new Date(holiday.endDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          return checkDate >= startDate && checkDate <= endDate;
        });

        if (isHoliday) return false;

        // Check work hours for this day of week
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[checkDate.getDay()];
        const workSlots = weeklyWorkHours[dayName] || [];

        // Sum total work hours for this day
        const totalHours = Array.isArray(workSlots)
          ? workSlots.reduce((sum: number, slot: any) => sum + (slot.duration || 0), 0)
          : 0;

        return totalHours > 0;
      }
    );
  }, [weeklyWorkHours, holidays]);
}

/**
 * Batch working day calculator for range operations
 */
export function cachedWorkingDayBatch(
  dates: Date[],
  weeklyWorkHours: any,
  holidays: any[],
  originalCalculation: (date: Date, weeklyWorkHours: any, holidays: any[]) => boolean
): { date: Date; isWorkingDay: boolean }[] {
  const settingsHash = hashSettings(weeklyWorkHours);
  const holidaysHash = hashHolidays(holidays);

  return dates.map(date => {
    const cacheKey = generateCacheKey(date, settingsHash, holidaysHash);

    let isWorkingDay = workingDayCache.get(cacheKey);
    if (isWorkingDay === undefined) {
      isWorkingDay = originalCalculation(date, weeklyWorkHours, holidays);
      workingDayCache.set(cacheKey, isWorkingDay);
      cacheStats.misses++;
    } else {
      cacheStats.hits++;
    }
    cacheStats.checks++;

    return { date, isWorkingDay };
  });
}

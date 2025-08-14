import { PERFORMANCE_LIMITS } from '../constants';

// Memoization utilities for expensive calculations

interface MemoCache<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

class MemoizationCache<T> {
  private cache = new Map<string, MemoCache<T>>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = PERFORMANCE_LIMITS.MAX_CACHED_CALCULATIONS, ttl: number = 30000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access count for LRU
    cached.accessCount += 1;
    return cached.value;
  }

  set(key: string, value: T): void {
    // Clean up if cache is full
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used item
      let lruKey = '';
      let lruCount = Infinity;
      
      for (const [k, v] of this.cache.entries()) {
        if (v.accessCount < lruCount) {
          lruCount = v.accessCount;
          lruKey = k;
        }
      }
      
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global caches for different types of calculations
export const timelineCalculationCache = new MemoizationCache<any>(50, 10000); // 10 second TTL
export const dateCalculationCache = new MemoizationCache<any>(100, 30000);   // 30 second TTL
export const projectMetricsCache = new MemoizationCache<any>(200, 5000);      // 5 second TTL

// Memoization decorators
export function memoizeExpensiveCalculation<T extends (...args: any[]) => any>(
  fn: T,
  cache: MemoizationCache<ReturnType<T>>,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Specific memoized functions for common calculations
export const memoizedTimelinePositions = memoizeExpensiveCalculation(
  (startDate: Date, endDate: Date, viewportStart: Date, viewportEnd: Date, dates: Date[], mode: string) => {
    // Import and use the actual calculation function
    const { calculateTimelinePositions } = require('./timelinePositioning');
    return calculateTimelinePositions(startDate, endDate, viewportStart, viewportEnd, dates, mode);
  },
  timelineCalculationCache,
  (startDate, endDate, viewportStart, viewportEnd, dates, mode) => 
    `timeline-pos-${startDate.getTime()}-${endDate.getTime()}-${viewportStart.getTime()}-${viewportEnd.getTime()}-${dates.length}-${mode}`
);

export const memoizedProjectMetrics = memoizeExpensiveCalculation(
  (project: any, isWorkingDay: (date: Date) => boolean) => {
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    
    const workingDays = [];
    for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
      if (isWorkingDay(new Date(d))) {
        workingDays.push(new Date(d));
      }
    }
    
    const totalWorkingDays = workingDays.length;
    
    if (totalWorkingDays === 0) {
      return {
        exactDailyHours: 0,
        dailyHours: 0,
        dailyMinutes: 0,
        heightInPixels: 0,
        workingDaysCount: 0
      };
    }
    
    const exactHoursPerDay = project.estimatedHours / totalWorkingDays;
    const dailyHours = Math.floor(exactHoursPerDay);
    const dailyMinutes = Math.round((exactHoursPerDay - dailyHours) * 60);
    const heightInPixels = Math.max(3, Math.min(32, Math.round(exactHoursPerDay * 2)));
    
    return {
      exactDailyHours: exactHoursPerDay,
      dailyHours,
      dailyMinutes,
      heightInPixels,
      workingDaysCount: totalWorkingDays
    };
  },
  projectMetricsCache,
  (project, _) => `project-metrics-${project.id}-${project.estimatedHours}-${project.startDate.getTime()}-${project.endDate.getTime()}`
);

// Cache cleanup utility
export function cleanupMemoizationCaches(): void {
  timelineCalculationCache.clear();
  dateCalculationCache.clear();
  projectMetricsCache.clear();
}

// Performance monitoring for cache hit rates
export function getCacheStats() {
  return {
    timeline: {
      size: timelineCalculationCache.size(),
      maxSize: PERFORMANCE_LIMITS.MAX_CACHED_CALCULATIONS
    },
    dates: {
      size: dateCalculationCache.size(),
      maxSize: 100
    },
    projectMetrics: {
      size: projectMetricsCache.size(),
      maxSize: 200
    }
  };
}
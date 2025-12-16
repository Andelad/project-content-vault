/**
 * Cache performance calculation utilities
 * Extracted from DevTools for reusability and testing
 */
export interface CacheStats {
  timeline: { size: number; maxSize: number };
  dates: { size: number; maxSize: number };
  projectMetrics: { size: number; maxSize: number };
}
export interface CacheMetrics {
  hitRate: number;
  totalSize: number;
  maxSize: number;
  efficiency: number;
}
/**
 * Calculate cache hit rate as a percentage
 */
export function calculateCacheHitRate(stats: CacheStats): number {
  const total = stats.timeline.size + stats.dates.size + stats.projectMetrics.size;
  const max = stats.timeline.maxSize + stats.dates.maxSize + stats.projectMetrics.maxSize;
  return total > 0 ? (total / max) * 100 : 0;
}
/**
 * Calculate comprehensive cache metrics
 */
export function calculateCacheMetrics(stats: CacheStats): CacheMetrics {
  const totalSize = stats.timeline.size + stats.dates.size + stats.projectMetrics.size;
  const maxSize = stats.timeline.maxSize + stats.dates.maxSize + stats.projectMetrics.maxSize;
  const hitRate = calculateCacheHitRate(stats);
  // Efficiency: how well the cache space is being used
  const efficiency = maxSize > 0 ? (totalSize / maxSize) * 100 : 0;
  return {
    hitRate,
    totalSize,
    maxSize,
    efficiency
  };
}
/**
 * Analyze cache performance by category
 */
export function analyzeCachePerformance(stats: CacheStats): {
  timeline: { usage: number; efficiency: number };
  dates: { usage: number; efficiency: number };
  projectMetrics: { usage: number; efficiency: number };
  overall: CacheMetrics;
} {
  const calculateCategoryMetrics = (category: { size: number; maxSize: number }) => ({
    usage: category.maxSize > 0 ? (category.size / category.maxSize) * 100 : 0,
    efficiency: category.size > 0 ? Math.min(100, (category.size / Math.max(category.maxSize, 1)) * 100) : 0
  });
  return {
    timeline: calculateCategoryMetrics(stats.timeline),
    dates: calculateCategoryMetrics(stats.dates),
    projectMetrics: calculateCategoryMetrics(stats.projectMetrics),
    overall: calculateCacheMetrics(stats)
  };
}
/**
 * Generate cache performance recommendations
 */
export function generateCacheRecommendations(stats: CacheStats): string[] {
  const metrics = calculateCacheMetrics(stats);
  const recommendations: string[] = [];
  if (metrics.hitRate < 50) {
    recommendations.push('Cache hit rate is low - consider increasing cache size');
  }
  if (metrics.efficiency > 90) {
    recommendations.push('Cache is near capacity - consider clearing or expanding');
  }
  if (stats.timeline.size === 0 && stats.dates.size === 0 && stats.projectMetrics.size === 0) {
    recommendations.push('All caches are empty - performance may be impacted');
  }
  if (metrics.efficiency < 30 && metrics.totalSize > 0) {
    recommendations.push('Cache efficiency is low - some cache categories may be underutilized');
  }
  return recommendations;
}
// =====================================================================================
// MEMOIZATION UTILITIES
// =====================================================================================
/**
 * Interface for memo cache entries
 */
interface MemoCache<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}
/**
 * Memoization cache class with LRU eviction and TTL
 */
class MemoizationCache<T> {
  private cache = new Map<string, MemoCache<T>>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds
  constructor(maxSize: number = 500, ttl: number = 30000) {
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
  getMaxSize(): number {
    return this.maxSize;
  }
}
// Global caches for different types of calculations
export const timelineCalculationCache = new MemoizationCache<unknown>(500, 30000);
export const dateCalculationCache = new MemoizationCache<unknown>(200, 30000);
export const projectMetricsCache = new MemoizationCache<unknown>(300, 30000);
/**
 * Memoization decorator for expensive calculations
 */
export function memoizeExpensiveCalculation<T extends (...args: unknown[]) => unknown>(
  fn: T,
  cache: MemoizationCache<ReturnType<T>>,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  let hitCount = 0;
  let missCount = 0;
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    const cached = cache.get(key);
    if (cached !== undefined) {
      hitCount++;
      if (process.env.NODE_ENV === 'development' && (hitCount + missCount) % 100 === 0) {
        console.debug('[Cache] hit ratio', {
          hitCount,
          missCount,
          hitRate: `${((hitCount / Math.max(hitCount + missCount, 1)) * 100).toFixed(1)}%`
        });
      }
      return cached;
    }
    missCount++;
    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
}
/**
 * Cache cleanup utility
 */
export function cleanupMemoizationCaches(): void {
  timelineCalculationCache.clear();
  dateCalculationCache.clear();
  projectMetricsCache.clear();
}
/**
 * Get comprehensive cache statistics
 */
export function getCacheStats(): CacheStats {
  return {
    timeline: {
      size: timelineCalculationCache.size(),
      maxSize: timelineCalculationCache.getMaxSize()
    },
    dates: {
      size: dateCalculationCache.size(),
      maxSize: dateCalculationCache.getMaxSize()
    },
    projectMetrics: {
      size: projectMetricsCache.size(),
      maxSize: projectMetricsCache.getMaxSize()
    }
  };
}

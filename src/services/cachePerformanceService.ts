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

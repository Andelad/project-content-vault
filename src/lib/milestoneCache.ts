/**
 * Milestone Cache - Performance Optimization Layer
 *
 * Provides caching for milestone calculations without changing
 * any existing business logic or service architecture.
 */

// Cache storage with automatic cleanup
const milestoneCache = new Map<string, any>();
let cacheStats = { hits: 0, misses: 0, checks: 0 };

/**
 * Generate cache key for milestone calculations
 */
function generateMilestoneCacheKey(
  milestoneId: string,
  projectId: string,
  additionalParams: string
): string {
  return `milestone-${milestoneId}-${projectId}-${additionalParams}`;
}

/**
 * Create hash from milestone-relevant parameters
 */
function hashMilestoneParams(
  milestone: any,
  project: any,
  settings: any,
  holidays: any[],
  workHours: any[],
  events: any[]
): string {
  // Create a hash based on parameters that affect milestone calculations
  const milestoneHash = milestone ? `${milestone.id}-${milestone.targetDate}-${milestone.estimatedHours}-${milestone.completionDate || 'null'}` : 'null';
  const projectHash = project ? `${project.id}-${project.startDate}-${project.endDate}-${project.estimatedHours}` : 'null';

  // Settings that might affect milestone calculations
  const settingsHash = settings?.weeklyWorkHours ?
    Object.keys(settings.weeklyWorkHours).map(day => {
      const slots = settings.weeklyWorkHours[day] || [];
      return Array.isArray(slots)
        ? slots.reduce((sum: number, slot: any) => sum + (slot.duration || 0), 0)
        : 0;
    }).join('-') : 'nosettings';

  // Holidays that might affect calculations
  const holidaysHash = holidays?.length ?
    holidays.map(h => `${h.id}-${h.startDate}-${h.endDate}`).sort().join(',') : 'noholidays';

  // Work hours - create a more specific hash based on content
  const workHoursHash = workHours?.length ? 
    workHours.map(wh => `${wh.date}-${wh.duration}-${wh.startTime}-${wh.endTime}`).sort().join('|') : 'noworkhours';

  // Events - create a more specific hash based on relevant event properties
  const eventsHash = events?.length ? 
    events.map(ev => `${ev.id}-${ev.startTime}-${ev.endTime}-${ev.duration || 0}-${ev.completed || false}`).sort().join('|') : 'noevents';

  return `${milestoneHash}|${projectHash}|${settingsHash}|${holidaysHash}|${workHoursHash}|${eventsHash}`;
}

/**
 * Cached milestone calculation wrapper
 */
export function cachedMilestoneCalculation<T>(
  milestoneId: string,
  projectId: string,
  milestone: any,
  project: any,
  settings: any,
  holidays: any[],
  workHours: any[],
  events: any[],
  originalCalculation: () => T
): T {
  cacheStats.checks++;

  // Generate cache key based on all parameters that affect the calculation
  const paramsHash = hashMilestoneParams(milestone, project, settings, holidays, workHours, events);
  const cacheKey = generateMilestoneCacheKey(milestoneId, projectId, paramsHash);

  // Check cache first
  const cached = milestoneCache.get(cacheKey);
  if (cached !== undefined) {
    cacheStats.hits++;
    const hitRate = cacheStats.checks > 0 ? (cacheStats.hits / cacheStats.checks * 100).toFixed(1) : '0';
    console.log(`🎯 Milestone Cache HIT: ${milestoneId} for project ${projectId} (${hitRate}% hit rate)`);
    return cached;
  }

  // Cache miss - perform original calculation
  cacheStats.misses++;
  const hitRate = cacheStats.checks > 0 ? (cacheStats.hits / cacheStats.checks * 100).toFixed(1) : '0';
  console.log(`🎯 Milestone Cache MISS: ${milestoneId} for project ${projectId} (${hitRate}% hit rate)`);
  const result = originalCalculation();

  // Store result and manage cache size
  milestoneCache.set(cacheKey, result);

  // Auto cleanup if cache gets too large
  if (milestoneCache.size > 2000) {
    const keys = Array.from(milestoneCache.keys());
    // Remove oldest 400 entries
    for (let i = 0; i < 400; i++) {
      milestoneCache.delete(keys[i]);
    }
  }

  return result;
}

/**
 * Performance monitoring utilities
 */
export const milestoneStats = {
  getStats: () => ({
    totalChecks: cacheStats.checks,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: cacheStats.checks > 0 ? (cacheStats.hits / cacheStats.checks * 100).toFixed(1) : '0',
    cacheSize: milestoneCache.size
  }),

  logStats: () => {
    if (cacheStats.checks > 0) {
      const stats = milestoneStats.getStats();
      console.log(`🎯 Milestone Cache Stats: ${stats.totalChecks} calculations, ${stats.hitRate}% hit rate, ${stats.cacheSize} entries`);
    } else {
      console.log(`🎯 Milestone Cache: No calculations performed yet`);
    }
  },

  clear: () => {
    milestoneCache.clear();
    cacheStats = { hits: 0, misses: 0, checks: 0 };
    console.log('🎯 Milestone Cache cleared');
  },

  /**
   * Invalidate cache entries for a specific project
   */
  invalidateProject: (projectId: string) => {
    const keysToDelete: string[] = [];
    for (const [key] of milestoneCache) {
      if (key.includes(projectId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => milestoneCache.delete(key));
    console.log(`🎯 Milestone Cache: Invalidated ${keysToDelete.length} entries for project ${projectId}`);
  }
};

/**
 * Utility to wrap existing milestone calculation functions
 */
export function withMilestoneCache<T extends (...args: any[]) => any>(
  originalFunction: T,
  getKeyParams: (...args: Parameters<T>) => { milestoneId: string; projectId: string; milestone: any; project: any; settings: any; holidays: any[]; workHours: any[]; events: any[] }
): T {
  return ((...args: Parameters<T>) => {
    const keyParams = getKeyParams(...args);

    return cachedMilestoneCalculation(
      keyParams.milestoneId,
      keyParams.projectId,
      keyParams.milestone,
      keyParams.project,
      keyParams.settings,
      keyParams.holidays,
      keyParams.workHours,
      keyParams.events,
      () => originalFunction(...args)
    );
  }) as T;
}

// Expose cache stats globally for debugging
if (typeof window !== 'undefined') {
  (window as any).milestoneCacheStats = milestoneStats;
  (window as any).milestoneCache = {
    stats: milestoneStats,
    invalidateProject: milestoneStats.invalidateProject,
    clear: milestoneStats.clear
  };
}

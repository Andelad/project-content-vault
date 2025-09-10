/**
 * Performance-Optimized Calculation Cache Service
 * Prevents expensive recalculations and improves app performance
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  name: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  checks: number;
}

export class CalculationCacheService {
  private static caches = new Map<string, Map<string, CacheEntry<any>>>();
  private static configs = new Map<string, CacheConfig>();

  /**
   * Initialize a cache with specific configuration
   */
  static initializeCache(cacheName: string, config: CacheConfig): void {
    this.caches.set(cacheName, new Map());
    this.configs.set(cacheName, config);
  }

  /**
   * Get cached calculation result
   */
  static get<T>(cacheName: string, key: string): T | null {
    const cache = this.caches.get(cacheName);
    const config = this.configs.get(cacheName);
    
    if (!cache || !config) {
      console.warn(`Cache ${cacheName} not initialized`);
      return null;
    }

    const entry = cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    if (now - entry.timestamp > config.ttl) {
      cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;
    
    return entry.value;
  }

  /**
   * Store calculation result in cache
   */
  static set<T>(cacheName: string, key: string, value: T): void {
    const cache = this.caches.get(cacheName);
    const config = this.configs.get(cacheName);
    
    if (!cache || !config) {
      console.warn(`Cache ${cacheName} not initialized`);
      return;
    }

    // Evict old entries if cache is full
    if (cache.size >= config.maxSize) {
      this.evictLeastUsed(cache, Math.floor(config.maxSize * 0.1));
    }

    cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Memoized calculation wrapper
   */
  static memoize<Args extends any[], Return>(
    cacheName: string,
    fn: (...args: Args) => Return,
    keyGenerator?: (...args: Args) => string
  ): (...args: Args) => Return {
    return (...args: Args): Return => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      let result = this.get<Return>(cacheName, key);
      
      if (result === null) {
        result = fn(...args);
        this.set(cacheName, key, result);
      }
      
      return result;
    };
  }

  /**
   * Clear specific cache
   */
  static clearCache(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.clear();
    }
  }

  /**
   * Clear all caches
   */
  static clearAllCaches(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(cacheName: string): {
    size: number;
    hitRate: number;
    config: CacheConfig;
  } | null {
    const cache = this.caches.get(cacheName);
    const config = this.configs.get(cacheName);
    
    if (!cache || !config) {
      return null;
    }

    let totalHits = 0;
    let totalAccesses = 0;
    
    for (const entry of cache.values()) {
      totalHits += entry.hits;
      totalAccesses += entry.hits + 1; // +1 for initial set
    }

    return {
      size: cache.size,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
      config
    };
  }

  /**
   * Evict least recently used entries
   */
  private static evictLeastUsed(cache: Map<string, CacheEntry<any>>, count: number): void {
    const entries = Array.from(cache.entries());
    
    // Sort by hits ascending (least used first)
    entries.sort((a, b) => a[1].hits - b[1].hits);
    
    for (let i = 0; i < count && i < entries.length; i++) {
      cache.delete(entries[i][0]);
    }
  }

  /**
   * Initialize default caches for the application
   */
  static initializeDefaultCaches(): void {
    // Project calculations cache
    this.initializeCache('projectCalculations', {
      maxSize: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes
      name: 'Project Calculations'
    });

    // Timeline position cache
    this.initializeCache('timelinePositions', {
      maxSize: 2000,
      ttl: 2 * 60 * 1000, // 2 minutes
      name: 'Timeline Positions'
    });

    // Date calculations cache
    this.initializeCache('dateCalculations', {
      maxSize: 500,
      ttl: 10 * 60 * 1000, // 10 minutes
      name: 'Date Calculations'
    });

    // Milestone calculations cache
    this.initializeCache('milestoneCalculations', {
      maxSize: 800,
      ttl: 3 * 60 * 1000, // 3 minutes
      name: 'Milestone Calculations'
    });
  }

  /**
   * Generate cache key for milestone calculations
   */
  static generateMilestoneCacheKey(
    milestoneId: string,
    projectId: string,
    additionalParams: string
  ): string {
    return `milestone-${milestoneId}-${projectId}-${additionalParams}`;
  }

  /**
   * Create hash from milestone-relevant parameters
   */
  static hashMilestoneParams(
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

    // Work hours that might affect calculations  
    const workHoursHash = workHours?.length ?
      workHours.map(wh => `${wh.id}-${wh.date}-${wh.duration}`).sort().join(',') : 'noworkhours';

    // Events that might affect calculations
    const eventsHash = events?.length ?
      events.map(e => `${e.id}-${e.startTime}-${e.endTime}`).sort().join(',') : 'noevents';

    return `${milestoneHash}|${projectHash}|${settingsHash}|${holidaysHash}|${workHoursHash}|${eventsHash}`;
  }

  /**
   * Get milestone cache statistics
   */
  static getMilestoneStats(): CacheStats {
    const cache = this.caches.get('milestoneCalculations');
    if (!cache) {
      return { hits: 0, misses: 0, checks: 0 };
    }

    let hits = 0;
    let totalChecks = 0;
    
    cache.forEach(entry => {
      hits += entry.hits;
      totalChecks += entry.hits + 1; // +1 for initial miss
    });

    return {
      hits,
      misses: totalChecks - hits,
      checks: totalChecks
    };
  }
}

// Initialize caches when module loads
CalculationCacheService.initializeDefaultCaches();

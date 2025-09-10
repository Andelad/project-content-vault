/**
 * Unified Repository Implementation
 * 
 * Base implementation providing standardized data access patterns with:
 * - Intelligent caching strategies for performance
 * - Offline-first capabilities with automatic sync
 * - Built-in validation integration
 * - Event-driven architecture for real-time updates
 * - Performance monitoring and optimization
 * 
 * @module UnifiedRepository
 */

import type {
  IBaseRepository,
  IRepositoryEventManager,
  RepositoryConfig,
  RepositoryEvent,
  CacheStats,
  OfflineChange,
  OfflineOperation,
  SyncResult
} from './IBaseRepository';

import { DEFAULT_REPOSITORY_CONFIG } from './IBaseRepository';

// =====================================================================================
// CACHE IMPLEMENTATION
// =====================================================================================

class LRUCache<T> {
  private cache = new Map<string, { value: T; timestamp: number; accessCount: number }>();
  private accessOrder = new Map<string, number>();
  private currentSize = 0;
  private accessCounter = 0;

  constructor(
    private maxSize: number,
    private ttl: number
  ) {}

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Check TTL
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key);
      return null;
    }
    
    // Update access tracking
    item.accessCount++;
    this.accessOrder.set(key, ++this.accessCounter);
    
    return item.value;
  }

  set(key: string, value: T): void {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.delete(key);
    }
    
    // Evict if at capacity
    if (this.currentSize >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }
    
    const item = {
      value,
      timestamp: Date.now(),
      accessCount: 1
    };
    
    this.cache.set(key, item);
    this.accessOrder.set(key, ++this.accessCounter);
    this.currentSize++;
  }

  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.accessOrder.delete(key);
      this.currentSize--;
    }
    return existed;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.currentSize = 0;
    this.accessCounter = 0;
  }

  size(): number {
    return this.currentSize;
  }

  getStats(): CacheStats {
    const now = Date.now();
    let totalRequests = 0;
    let hitCount = 0;
    
    // Simple hit rate calculation based on access counts
    for (const item of this.cache.values()) {
      totalRequests += item.accessCount;
      hitCount += item.accessCount - 1; // First access is always a miss
    }
    
    return {
      hitRate: totalRequests > 0 ? hitCount / totalRequests : 0,
      missRate: totalRequests > 0 ? (totalRequests - hitCount) / totalRequests : 0,
      totalRequests,
      cacheSize: this.currentSize,
      lastCleared: new Date(), // Simplified - would track actual clear time
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestAccess = Infinity;
    
    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private estimateMemoryUsage(): number {
    // Simplified memory estimation
    return this.currentSize * 1024; // Assume 1KB per cached item
  }
}

// =====================================================================================
// EVENT MANAGER IMPLEMENTATION
// =====================================================================================

class RepositoryEventManager<TEntity> implements IRepositoryEventManager<TEntity> {
  private listeners = new Map<string, Array<(event: RepositoryEvent<TEntity>) => void>>();

  on(eventType: RepositoryEvent<TEntity>['type'], handler: (event: RepositoryEvent<TEntity>) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);
  }

  off(eventType: RepositoryEvent<TEntity>['type'], handler: (event: RepositoryEvent<TEntity>) => void): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: RepositoryEvent<TEntity>): void {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Repository event handler error:', error);
        }
      });
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// =====================================================================================
// UNIFIED REPOSITORY IMPLEMENTATION
// =====================================================================================

export abstract class UnifiedRepository<TEntity, TKey = string> implements IBaseRepository<TEntity, TKey> {
  
  protected cache: LRUCache<TEntity>;
  protected eventManager: RepositoryEventManager<TEntity>;
  protected config: RepositoryConfig;
  protected offlineChanges: OfflineChange<TEntity>[] = [];
  private isOnline = true;

  constructor(
    protected entityType: string,
    config?: Partial<RepositoryConfig>
  ) {
    this.config = { ...DEFAULT_REPOSITORY_CONFIG, ...config };
    
    this.cache = new LRUCache<TEntity>(
      this.config.cache!.maxSize,
      this.config.cache!.ttl
    );
    
    this.eventManager = new RepositoryEventManager<TEntity>();
    
    // Setup online/offline detection
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        if (this.config.offline!.autoSync) {
          this.syncToServer().catch(error => 
            console.error('Auto-sync failed:', error)
          );
        }
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  // -------------------------------------------------------------------------------------
  // ABSTRACT METHODS - MUST BE IMPLEMENTED BY SUBCLASSES
  // -------------------------------------------------------------------------------------

  protected abstract executeCreate(entity: Omit<TEntity, 'id'>): Promise<TEntity>;
  protected abstract executeUpdate(id: TKey, updates: Partial<TEntity>): Promise<TEntity>;
  protected abstract executeDelete(id: TKey): Promise<boolean>;
  protected abstract executeFindById(id: TKey): Promise<TEntity | null>;
  protected abstract executeFindAll(): Promise<TEntity[]>;
  protected abstract executeFindBy(criteria: Partial<TEntity>): Promise<TEntity[]>;
  protected abstract executeCount(criteria?: Partial<TEntity>): Promise<number>;
  protected abstract executeSyncToServer(): Promise<SyncResult>;

  // -------------------------------------------------------------------------------------
  // PUBLIC API METHODS
  // -------------------------------------------------------------------------------------

  async findById(id: TKey): Promise<TEntity | null> {
    const cacheKey = `${this.entityType}:${id}`;
    
    // Try cache first
    if (this.config.cache!.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.logPerformance('cache-hit', { entityType: this.entityType, id });
        return cached;
      }
    }
    
    // Load from source
    const entity = await this.withErrorHandling(async () => {
      return await this.executeFindById(id);
    });
    
    // Cache if found
    if (entity && this.config.cache!.enabled) {
      this.cache.set(cacheKey, entity);
      this.logPerformance('cache-miss', { entityType: this.entityType, id });
    }
    
    return entity;
  }

  async findAll(): Promise<TEntity[]> {
    return await this.withErrorHandling(async () => {
      return await this.executeFindAll();
    });
  }

  async create(entity: Omit<TEntity, 'id'>): Promise<TEntity> {
    // Validate if enabled
    if (this.config.validation!.enabled && this.config.validation!.validateOnCreate) {
      await this.validateEntity(entity as Partial<TEntity>);
    }
    
    const created = await this.withErrorHandling(async () => {
      if (this.isOnline) {
        return await this.executeCreate(entity);
      } else {
        // Handle offline creation
        return await this.handleOfflineOperation('create', undefined, entity);
      }
    });
    
    // Cache the created entity
    if (this.config.cache!.enabled && created) {
      const cacheKey = `${this.entityType}:${(created as any).id}`;
      this.cache.set(cacheKey, created);
    }
    
    // Emit event
    this.eventManager.emit({
      type: 'created',
      entityType: this.entityType,
      entityId: (created as any).id,
      entity: created,
      timestamp: new Date()
    });
    
    return created;
  }

  async update(id: TKey, updates: Partial<TEntity>): Promise<TEntity> {
    // Validate if enabled
    if (this.config.validation!.enabled && this.config.validation!.validateOnUpdate) {
      await this.validateEntity(updates);
    }
    
    const updated = await this.withErrorHandling(async () => {
      if (this.isOnline) {
        return await this.executeUpdate(id, updates);
      } else {
        // Handle offline update
        return await this.handleOfflineOperation('update', id, updates);
      }
    });
    
    // Update cache
    if (this.config.cache!.enabled && updated) {
      const cacheKey = `${this.entityType}:${id}`;
      this.cache.set(cacheKey, updated);
    }
    
    // Emit event
    this.eventManager.emit({
      type: 'updated',
      entityType: this.entityType,
      entityId: String(id),
      entity: updated,
      timestamp: new Date()
    });
    
    return updated;
  }

  async delete(id: TKey): Promise<boolean> {
    const deleted = await this.withErrorHandling(async () => {
      if (this.isOnline) {
        return await this.executeDelete(id);
      } else {
        // Handle offline deletion
        await this.handleOfflineOperation('delete', id);
        return true;
      }
    });
    
    // Remove from cache
    if (this.config.cache!.enabled && deleted) {
      const cacheKey = `${this.entityType}:${id}`;
      this.cache.delete(cacheKey);
    }
    
    // Emit event
    if (deleted) {
      this.eventManager.emit({
        type: 'deleted',
        entityType: this.entityType,
        entityId: String(id),
        timestamp: new Date()
      });
    }
    
    return deleted;
  }

  async findBy(criteria: Partial<TEntity>): Promise<TEntity[]> {
    return await this.withErrorHandling(async () => {
      return await this.executeFindBy(criteria);
    });
  }

  async findOne(criteria: Partial<TEntity>): Promise<TEntity | null> {
    const results = await this.findBy(criteria);
    return results.length > 0 ? results[0] : null;
  }

  async count(criteria?: Partial<TEntity>): Promise<number> {
    return await this.withErrorHandling(async () => {
      return await this.executeCount(criteria);
    });
  }

  async exists(id: TKey): Promise<boolean> {
    const entity = await this.findById(id);
    return entity !== null;
  }

  // -------------------------------------------------------------------------------------
  // BATCH OPERATIONS
  // -------------------------------------------------------------------------------------

  async createMany(entities: Omit<TEntity, 'id'>[]): Promise<TEntity[]> {
    const batchSize = this.config.performance!.batchSize;
    const results: TEntity[] = [];
    
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      const batchPromises = batch.map(entity => this.create(entity));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  async updateMany(updates: Array<{ id: TKey; data: Partial<TEntity> }>): Promise<TEntity[]> {
    const batchSize = this.config.performance!.batchSize;
    const results: TEntity[] = [];
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const batchPromises = batch.map(update => this.update(update.id, update.data));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  async deleteMany(ids: TKey[]): Promise<boolean> {
    const batchSize = this.config.performance!.batchSize;
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchPromises = batch.map(id => this.delete(id));
      await Promise.all(batchPromises);
    }
    
    return true;
  }

  async upsert(entity: TEntity): Promise<TEntity> {
    const id = (entity as any).id;
    const exists = await this.exists(id);
    
    if (exists) {
      return await this.update(id, entity);
    } else {
      const { id: _, ...createData } = entity as any;
      return await this.create(createData);
    }
  }

  async bulkUpsert(entities: TEntity[]): Promise<TEntity[]> {
    const batchSize = this.config.performance!.batchSize;
    const results: TEntity[] = [];
    
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      const batchPromises = batch.map(entity => this.upsert(entity));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  // -------------------------------------------------------------------------------------
  // CACHE MANAGEMENT
  // -------------------------------------------------------------------------------------

  async clearCache(): Promise<void> {
    this.cache.clear();
    this.eventManager.emit({
      type: 'cache-cleared',
      entityType: this.entityType,
      entityId: 'all',
      timestamp: new Date()
    });
  }

  async preloadCache(ids?: TKey[]): Promise<void> {
    if (ids) {
      // Preload specific entities
      const promises = ids.map(id => this.findById(id));
      await Promise.all(promises);
    } else {
      // Preload all entities (use with caution)
      await this.findAll();
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    return this.cache.getStats();
  }

  // -------------------------------------------------------------------------------------
  // OFFLINE SUPPORT
  // -------------------------------------------------------------------------------------

  async getOfflineChanges(): Promise<OfflineChange<TEntity>[]> {
    return [...this.offlineChanges];
  }

  async syncToServer(): Promise<SyncResult> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    
    const result = await this.executeSyncToServer();
    
    // Clear synced changes
    if (result.success) {
      this.offlineChanges = this.offlineChanges.filter(change => !change.synced);
    }
    
    this.eventManager.emit({
      type: 'synced',
      entityType: this.entityType,
      entityId: 'all',
      timestamp: new Date(),
      metadata: { syncResult: result }
    });
    
    return result;
  }

  async markForOfflineSync(operation: OfflineOperation<TEntity>): Promise<void> {
    const change: OfflineChange<TEntity> = {
      id: `${this.entityType}-${Date.now()}-${Math.random()}`,
      operation: operation.type,
      entityId: operation.entityId,
      data: operation.data as Partial<TEntity>,
      timestamp: operation.timestamp,
      synced: false
    };
    
    this.offlineChanges.push(change);
    
    // Limit offline changes
    const maxChanges = this.config.offline!.maxOfflineOperations;
    if (this.offlineChanges.length > maxChanges) {
      this.offlineChanges.splice(0, this.offlineChanges.length - maxChanges);
    }
  }

  // -------------------------------------------------------------------------------------
  // HELPER METHODS
  // -------------------------------------------------------------------------------------

  protected async withErrorHandling<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      this.logPerformance('operation-success', { 
        entityType: this.entityType,
        duration: Date.now() - startTime 
      });
      return result;
    } catch (error) {
      this.logPerformance('operation-error', { 
        entityType: this.entityType,
        duration: Date.now() - startTime,
        error: String(error)
      });
      throw error;
    }
  }

  protected async validateEntity(entity: Partial<TEntity>): Promise<void> {
    // Basic validation - subclasses can override for domain-specific validation
    if (!entity) {
      throw new Error('Entity cannot be null or undefined');
    }
  }

  protected async handleOfflineOperation(
    type: 'create' | 'update' | 'delete',
    id?: TKey,
    data?: any
  ): Promise<TEntity> {
    const operation: OfflineOperation<TEntity> = {
      type,
      entityId: String(id || 'new'),
      data,
      timestamp: new Date()
    };
    
    await this.markForOfflineSync(operation);
    
    // For offline operations, return optimistic result
    // This is simplified - real implementation would handle optimistic updates
    if (type === 'create' || type === 'update') {
      return { id: id || 'temp', ...data } as TEntity;
    }
    
    throw new Error('Delete operations cannot return entities');
  }

  protected logPerformance(event: string, data: any): void {
    if (this.config.logging!.enabled && this.config.logging!.logPerformance) {
      console.log(`[${this.entityType}] ${event}:`, data);
    }
  }
}

/**
 * Base Repository Interface
 * 
 * Defines the standard contract for all repository implementations.
 * Provides consistent patterns for data access, caching, and offline support
 * across all domain entities.
 * 
 * Key Features:
 * - Standardized CRUD operations with consistent error handling
 * - Built-in caching strategies for performance optimization
 * - Offline-first capabilities with sync management
 * - Batch operations for bulk data processing
 * - Query builder pattern for complex data retrieval
 * 
 * @module IBaseRepository
 */

// =====================================================================================
// BASE REPOSITORY INTERFACES
// =====================================================================================

export interface IBaseRepository<TEntity, TKey = string> {
  // Basic CRUD Operations
  findById(id: TKey): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;
  create(entity: Omit<TEntity, 'id'>): Promise<TEntity>;
  update(id: TKey, updates: Partial<TEntity>): Promise<TEntity>;
  delete(id: TKey): Promise<boolean>;
  
  // Batch Operations
  createMany(entities: Omit<TEntity, 'id'>[]): Promise<TEntity[]>;
  updateMany(updates: Array<{ id: TKey; data: Partial<TEntity> }>): Promise<TEntity[]>;
  deleteMany(ids: TKey[]): Promise<boolean>;
  
  // Query Operations
  findBy(criteria: Partial<TEntity>): Promise<TEntity[]>;
  findOne(criteria: Partial<TEntity>): Promise<TEntity | null>;
  count(criteria?: Partial<TEntity>): Promise<number>;
  exists(id: TKey): Promise<boolean>;
  
  // Advanced Operations
  upsert(entity: TEntity): Promise<TEntity>;
  bulkUpsert(entities: TEntity[]): Promise<TEntity[]>;
  
  // Cache Management
  clearCache(): Promise<void>;
  preloadCache(ids?: TKey[]): Promise<void>;
  getCacheStats(): Promise<CacheStats>;
  
  // Offline Support
  getOfflineChanges(): Promise<OfflineChange<TEntity>[]>;
  syncToServer(): Promise<SyncResult>;
  markForOfflineSync(operation: OfflineOperation<TEntity>): Promise<void>;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  cacheSize: number;
  lastCleared: Date;
  memoryUsage: number; // in bytes
}

export interface OfflineChange<TEntity> {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityId: string;
  data?: Partial<TEntity>;
  timestamp: Date;
  synced: boolean;
  conflictResolution?: 'client-wins' | 'server-wins' | 'merge';
}

export interface OfflineOperation<TEntity> {
  type: 'create' | 'update' | 'delete';
  entityId: string;
  data?: TEntity | Partial<TEntity>;
  timestamp: Date;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  conflictCount: number;
  errors: string[];
  conflicts: Array<{
    entityId: string;
    localData: any;
    serverData: any;
    resolution: string;
  }>;
  duration: number;
}

// =====================================================================================
// QUERY BUILDER INTERFACE
// =====================================================================================

export interface IQueryBuilder<TEntity> {
  where(criteria: Partial<TEntity>): IQueryBuilder<TEntity>;
  whereIn<K extends keyof TEntity>(field: K, values: TEntity[K][]): IQueryBuilder<TEntity>;
  whereNotIn<K extends keyof TEntity>(field: K, values: TEntity[K][]): IQueryBuilder<TEntity>;
  whereBetween<K extends keyof TEntity>(field: K, min: TEntity[K], max: TEntity[K]): IQueryBuilder<TEntity>;
  orderBy<K extends keyof TEntity>(field: K, direction?: 'asc' | 'desc'): IQueryBuilder<TEntity>;
  limit(count: number): IQueryBuilder<TEntity>;
  offset(count: number): IQueryBuilder<TEntity>;
  select<K extends keyof TEntity>(...fields: K[]): IQueryBuilder<Pick<TEntity, K>>;
  include(relations: string[]): IQueryBuilder<TEntity>;
  execute(): Promise<TEntity[]>;
  first(): Promise<TEntity | null>;
  count(): Promise<number>;
}

// =====================================================================================
// REPOSITORY CONFIGURATION
// =====================================================================================

export interface RepositoryConfig {
  // Cache Configuration
  cache?: {
    enabled: boolean;
    ttl: number; // Time to live in milliseconds
    maxSize: number; // Maximum cache size
    strategy: 'lru' | 'fifo' | 'ttl-only';
    compression: boolean;
  };
  
  // Offline Configuration
  offline?: {
    enabled: boolean;
    maxOfflineOperations: number;
    autoSync: boolean;
    syncInterval: number; // in milliseconds
    conflictResolution: 'client-wins' | 'server-wins' | 'prompt-user' | 'merge';
  };
  
  // Performance Configuration
  performance?: {
    batchSize: number;
    maxConcurrentRequests: number;
    requestTimeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  
  // Validation Configuration
  validation?: {
    enabled: boolean;
    validateOnCreate: boolean;
    validateOnUpdate: boolean;
    skipValidation: string[]; // Field names to skip
  };
  
  // Logging Configuration
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    logQueries: boolean;
    logPerformance: boolean;
  };
}

export const DEFAULT_REPOSITORY_CONFIG: RepositoryConfig = {
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000,
    strategy: 'lru',
    compression: false
  },
  offline: {
    enabled: true,
    maxOfflineOperations: 1000,
    autoSync: true,
    syncInterval: 30 * 1000, // 30 seconds
    conflictResolution: 'server-wins'
  },
  performance: {
    batchSize: 50,
    maxConcurrentRequests: 5,
    requestTimeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000
  },
  validation: {
    enabled: true,
    validateOnCreate: true,
    validateOnUpdate: true,
    skipValidation: []
  },
  logging: {
    enabled: true,
    level: 'info',
    logQueries: false,
    logPerformance: true
  }
};

// =====================================================================================
// REPOSITORY EVENTS
// =====================================================================================

export interface RepositoryEvent<TEntity> {
  type: 'created' | 'updated' | 'deleted' | 'synced' | 'cache-cleared';
  entityType: string;
  entityId: string;
  entity?: TEntity;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IRepositoryEventManager<TEntity> {
  on(event: RepositoryEvent<TEntity>['type'], handler: (event: RepositoryEvent<TEntity>) => void): void;
  off(event: RepositoryEvent<TEntity>['type'], handler: (event: RepositoryEvent<TEntity>) => void): void;
  emit(event: RepositoryEvent<TEntity>): void;
  removeAllListeners(): void;
}

// =====================================================================================
// SPECIALIZED REPOSITORY INTERFACES
// =====================================================================================

export interface ITimestampedRepository<TEntity extends { createdAt: Date; updatedAt: Date }, TKey = string> 
  extends IBaseRepository<TEntity, TKey> {
  findByCreatedDate(startDate: Date, endDate?: Date): Promise<TEntity[]>;
  findByUpdatedDate(startDate: Date, endDate?: Date): Promise<TEntity[]>;
  findRecentlyCreated(hours: number): Promise<TEntity[]>;
  findRecentlyUpdated(hours: number): Promise<TEntity[]>;
}

export interface ISoftDeletableRepository<TEntity extends { deletedAt?: Date }, TKey = string> 
  extends IBaseRepository<TEntity, TKey> {
  softDelete(id: TKey): Promise<boolean>;
  restore(id: TKey): Promise<boolean>;
  findWithDeleted(): Promise<TEntity[]>;
  findOnlyDeleted(): Promise<TEntity[]>;
  forceDelete(id: TKey): Promise<boolean>;
}

export interface IHierarchicalRepository<TEntity extends { parentId?: string }, TKey = string> 
  extends IBaseRepository<TEntity, TKey> {
  findChildren(parentId: TKey): Promise<TEntity[]>;
  findDescendants(parentId: TKey): Promise<TEntity[]>;
  findAncestors(childId: TKey): Promise<TEntity[]>;
  findRoot(): Promise<TEntity[]>;
  findLeaves(): Promise<TEntity[]>;
  moveNode(nodeId: TKey, newParentId: TKey): Promise<boolean>;
}

// =====================================================================================
// REPOSITORY FACTORY INTERFACE
// =====================================================================================

export interface IRepositoryFactory {
  createRepository<TEntity>(
    entityType: string,
    config?: Partial<RepositoryConfig>
  ): IBaseRepository<TEntity>;
  
  createTimestampedRepository<TEntity extends { createdAt: Date; updatedAt: Date }>(
    entityType: string,
    config?: Partial<RepositoryConfig>
  ): ITimestampedRepository<TEntity>;
  
  createSoftDeletableRepository<TEntity extends { deletedAt?: Date }>(
    entityType: string,
    config?: Partial<RepositoryConfig>
  ): ISoftDeletableRepository<TEntity>;
  
  createHierarchicalRepository<TEntity extends { parentId?: string }>(
    entityType: string,
    config?: Partial<RepositoryConfig>
  ): IHierarchicalRepository<TEntity>;
  
  getRepository<TEntity>(entityType: string): IBaseRepository<TEntity> | null;
  disposeRepository(entityType: string): Promise<void>;
  disposeAllRepositories(): Promise<void>;
}

// =====================================================================================
// ERROR TYPES
// =====================================================================================

export class RepositoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public entityType?: string,
    public entityId?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class ValidationError extends RepositoryError {
  constructor(
    message: string,
    public validationErrors: string[],
    entityType?: string,
    entityId?: string
  ) {
    super(message, 'VALIDATION_ERROR', entityType, entityId);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends RepositoryError {
  constructor(
    message: string,
    public serverData: any,
    public clientData: any,
    entityType?: string,
    entityId?: string
  ) {
    super(message, 'CONFLICT_ERROR', entityType, entityId);
    this.name = 'ConflictError';
  }
}

export class NetworkError extends RepositoryError {
  constructor(
    message: string,
    public status?: number,
    entityType?: string
  ) {
    super(message, 'NETWORK_ERROR', entityType);
    this.name = 'NetworkError';
  }
}

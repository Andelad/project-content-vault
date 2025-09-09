/**
 * Repository Factory
 * 
 * Centralized factory for creating and managing repository instances.
 * Provides dependency injection capabilities and consistent configuration
 * across all repository types.
 * 
 * Key Features:
 * - Singleton pattern for repository instances
 * - Consistent configuration management
 * - Type-safe repository creation
 * - Lifecycle management and cleanup
 * - Performance monitoring and caching
 * 
 * @module RepositoryFactory
 */

import type { 
  IBaseRepository,
  IRepositoryFactory,
  ITimestampedRepository,
  ISoftDeletableRepository,
  IHierarchicalRepository,
  RepositoryConfig
} from './IBaseRepository';

import { ProjectRepository, type IProjectRepository } from './ProjectRepository';
import { MilestoneRepository, type IMilestoneRepository } from './MilestoneRepository';
import { timeTrackingRepository } from './timeTrackingRepository';
// Additional repository imports would go here
// import { EventRepository, type IEventRepository } from './EventRepository';
// import { WorkHourRepository, type IWorkHourRepository } from './WorkHourRepository';

// =====================================================================================
// REPOSITORY FACTORY IMPLEMENTATION
// =====================================================================================

export class RepositoryFactory implements IRepositoryFactory {
  private static instance: RepositoryFactory | null = null;
  private repositoryInstances = new Map<string, IBaseRepository<any>>();
  private defaultConfig: RepositoryConfig;
  
  private constructor(defaultConfig?: Partial<RepositoryConfig>) {
    this.defaultConfig = {
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
        syncInterval: 30 * 1000,
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
      },
      ...defaultConfig
    };
  }

  // -------------------------------------------------------------------------------------
  // SINGLETON PATTERN
  // -------------------------------------------------------------------------------------

  static getInstance(defaultConfig?: Partial<RepositoryConfig>): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory(defaultConfig);
    }
    return RepositoryFactory.instance;
  }

  static resetInstance(): void {
    if (RepositoryFactory.instance) {
      RepositoryFactory.instance.disposeAllRepositories();
      RepositoryFactory.instance = null;
    }
  }

  // -------------------------------------------------------------------------------------
  // REPOSITORY CREATION METHODS
  // -------------------------------------------------------------------------------------

  createRepository<TEntity>(
    entityType: string, 
    config?: Partial<RepositoryConfig>
  ): IBaseRepository<TEntity> {
    const key = `base_${entityType}`;
    
    if (this.repositoryInstances.has(key)) {
      return this.repositoryInstances.get(key)!;
    }

    // Create appropriate repository based on entity type
    let repository: IBaseRepository<any>;
    
    switch (entityType.toLowerCase()) {
      case 'project':
        repository = new ProjectRepository({ ...this.defaultConfig, ...config });
        break;
      case 'milestone':
        repository = new MilestoneRepository({ ...this.defaultConfig, ...config });
        break;
      //   repository = new MilestoneRepository({ ...this.defaultConfig, ...config });
      //   break;
      
      // case 'event':
      // case 'calendarevent':
      //   repository = new EventRepository({ ...this.defaultConfig, ...config });
      //   break;
      
      // case 'workhour':
      // case 'work_hour':
      //   repository = new WorkHourRepository({ ...this.defaultConfig, ...config });
      //   break;
      
      default:
        throw new Error(`Unknown entity type: ${entityType}. Cannot create repository.`);
    }

    this.repositoryInstances.set(key, repository);
    return repository;
  }

  createTimestampedRepository<TEntity extends { createdAt: Date; updatedAt: Date }>(
    entityType: string,
    config?: Partial<RepositoryConfig>
  ): ITimestampedRepository<TEntity> {
    const key = `timestamped_${entityType}`;
    
    if (this.repositoryInstances.has(key)) {
      return this.repositoryInstances.get(key)! as ITimestampedRepository<TEntity>;
    }

    let repository: ITimestampedRepository<any>;
    
    switch (entityType.toLowerCase()) {
      case 'project':
        repository = new ProjectRepository({ ...this.defaultConfig, ...config });
        break;
      
      // Additional timestamped repositories would be added here
      
      default:
        throw new Error(`No timestamped repository available for entity type: ${entityType}`);
    }

    this.repositoryInstances.set(key, repository as any);
    return repository;
  }

  createSoftDeletableRepository<TEntity extends { deletedAt?: Date }>(
    entityType: string,
    config?: Partial<RepositoryConfig>
  ): ISoftDeletableRepository<TEntity> {
    const key = `soft_deletable_${entityType}`;
    
    if (this.repositoryInstances.has(key)) {
      return this.repositoryInstances.get(key)! as ISoftDeletableRepository<TEntity>;
    }

    // Implementation would create soft-deletable repositories
    // For now, throw error as none are implemented yet
    throw new Error(`No soft-deletable repository available for entity type: ${entityType}`);
  }

  createHierarchicalRepository<TEntity extends { parentId?: string }>(
    entityType: string,
    config?: Partial<RepositoryConfig>
  ): IHierarchicalRepository<TEntity> {
    const key = `hierarchical_${entityType}`;
    
    if (this.repositoryInstances.has(key)) {
      return this.repositoryInstances.get(key)! as IHierarchicalRepository<TEntity>;
    }

    // Implementation would create hierarchical repositories
    // For now, throw error as none are implemented yet  
    throw new Error(`No hierarchical repository available for entity type: ${entityType}`);
  }

  // -------------------------------------------------------------------------------------
  // REPOSITORY MANAGEMENT
  // -------------------------------------------------------------------------------------

  getRepository<TEntity>(entityType: string): IBaseRepository<TEntity> | null {
    const baseKey = `base_${entityType}`;
    const timestampedKey = `timestamped_${entityType}`;
    
    // Try to find existing repository
    return (
      this.repositoryInstances.get(baseKey) ||
      this.repositoryInstances.get(timestampedKey) ||
      null
    ) as IBaseRepository<TEntity> | null;
  }

  async disposeRepository(entityType: string): Promise<void> {
    const keysToRemove: string[] = [];
    
    // Find all repositories for this entity type
    for (const key of this.repositoryInstances.keys()) {
      if (key.includes(entityType)) {
        const repository = this.repositoryInstances.get(key);
        if (repository && 'clearCache' in repository) {
          await (repository as any).clearCache();
        }
        keysToRemove.push(key);
      }
    }
    
    // Remove from instances map
    keysToRemove.forEach(key => this.repositoryInstances.delete(key));
  }

  async disposeAllRepositories(): Promise<void> {
    // Clear caches for all repositories
    const clearPromises = Array.from(this.repositoryInstances.values())
      .filter(repo => 'clearCache' in repo)
      .map(repo => (repo as any).clearCache());
    
    await Promise.all(clearPromises);
    
    // Clear the instances map
    this.repositoryInstances.clear();
  }

  // -------------------------------------------------------------------------------------
  // CONFIGURATION MANAGEMENT
  // -------------------------------------------------------------------------------------

  updateDefaultConfig(config: Partial<RepositoryConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  getDefaultConfig(): RepositoryConfig {
    return { ...this.defaultConfig };
  }

  // -------------------------------------------------------------------------------------
  // UTILITY METHODS
  // -------------------------------------------------------------------------------------

  getActiveRepositoryCount(): number {
    return this.repositoryInstances.size;
  }

  getActiveRepositoryTypes(): string[] {
    return Array.from(this.repositoryInstances.keys())
      .map(key => key.split('_').slice(1).join('_'));
  }

  async getRepositoryStats(): Promise<{
    totalRepositories: number;
    activeRepositories: string[];
    cacheStats: Array<{
      entityType: string;
      cacheSize: number;
      hitRate: number;
    }>;
  }> {
    const activeRepositories = this.getActiveRepositoryTypes();
    const cacheStats: Array<{
      entityType: string;
      cacheSize: number;
      hitRate: number;
    }> = [];

    // Collect cache statistics from all repositories
    for (const [key, repository] of this.repositoryInstances.entries()) {
      if ('getCacheStats' in repository) {
        try {
          const stats = await (repository as any).getCacheStats();
          cacheStats.push({
            entityType: key,
            cacheSize: stats.cacheSize,
            hitRate: stats.hitRate
          });
        } catch (error) {
          // Ignore errors in cache stats collection
          console.warn(`Failed to get cache stats for ${key}:`, error);
        }
      }
    }

    return {
      totalRepositories: this.repositoryInstances.size,
      activeRepositories,
      cacheStats
    };
  }
}

// =====================================================================================
// CONVENIENCE FUNCTIONS
// =====================================================================================

/**
 * Get the singleton repository factory instance
 */
export function getRepositoryFactory(): RepositoryFactory {
  return RepositoryFactory.getInstance();
}

/**
 * Create or get a repository for a specific entity type
 */
export function getRepository<TEntity>(
  entityType: string,
  config?: Partial<RepositoryConfig>
): IBaseRepository<TEntity> {
  const factory = getRepositoryFactory();
  
  // Try to get existing repository first
  let repository = factory.getRepository<TEntity>(entityType);
  
  if (!repository) {
    // Create new repository if it doesn't exist
    repository = factory.createRepository<TEntity>(entityType, config);
  }
  
  return repository;
}

/**
 * Get project repository with proper typing
 */
export function getProjectRepository(config?: Partial<RepositoryConfig>): IProjectRepository {
  const factory = getRepositoryFactory();
  return factory.createTimestampedRepository<any>('project', config) as IProjectRepository;
}

/**
 * Get milestone repository with proper typing
 */
export function getMilestoneRepository(config?: Partial<RepositoryConfig>): IMilestoneRepository {
  const factory = getRepositoryFactory();
  return factory.createRepository<any>('milestone', config) as IMilestoneRepository;
}

/**
 * Initialize repository system with default configuration
 */
export function initializeRepositorySystem(config?: Partial<RepositoryConfig>): RepositoryFactory {
  if (config) {
    const factory = getRepositoryFactory();
    factory.updateDefaultConfig(config);
    return factory;
  }
  
  return getRepositoryFactory();
}

/**
 * Clean up repository system (useful for testing)
 */
export async function cleanupRepositorySystem(): Promise<void> {
  await RepositoryFactory.getInstance().disposeAllRepositories();
  RepositoryFactory.resetInstance();
}

// =====================================================================================
// TYPE EXPORTS
// =====================================================================================

export type { IProjectRepository, IMilestoneRepository };

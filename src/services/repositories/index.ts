/**
 * Repository Module Index
 * 
 * Centralized export for all repository implementations and interfaces.
 * Provides convenient access to repository factories and domain-specific repositories.
 * 
 * @module repositories
 */

// =====================================================================================
// BASE INTERFACES AND IMPLEMENTATIONS
// =====================================================================================

export type {
  IBaseRepository,
  ITimestampedRepository,
  ISoftDeletableRepository,
  IHierarchicalRepository,
  IRepositoryFactory,
  RepositoryConfig,
  CacheStats,
  OfflineChange,
  SyncResult
} from './IBaseRepository';

export { UnifiedRepository } from './UnifiedRepository';

// =====================================================================================
// DOMAIN-SPECIFIC REPOSITORIES
// =====================================================================================

export type { IProjectRepository } from './ProjectRepository';
export { ProjectRepository } from './ProjectRepository';

export type { IMilestoneRepository } from './MilestoneRepository';
export { MilestoneRepository } from './MilestoneRepository';

// =====================================================================================
// REPOSITORY FACTORY
// =====================================================================================

export { 
  RepositoryFactory,
  getRepositoryFactory,
  getRepository,
  getProjectRepository,
  getMilestoneRepository,
  initializeRepositorySystem,
  cleanupRepositorySystem
} from './RepositoryFactory';

// =====================================================================================
// CONVENIENCE EXPORTS
// =====================================================================================

/**
 * Initialize the complete repository system with default configuration
 */
export async function initializeRepositories(config?: Partial<import('./IBaseRepository').RepositoryConfig>) {
  const { initializeRepositorySystem, getProjectRepository, getMilestoneRepository } = await import('./RepositoryFactory');
  
  const factory = initializeRepositorySystem(config);
  
  // Pre-warm the main repositories
  const projectRepo = getProjectRepository(config);
  const milestoneRepo = getMilestoneRepository(config);
  
  return {
    factory,
    projectRepository: projectRepo,
    milestoneRepository: milestoneRepo
  };
}

/**
 * Get all available repository statistics
 */
export async function getAllRepositoryStats() {
  const { getRepositoryFactory } = await import('./RepositoryFactory');
  const factory = getRepositoryFactory();
  return factory.getRepositoryStats();
}

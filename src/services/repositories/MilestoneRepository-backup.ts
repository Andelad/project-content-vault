/**
 * Milestone Repository
 * 
 * Domain-specific repository for Milestone entities with specialized
 * querying capabilities and project relationship management.
 * 
 * Key Features:
 * - Milestone-specific querying and filtering
 * - Project relationship management
 * - Timeline analysis capabilities
 * - Advanced caching with performance optimization
 * 
 * @module MilestoneRepository
 */

import { UnifiedRepository } from './UnifiedRepository';
import type { 
  IBaseRepository,
  RepositoryConfig
} from './IBaseRepository';

import type { Milestone } from '../../types';

// =====================================================================================
// MILESTONE REPOSITORY INTERFACES
// =====================================================================================

export interface IMilestoneRepository extends IBaseRepository<Milestone> {
  // Milestone-specific queries
  findByProject(projectId: string): Promise<Milestone[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<Milestone[]>;
  findOverdue(): Promise<Milestone[]>;
  findUpcoming(days?: number): Promise<Milestone[]>;
  
  // Analytics
  getProgressStats(projectId?: string): Promise<{
    total: number;
    completed: number;
    completionRate: number;
    overdueCount: number;
  }>;
  
  // Bulk operations
  bulkUpdateProject(milestoneIds: string[], projectId: string): Promise<Milestone[]>;
}

// =====================================================================================
// MILESTONE REPOSITORY IMPLEMENTATION
// =====================================================================================

export class MilestoneRepository 
  extends UnifiedRepository<Milestone, string>
  implements IMilestoneRepository 
{
  protected entityName = 'milestone' as const;
  
  constructor(config?: RepositoryConfig) {
    super(config);
    this.initializeMilestoneCache();
  }

  // -------------------------------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------------------------------

  private initializeMilestoneCache(): void {
    // Set up cache invalidation patterns
    this.eventManager.on('created', () => {
      this.invalidateProjectCaches();
    });

    this.eventManager.on('updated', () => {
      this.invalidateProjectCaches();
    });

    this.eventManager.on('deleted', () => {
      this.invalidateProjectCaches();
    });
  }

  private invalidateProjectCaches(): void {
    // Clear project-related caches when milestones change
    const cacheKeys = this.cache.keys().filter(key => 
      key.includes('project:') || 
      key.includes('overdue') || 
      key.includes('upcoming')
    );
    cacheKeys.forEach(key => this.cache.delete(key));
  }

  // -------------------------------------------------------------------------------------
  // ABSTRACT METHOD IMPLEMENTATIONS
  // -------------------------------------------------------------------------------------

  protected async executeCreate(data: Omit<Milestone, 'id'>): Promise<Milestone> {
    const milestone: Milestone = {
      id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data
    };
    
    // Store in cache
    this.cache.set(milestone.id, milestone);
    return milestone;
  }

  protected async executeUpdate(id: string, data: Partial<Milestone>): Promise<Milestone> {
    const existing = await this.executeFindById(id);
    if (!existing) {
      throw new Error(`Milestone not found: ${id}`);
    }
    
    const updated: Milestone = { ...existing, ...data };
    this.cache.set(id, updated);
    return updated;
  }

  protected async executeDelete(id: string): Promise<boolean> {
    const exists = await this.executeFindById(id);
    if (!exists) return false;
    
    this.cache.delete(id);
    return true;
  }

  protected async executeFindById(id: string): Promise<Milestone | null> {
    return this.cache.get(id) || null;
  }

  protected async executeFindByIds(ids: string[]): Promise<Milestone[]> {
    const results: Milestone[] = [];
    for (const id of ids) {
      const milestone = await this.executeFindById(id);
      if (milestone) {
        results.push(milestone);
      }
    }
    return results;
  }

  protected async executeFindAll(): Promise<Milestone[]> {
    const allKeys = this.cache.keys();
    const milestones: Milestone[] = [];
    
    for (const key of allKeys) {
      const milestone = this.cache.get(key);
      if (milestone) {
        milestones.push(milestone);
      }
    }
    
    return milestones;
  }

  protected async executeCount(): Promise<number> {
    return this.cache.keys().length;
  }

  protected async executeExists(id: string): Promise<boolean> {
    return this.cache.has(id);
  }

  // -------------------------------------------------------------------------------------
  // MILESTONE-SPECIFIC QUERIES
  // -------------------------------------------------------------------------------------

  async findByProject(projectId: string): Promise<Milestone[]> {
    const cacheKey = `project:${projectId}:milestones`;
    
    return this.withCache(cacheKey, async () => {
      const allMilestones = await this.findAll();
      return allMilestones.filter(milestone => milestone.projectId === projectId);
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Milestone[]> {
    const cacheKey = `milestones:daterange:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    return this.withCache(cacheKey, async () => {
      const allMilestones = await this.findAll();
      return allMilestones.filter(milestone => 
        milestone.dueDate >= startDate && milestone.dueDate <= endDate
      );
    });
  }

  async findOverdue(): Promise<Milestone[]> {
    const now = new Date();
    const cacheKey = `milestones:overdue:${now.toDateString()}`;
    
    return this.withCache(cacheKey, async () => {
      const allMilestones = await this.findAll();
      return allMilestones.filter(milestone => 
        milestone.dueDate < now && !milestone.name.toLowerCase().includes('completed')
      );
    }, 5 * 60 * 1000); // Cache for 5 minutes
  }

  async findUpcoming(days = 7): Promise<Milestone[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const cacheKey = `milestones:upcoming:${days}:${now.toDateString()}`;
    
    return this.withCache(cacheKey, async () => {
      const allMilestones = await this.findAll();
      return allMilestones.filter(milestone => 
        milestone.dueDate >= now && 
        milestone.dueDate <= futureDate &&
        !milestone.name.toLowerCase().includes('completed')
      );
    }, 5 * 60 * 1000); // Cache for 5 minutes
  }

  // -------------------------------------------------------------------------------------
  // ANALYTICS
  // -------------------------------------------------------------------------------------

  async getProgressStats(projectId?: string): Promise<{
    total: number;
    completed: number;
    completionRate: number;
    overdueCount: number;
  }> {
    const cacheKey = projectId ? 
      `project:${projectId}:progress` : 
      'milestones:progress:global';
    
    return this.withCache(cacheKey, async () => {
      const milestones = projectId ? 
        await this.findByProject(projectId) : 
        await this.findAll();

      const total = milestones.length;
      const completed = milestones.filter(m => 
        m.name.toLowerCase().includes('completed')
      ).length;
      
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      
      const overdue = await this.findOverdue();
      const overdueCount = projectId ? 
        overdue.filter(m => m.projectId === projectId).length :
        overdue.length;
      
      return {
        total,
        completed,
        completionRate,
        overdueCount
      };
    });
  }

  // -------------------------------------------------------------------------------------
  // BULK OPERATIONS
  // -------------------------------------------------------------------------------------

  async bulkUpdateProject(milestoneIds: string[], projectId: string): Promise<Milestone[]> {
    return this.withErrorHandling(async () => {
      const results = await Promise.all(
        milestoneIds.map(id => this.update(id, { projectId }))
      );
      
      this.eventManager.emit('updated');
      return results;
    });
  }
}

import { UnifiedRepository } from './UnifiedRepository';
import type { 
  ITimestampedRepository,
  RepositoryConfig,
  QueryBuilder,
  QueryOptions,
  SortConfig,
  FilterConfig,
  AggregationConfig,
  ValidationResult
} from './IBaseRepository';

import type { 
  Milestone, 
  Project,
  MilestoneStatus,
  MilestoneType,
  MilestoneValidator
} from '../../types';

// =====================================================================================
// MILESTONE REPOSITORY INTERFACES
// =====================================================================================

export interface IMilestoneRepository extends ITimestampedRepository<Milestone> {
  // Milestone-specific queries
  findByProject(projectId: string, options?: QueryOptions): Promise<Milestone[]>;
  findByStatus(status: MilestoneStatus, options?: QueryOptions): Promise<Milestone[]>;
  findByType(type: MilestoneType, options?: QueryOptions): Promise<Milestone[]>;
  findByDateRange(startDate: Date, endDate: Date, options?: QueryOptions): Promise<Milestone[]>;
  findOverdue(options?: QueryOptions): Promise<Milestone[]>;
  findUpcoming(days?: number, options?: QueryOptions): Promise<Milestone[]>;
  
  // Dependency management
  findDependencies(milestoneId: string): Promise<Milestone[]>;
  findDependents(milestoneId: string): Promise<Milestone[]>;
  getCriticalPath(projectId: string): Promise<Milestone[]>;
  validateDependencies(milestoneId: string, dependencyIds: string[]): Promise<ValidationResult>;
  
  // Timeline analysis
  getProjectTimeline(projectId: string): Promise<{
    milestones: Milestone[];
    timeline: Array<{
      milestone: Milestone;
      startDate: Date;
      endDate: Date;
      dependencies: string[];
      criticalPath: boolean;
    }>;
    totalDuration: number;
    criticalPathDuration: number;
  }>;
  
  // Progress tracking
  getProgressStats(projectId?: string): Promise<{
    total: number;
    byStatus: Record<MilestoneStatus, number>;
    byType: Record<MilestoneType, number>;
    completionRate: number;
    overdueCount: number;
    upcomingCount: number;
  }>;
  
  // Milestone analytics
  getMilestoneAnalytics(milestoneId: string): Promise<{
    milestone: Milestone;
    project?: Project;
    dependencies: Milestone[];
    dependents: Milestone[];
    timelineImpact: {
      isOnCriticalPath: boolean;
      slackTime: number;
      impactedMilestones: string[];
    };
    progressMetrics: {
      daysRemaining: number;
      isOverdue: boolean;
      completionPercentage: number;
    };
  }>;
  
  // Bulk operations
  bulkUpdateStatus(milestoneIds: string[], status: MilestoneStatus): Promise<Milestone[]>;
  bulkUpdateProject(milestoneIds: string[], projectId: string): Promise<Milestone[]>;
  bulkDelete(milestoneIds: string[]): Promise<boolean>;
// =====================================================================================
// MILESTONE REPOSITORY IMPLEMENTATION
// =====================================================================================

export class MilestoneRepository 
  extends UnifiedRepository<Milestone>
  implements IMilestoneRepository 
{
  protected entityName = 'milestone' as const;
  protected validator?: MilestoneValidator;
  
  constructor(config?: RepositoryConfig) {
    super(config);
    
    // Initialize milestone-specific cache keys
    this.initializeMilestoneCache();
  }

  // -------------------------------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------------------------------

  private initializeMilestoneCache(): void {
    // Set up cache invalidation patterns
    this.eventManager.on('milestone:created', (milestone: Milestone) => {
      this.invalidateRelatedCaches(milestone);
    });

    this.eventManager.on('milestone:updated', (milestone: Milestone) => {
      this.invalidateRelatedCaches(milestone);
    });

    this.eventManager.on('milestone:deleted', (milestoneId: string) => {
      this.cache.delete(`milestone:${milestoneId}`);
      // Invalidate project-related caches
      this.cache.keys()
        .filter(key => key.includes('project:') && key.includes('milestones'))
        .forEach(key => this.cache.delete(key));
    });
  }

  private invalidateRelatedCaches(milestone: Milestone): void {
    // Invalidate milestone-specific caches
    this.cache.delete(`milestone:${milestone.id}`);
    
    // Invalidate project-related milestone caches
    if (milestone.projectId) {
      this.cache.delete(`project:${milestone.projectId}:milestones`);
      this.cache.delete(`project:${milestone.projectId}:timeline`);
      this.cache.delete(`project:${milestone.projectId}:progress`);
    }
    
    // Invalidate status and type caches
    this.cache.delete(`milestones:status:${milestone.status}`);
    this.cache.delete(`milestones:type:${milestone.type}`);
    
    // Invalidate analytics caches
    this.cache.delete(`milestone:${milestone.id}:analytics`);
  }

  // -------------------------------------------------------------------------------------
  // CORE CRUD OPERATIONS (INHERITED WITH MILESTONE-SPECIFIC VALIDATION)
  // -------------------------------------------------------------------------------------

  async create(data: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): Promise<Milestone> {
    return this.withErrorHandling(async () => {
      // Validate milestone data
      if (this.validator) {
        const validation = await this.validator.validate(data);
        if (!validation.isValid) {
          throw new Error(`Milestone validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Validate dependencies
      if (data.dependencies && data.dependencies.length > 0) {
        const depValidation = await this.validateDependencies(data.id || '', data.dependencies);
        if (!depValidation.isValid) {
          throw new Error(`Dependency validation failed: ${depValidation.errors.join(', ')}`);
        }
      }

      const milestone = await super.create(data);
      
      this.eventManager.emit('milestone:created', milestone);
      return milestone;
    }, 'Failed to create milestone');
  }

  async update(id: string, data: Partial<Milestone>): Promise<Milestone> {
    return this.withErrorHandling(async () => {
      // Validate dependencies if being updated
      if (data.dependencies) {
        const depValidation = await this.validateDependencies(id, data.dependencies);
        if (!depValidation.isValid) {
          throw new Error(`Dependency validation failed: ${depValidation.errors.join(', ')}`);
        }
      }

      const milestone = await super.update(id, data);
      
      this.eventManager.emit('milestone:updated', milestone);
      return milestone;
    }, 'Failed to update milestone');
  }

  // -------------------------------------------------------------------------------------
  // MILESTONE-SPECIFIC QUERIES
  // -------------------------------------------------------------------------------------

  async findByProject(projectId: string, options: QueryOptions = {}): Promise<Milestone[]> {
    const cacheKey = `project:${projectId}:milestones:${JSON.stringify(options)}`;
    
    return this.withCache(cacheKey, async () => {
      const query = this.createQuery()
        .where('projectId', '=', projectId);

      return this.executeQuery(query, options);
    });
  }

  async findByStatus(status: MilestoneStatus, options: QueryOptions = {}): Promise<Milestone[]> {
    const cacheKey = `milestones:status:${status}:${JSON.stringify(options)}`;
    
    return this.withCache(cacheKey, async () => {
      const query = this.createQuery()
        .where('status', '=', status);

      return this.executeQuery(query, options);
    });
  }

  async findByType(type: MilestoneType, options: QueryOptions = {}): Promise<Milestone[]> {
    const cacheKey = `milestones:type:${type}:${JSON.stringify(options)}`;
    
    return this.withCache(cacheKey, async () => {
      const query = this.createQuery()
        .where('type', '=', type);

      return this.executeQuery(query, options);
    });
  }

  async findByDateRange(startDate: Date, endDate: Date, options: QueryOptions = {}): Promise<Milestone[]> {
    const cacheKey = `milestones:daterange:${startDate.toISOString()}:${endDate.toISOString()}:${JSON.stringify(options)}`;
    
    return this.withCache(cacheKey, async () => {
      const query = this.createQuery()
        .where('targetDate', '>=', startDate)
        .where('targetDate', '<=', endDate);

      return this.executeQuery(query, options);
    });
  }

  async findOverdue(options: QueryOptions = {}): Promise<Milestone[]> {
    const now = new Date();
    const cacheKey = `milestones:overdue:${now.toDateString()}:${JSON.stringify(options)}`;
    
    return this.withCache(cacheKey, async () => {
      const query = this.createQuery()
        .where('targetDate', '<', now)
        .where('status', '!=', 'completed');

      return this.executeQuery(query, options);
    }, 5 * 60 * 1000); // Cache for 5 minutes
  }

  async findUpcoming(days = 7, options: QueryOptions = {}): Promise<Milestone[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const cacheKey = `milestones:upcoming:${days}:${now.toDateString()}:${JSON.stringify(options)}`;
    
    return this.withCache(cacheKey, async () => {
      const query = this.createQuery()
        .where('targetDate', '>=', now)
        .where('targetDate', '<=', futureDate)
        .where('status', '!=', 'completed');

      return this.executeQuery(query, options);
    }, 5 * 60 * 1000); // Cache for 5 minutes
  }

  // -------------------------------------------------------------------------------------
  // DEPENDENCY MANAGEMENT
  // -------------------------------------------------------------------------------------

  async findDependencies(milestoneId: string): Promise<Milestone[]> {
    const cacheKey = `milestone:${milestoneId}:dependencies`;
    
    return this.withCache(cacheKey, async () => {
      const milestone = await this.findById(milestoneId);
      if (!milestone?.dependencies) {
        return [];
      }

      return this.findByIds(milestone.dependencies);
    });
  }

  async findDependents(milestoneId: string): Promise<Milestone[]> {
    const cacheKey = `milestone:${milestoneId}:dependents`;
    
    return this.withCache(cacheKey, async () => {
      const query = this.createQuery()
        .where('dependencies', 'array-contains', milestoneId);

      return this.executeQuery(query);
    });
  }

  async getCriticalPath(projectId: string): Promise<Milestone[]> {
    const cacheKey = `project:${projectId}:criticalpath`;
    
    return this.withCache(cacheKey, async () => {
      const milestones = await this.findByProject(projectId);
      
      // Implement critical path calculation using topological sort
      return this.calculateCriticalPath(milestones);
    });
  }

  private calculateCriticalPath(milestones: Milestone[]): Milestone[] {
    // Build dependency graph
    const graph = new Map<string, { milestone: Milestone; dependencies: string[]; dependents: string[] }>();
    
    milestones.forEach(milestone => {
      graph.set(milestone.id, {
        milestone,
        dependencies: milestone.dependencies || [],
        dependents: []
      });
    });

    // Calculate dependents
    graph.forEach((node, milestoneId) => {
      node.dependencies.forEach(depId => {
        const depNode = graph.get(depId);
        if (depNode) {
          depNode.dependents.push(milestoneId);
        }
      });
    });

    // Calculate longest path (critical path)
    const visited = new Set<string>();
    const criticalPath: Milestone[] = [];
    
    const dfs = (milestoneId: string, path: Milestone[]): Milestone[] => {
      if (visited.has(milestoneId)) return path;
      
      visited.add(milestoneId);
      const node = graph.get(milestoneId);
      if (!node) return path;
      
      const currentPath = [...path, node.milestone];
      
      if (node.dependents.length === 0) {
        // Leaf node - end of path
        return currentPath;
      }
      
      let longestPath = currentPath;
      node.dependents.forEach(dependentId => {
        const dependentPath = dfs(dependentId, currentPath);
        if (dependentPath.length > longestPath.length) {
          longestPath = dependentPath;
        }
      });
      
      return longestPath;
    };

    // Find start nodes (no dependencies)
    const startNodes = Array.from(graph.values())
      .filter(node => node.dependencies.length === 0);

    let criticalPathResult: Milestone[] = [];
    startNodes.forEach(startNode => {
      const path = dfs(startNode.milestone.id, []);
      if (path.length > criticalPathResult.length) {
        criticalPathResult = path;
      }
    });

    return criticalPathResult;
  }

  async validateDependencies(milestoneId: string, dependencyIds: string[]): Promise<ValidationResult> {
    try {
      // Check for circular dependencies
      const hasCircularDependency = await this.checkCircularDependency(milestoneId, dependencyIds);
      if (hasCircularDependency) {
        return {
          isValid: false,
          errors: ['Circular dependency detected'],
          warnings: []
        };
      }

      // Validate that all dependencies exist
      const dependencies = await this.findByIds(dependencyIds);
      if (dependencies.length !== dependencyIds.length) {
        const missingIds = dependencyIds.filter(id => 
          !dependencies.some(dep => dep.id === id)
        );
        return {
          isValid: false,
          errors: [`Missing dependencies: ${missingIds.join(', ')}`],
          warnings: []
        };
      }

      return { isValid: true, errors: [], warnings: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Dependency validation failed: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  private async checkCircularDependency(milestoneId: string, newDependencies: string[]): Promise<boolean> {
    const visited = new Set<string>();
    
    const hasCircular = async (currentId: string): Promise<boolean> => {
      if (currentId === milestoneId) return true;
      if (visited.has(currentId)) return false;
      
      visited.add(currentId);
      
      const milestone = await this.findById(currentId);
      if (!milestone?.dependencies) return false;
      
      for (const depId of milestone.dependencies) {
        if (await hasCircular(depId)) {
          return true;
        }
      }
      
      return false;
    };

    for (const depId of newDependencies) {
      if (await hasCircular(depId)) {
        return true;
      }
    }

    return false;
  }

  // -------------------------------------------------------------------------------------
  // TIMELINE ANALYSIS
  // -------------------------------------------------------------------------------------

  async getProjectTimeline(projectId: string): Promise<{
    milestones: Milestone[];
    timeline: Array<{
      milestone: Milestone;
      startDate: Date;
      endDate: Date;
      dependencies: string[];
      criticalPath: boolean;
    }>;
    totalDuration: number;
    criticalPathDuration: number;
  }> {
    const cacheKey = `project:${projectId}:timeline`;
    
    return this.withCache(cacheKey, async () => {
      const milestones = await this.findByProject(projectId, {
        sort: { targetDate: 'asc' }
      });

      const criticalPath = await this.getCriticalPath(projectId);
      const criticalPathIds = new Set(criticalPath.map(m => m.id));

      const timeline = milestones.map(milestone => ({
        milestone,
        startDate: new Date(milestone.createdAt),
        endDate: milestone.targetDate,
        dependencies: milestone.dependencies || [],
        criticalPath: criticalPathIds.has(milestone.id)
      }));

      const totalDuration = this.calculateTimelineDuration(milestones);
      const criticalPathDuration = this.calculateTimelineDuration(criticalPath);

      return {
        milestones,
        timeline,
        totalDuration,
        criticalPathDuration
      };
    });
  }

  private calculateTimelineDuration(milestones: Milestone[]): number {
    if (milestones.length === 0) return 0;
    
    const sortedMilestones = [...milestones].sort((a, b) => 
      a.targetDate.getTime() - b.targetDate.getTime()
    );

    const startDate = sortedMilestones[0].createdAt;
    const endDate = sortedMilestones[sortedMilestones.length - 1].targetDate;
    
    return endDate.getTime() - startDate.getTime();
  }

  // -------------------------------------------------------------------------------------
  // PROGRESS TRACKING
  // -------------------------------------------------------------------------------------

  async getProgressStats(projectId?: string): Promise<{
    total: number;
    byStatus: Record<MilestoneStatus, number>;
    byType: Record<MilestoneType, number>;
    completionRate: number;
    overdueCount: number;
    upcomingCount: number;
  }> {
    const cacheKey = projectId ? 
      `project:${projectId}:progress` : 
      'milestones:progress:global';
    
    return this.withCache(cacheKey, async () => {
      const milestones = projectId ? 
        await this.findByProject(projectId) : 
        await this.findAll();

      const total = milestones.length;
      const byStatus = this.groupByField(milestones, 'status') as Record<MilestoneStatus, number>;
      const byType = this.groupByField(milestones, 'type') as Record<MilestoneType, number>;
      
      const completed = byStatus.completed || 0;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      
      const overdue = await this.findOverdue();
      const upcoming = await this.findUpcoming();
      
      return {
        total,
        byStatus,
        byType,
        completionRate,
        overdueCount: overdue.length,
        upcomingCount: upcoming.length
      };
    });
  }

  private groupByField<T>(items: T[], field: keyof T): Record<string, number> {
    return items.reduce((acc, item) => {
      const key = String(item[field]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // -------------------------------------------------------------------------------------
  // MILESTONE ANALYTICS
  // -------------------------------------------------------------------------------------

  async getMilestoneAnalytics(milestoneId: string): Promise<{
    milestone: Milestone;
    project?: Project;
    dependencies: Milestone[];
    dependents: Milestone[];
    timelineImpact: {
      isOnCriticalPath: boolean;
      slackTime: number;
      impactedMilestones: string[];
    };
    progressMetrics: {
      daysRemaining: number;
      isOverdue: boolean;
      completionPercentage: number;
    };
  }> {
    const cacheKey = `milestone:${milestoneId}:analytics`;
    
    return this.withCache(cacheKey, async () => {
      const milestone = await this.findById(milestoneId);
      if (!milestone) {
        throw new Error(`Milestone not found: ${milestoneId}`);
      }

      const [dependencies, dependents] = await Promise.all([
        this.findDependencies(milestoneId),
        this.findDependents(milestoneId)
      ]);

      // Get project and critical path
      let project: Project | undefined;
      let isOnCriticalPath = false;
      if (milestone.projectId) {
        const criticalPath = await this.getCriticalPath(milestone.projectId);
        isOnCriticalPath = criticalPath.some(m => m.id === milestoneId);
      }

      // Calculate timeline impact
      const impactedMilestones = dependents.map(d => d.id);
      const slackTime = this.calculateSlackTime(milestone, dependencies, dependents);

      // Calculate progress metrics
      const now = new Date();
      const daysRemaining = Math.ceil(
        (milestone.targetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      const isOverdue = daysRemaining < 0 && milestone.status !== 'completed';
      
      const completionPercentage = milestone.status === 'completed' ? 100 :
        milestone.status === 'in-progress' ? 50 :
        milestone.status === 'planning' ? 25 : 0;

      return {
        milestone,
        project,
        dependencies,
        dependents,
        timelineImpact: {
          isOnCriticalPath,
          slackTime,
          impactedMilestones
        },
        progressMetrics: {
          daysRemaining,
          isOverdue,
          completionPercentage
        }
      };
    });
  }

  private calculateSlackTime(
    milestone: Milestone, 
    dependencies: Milestone[], 
    dependents: Milestone[]
  ): number {
    if (dependents.length === 0) return 0;

    // Calculate earliest possible start time based on dependencies
    const earliestStart = dependencies.length > 0 ? 
      Math.max(...dependencies.map(d => d.targetDate.getTime())) :
      milestone.createdAt.getTime();

    // Calculate latest allowable finish time based on dependents  
    const latestFinish = Math.min(...dependents.map(d => d.targetDate.getTime()));

    // Slack time is the difference between when we could finish and when we must finish
    const duration = milestone.targetDate.getTime() - milestone.createdAt.getTime();
    return Math.max(0, latestFinish - earliestStart - duration);
  }

  // -------------------------------------------------------------------------------------
  // BULK OPERATIONS
  // -------------------------------------------------------------------------------------

  async bulkUpdateStatus(milestoneIds: string[], status: MilestoneStatus): Promise<Milestone[]> {
    return this.withErrorHandling(async () => {
      const updates = milestoneIds.map(id => ({ id, status }));
      const results = await Promise.all(
        updates.map(update => this.update(update.id, { status: update.status }))
      );
      
      this.eventManager.emit('milestones:bulk-updated', { milestoneIds, status });
      return results;
    }, 'Failed to bulk update milestone status');
  }

  async bulkUpdateProject(milestoneIds: string[], projectId: string): Promise<Milestone[]> {
    return this.withErrorHandling(async () => {
      const results = await Promise.all(
        milestoneIds.map(id => this.update(id, { projectId }))
      );
      
      this.eventManager.emit('milestones:bulk-updated', { milestoneIds, projectId });
      return results;
    }, 'Failed to bulk update milestone project');
  }

  async bulkDelete(milestoneIds: string[]): Promise<boolean> {
    return this.withErrorHandling(async () => {
      await Promise.all(milestoneIds.map(id => this.delete(id)));
      
      this.eventManager.emit('milestones:bulk-deleted', milestoneIds);
      return true;
    }, 'Failed to bulk delete milestones');
  }
}

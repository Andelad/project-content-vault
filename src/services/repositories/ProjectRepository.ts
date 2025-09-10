/**
 * Project Repository Implementation - Phase 5B
 * 
 * Specialized repository for Project entities with optimized caching,
 * offline support, and project-specific query patterns.
 * 
 * Features:
 * - Intelligent project caching with relationship tracking
 * - Offline-first CRUD operations with milestone coordination
 * - Performance optimization for project workflows
 * - Real-time cross-window project synchronization
 * 
 * @module ProjectRepository
 */

import { UnifiedRepository } from './UnifiedRepository';
import type { Project } from '@/types/core';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import type { SyncResult, ITimestampedRepository } from './IBaseRepository';

type ProjectRow = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

// =====================================================================================
// PROJECT REPOSITORY INTERFACE
// =====================================================================================

export interface IProjectRepository {
  // Base repository methods
  create(entity: Omit<Project, 'id'>): Promise<Project>;
  update(id: string, updates: Partial<Project>): Promise<Project | null>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<Project | null>;
  findAll(): Promise<Project[]>;
  findBy(criteria: Partial<Project>): Promise<Project[]>;
  count(criteria?: Partial<Project>): Promise<number>;
  syncToServer(): Promise<SyncResult>;
  
  // Timestamp methods
  findByCreatedDate(startDate: Date, endDate?: Date): Promise<Project[]>;
  findByUpdatedDate(startDate: Date, endDate?: Date): Promise<Project[]>;
  findRecentlyCreated(hours?: number): Promise<Project[]>;
  findRecentlyUpdated(hours?: number): Promise<Project[]>;
  
  // Project-specific query methods
  findByGroup(groupId: string): Promise<Project[]>;
  findByUser(userId: string, options?: {
    status?: Project['status'];
    groupId?: string;
    continuous?: boolean;
    limit?: number;
  }): Promise<Project[]>;
  findWithMilestoneCounts(userId: string): Promise<Array<Project & { milestoneCount: number }>>;
  validateProjectNameUnique(name: string, userId: string, excludeId?: string): Promise<boolean>;
  getProjectStatistics(userId: string): Promise<{
    totalProjects: number;
    currentProjects: number;
    archivedProjects: number;
    totalEstimatedHours: number;
    avgProjectDuration: number;
  }>;
}

/**
 * Project-specific repository extending UnifiedRepository
 * with optimized patterns for project management workflows
 */
export class ProjectRepository extends UnifiedRepository<Project, string> implements IProjectRepository {
  
  constructor(config?: any) {
    super('projects', {
      cache: {
        maxSize: 1000, // Projects are more numerous and frequently accessed
        ttl: 180000,   // 3 minutes - projects change more frequently than groups
        enabled: true,
        strategy: 'lru',
        compression: false,
        ...(config?.cache || {})
      },
      offline: {
        enabled: true,
        maxOfflineOperations: 100, // More operations for projects
        autoSync: true,
        syncInterval: 20000, // 20 seconds - faster sync for active project management
        conflictResolution: 'server-wins',
        ...(config?.offline || {})
      },
      performance: {
        batchSize: 25,
        maxConcurrentRequests: 5,
        requestTimeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
        ...(config?.performance || {})
      },
      ...config
    });
  }

  // -------------------------------------------------------------------------------------
  // ABSTRACT METHOD IMPLEMENTATIONS
  // -------------------------------------------------------------------------------------
  
  protected async executeCreate(entity: Omit<Project, 'id'>): Promise<Project> {
    const insert: ProjectInsert = {
      name: entity.name,
      client: entity.client,
      start_date: entity.startDate.toISOString(),
      end_date: entity.endDate?.toISOString() || entity.startDate.toISOString(),
      estimated_hours: entity.estimatedHours,
      continuous: entity.continuous || false,
      color: entity.color,
      group_id: entity.groupId,
      row_id: entity.rowId,
      notes: entity.notes || null,
      icon: entity.icon || 'folder',
      auto_estimate_days: entity.autoEstimateDays ? JSON.stringify(entity.autoEstimateDays) : null,
      user_id: await this.getCurrentUserId()
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(insert)
      .select()
      .single();

    if (error) throw error;
    return this.transformFromDb(data);
  }

  protected async executeUpdate(id: string, updates: Partial<Project>): Promise<Project> {
    const update: ProjectUpdate = {
      ...(updates.name && { name: updates.name }),
      ...(updates.client && { client: updates.client }),
      ...(updates.startDate && { start_date: updates.startDate.toISOString() }),
      ...(updates.endDate !== undefined && { end_date: updates.endDate?.toISOString() || new Date().toISOString() }),
      ...(updates.estimatedHours !== undefined && { estimated_hours: updates.estimatedHours }),
      ...(updates.continuous !== undefined && { continuous: updates.continuous }),
      ...(updates.color && { color: updates.color }),
      ...(updates.groupId && { group_id: updates.groupId }),
      ...(updates.rowId && { row_id: updates.rowId }),
      ...(updates.notes !== undefined && { notes: updates.notes || null }),
      ...(updates.icon && { icon: updates.icon }),
      ...(updates.autoEstimateDays && { auto_estimate_days: JSON.stringify(updates.autoEstimateDays) }),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('projects')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.transformFromDb(data);
  }

  protected async executeDelete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  protected async executeFindById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.transformFromDb(data);
  }

  protected async executeFindAll(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => this.transformFromDb(row));
  }

  protected async executeFindBy(criteria: Partial<Project>): Promise<Project[]> {
    let query = supabase.from('projects').select('*');

    if (criteria.name) {
      query = query.eq('name', criteria.name);
    }
    if (criteria.client) {
      query = query.eq('client', criteria.client);
    }
    if (criteria.groupId) {
      query = query.eq('group_id', criteria.groupId);
    }
    if (criteria.rowId) {
      query = query.eq('row_id', criteria.rowId);
    }
    if (criteria.continuous !== undefined) {
      query = query.eq('continuous', criteria.continuous);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => this.transformFromDb(row));
  }

  protected async executeCount(criteria?: Partial<Project>): Promise<number> {
    let query = supabase.from('projects').select('*', { count: 'exact', head: true });

    if (criteria?.name) {
      query = query.eq('name', criteria.name);
    }
    if (criteria?.client) {
      query = query.eq('client', criteria.client);
    }
    if (criteria?.groupId) {
      query = query.eq('group_id', criteria.groupId);
    }
    if (criteria?.rowId) {
      query = query.eq('row_id', criteria.rowId);
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  }

  protected async executeSyncToServer(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      conflictCount: 0,
      errors: [],
      conflicts: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Process offline changes
      for (const change of this.offlineChanges) {
        try {
          switch (change.operation) {
            case 'create':
              if (change.data) {
                await this.executeCreate(change.data as Omit<Project, 'id'>);
                result.syncedCount++;
              }
              break;
            case 'update':
              if (change.data) {
                await this.executeUpdate(change.entityId, change.data);
                result.syncedCount++;
              }
              break;
            case 'delete':
              await this.executeDelete(change.entityId);
              result.syncedCount++;
              break;
          }
          change.synced = true;
        } catch (error) {
          result.errors.push(`Failed to sync ${change.operation} for ${change.entityId}: ${error}`);
        }
      }

      // Remove synced changes
      this.offlineChanges = this.offlineChanges.filter(change => !change.synced);

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  // -------------------------------------------------------------------------------------
  // UTILITY METHODS
  // -------------------------------------------------------------------------------------
  
  private transformFromDb(row: ProjectRow): Project {
    // Compute status based on dates
    const now = new Date();
    const endDate = new Date(row.end_date);
    const startDate = new Date(row.start_date);
    
    let status: Project['status'] = 'current';
    if (startDate > now) {
      status = 'future';
    } else if (endDate < now && !row.continuous) {
      status = 'archived';
    }

    return {
      id: row.id,
      name: row.name,
      client: row.client,
      startDate,
      endDate,
      estimatedHours: row.estimated_hours,
      continuous: row.continuous || false,
      color: row.color,
      groupId: row.group_id,
      rowId: row.row_id,
      notes: row.notes || undefined,
      icon: row.icon || 'folder',
      autoEstimateDays: row.auto_estimate_days ? 
        JSON.parse(typeof row.auto_estimate_days === 'string' ? row.auto_estimate_days : JSON.stringify(row.auto_estimate_days)) : 
        undefined,
      status
    };
  }

  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  // -------------------------------------------------------------------------------------
  // TIMESTAMP REPOSITORY METHODS
  // -------------------------------------------------------------------------------------

  async findByCreatedDate(startDate: Date, endDate?: Date): Promise<Project[]> {
    try {
      let query = supabase.from('projects').select('*');
      
      query = query.gte('created_at', startDate.toISOString());
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(row => this.transformFromDb(row));
    } catch (error) {
      console.error('Error finding projects by created date:', error);
      throw error;
    }
  }

  async findByUpdatedDate(startDate: Date, endDate?: Date): Promise<Project[]> {
    try {
      let query = supabase.from('projects').select('*');
      
      query = query.gte('updated_at', startDate.toISOString());
      if (endDate) {
        query = query.lte('updated_at', endDate.toISOString());
      }
      
      const { data, error } = await query.order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(row => this.transformFromDb(row));
    } catch (error) {
      console.error('Error finding projects by updated date:', error);
      throw error;
    }
  }

  async findRecentlyCreated(hours: number = 24): Promise<Project[]> {
    const cutoffDate = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.findByCreatedDate(cutoffDate);
  }

  async findRecentlyUpdated(hours: number = 24): Promise<Project[]> {
    const cutoffDate = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.findByUpdatedDate(cutoffDate);
  }

  // -------------------------------------------------------------------------------------
  // PROJECT-SPECIFIC QUERY METHODS
  // -------------------------------------------------------------------------------------

  /**
   * Find projects by group with caching
   */
  async findByGroup(groupId: string): Promise<Project[]> {
    const cacheKey = `group:${groupId}`;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const projects = (data || []).map(row => this.transformFromDb(row));
      
      // Cache each project individually
      projects.forEach(project => {
        this.cache.set(`${this.entityType}:${project.id}`, project);
      });
      
      this.eventManager.emit({
        type: 'synced',
        entityType: 'projects',
        entityId: cacheKey,
        timestamp: new Date(),
        metadata: { operation: 'findByGroup', count: projects.length }
      });

      return projects;
    } catch (error) {
      console.error('Error finding projects by group:', error);
      throw error;
    }
  }

  /**
   * Find projects by user with advanced filtering
   */
  async findByUser(userId: string, options?: {
    status?: Project['status'];
    groupId?: string;
    continuous?: boolean;
    limit?: number;
  }): Promise<Project[]> {
    try {
      let query = supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId);

      if (options?.groupId) {
        query = query.eq('group_id', options.groupId);
      }
      if (options?.continuous !== undefined) {
        query = query.eq('continuous', options.continuous);
      }

      query = query.order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      let projects = (data || []).map(row => this.transformFromDb(row));
      
      // Filter by status after transformation since it's computed
      if (options?.status) {
        projects = projects.filter(p => p.status === options.status);
      }
      
      // Cache individual projects
      projects.forEach(project => {
        this.cache.set(`${this.entityType}:${project.id}`, project);
      });

      return projects;
    } catch (error) {
      console.error('Error finding projects by user:', error);
      throw error;
    }
  }

  /**
   * Find projects with milestone counts (for dashboard views)
   */
  async findWithMilestoneCounts(userId: string): Promise<Array<Project & { milestoneCount: number }>> {
    const cacheKey = `user:${userId}:with-milestone-counts`;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          milestones(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const projectsWithCounts = (data || []).map(row => ({
        ...this.transformFromDb(row),
        milestoneCount: Array.isArray(row.milestones) ? row.milestones.length : 0
      }));
      
      // Cache base projects individually
      projectsWithCounts.forEach(project => {
        const baseProject = { ...project };
        delete (baseProject as any).milestoneCount;
        this.cache.set(`${this.entityType}:${project.id}`, baseProject);
      });

      this.eventManager.emit({
        type: 'synced',
        entityType: 'projects',
        entityId: cacheKey,
        timestamp: new Date(),
        metadata: { operation: 'findWithMilestoneCounts', count: projectsWithCounts.length }
      });

      return projectsWithCounts;
    } catch (error) {
      console.error('Error finding projects with milestone counts:', error);
      throw error;
    }
  }

  /**
   * Validate project name uniqueness within user's projects
   */
  async validateProjectNameUnique(name: string, userId: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('projects')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return !data || data.length === 0;
    } catch (error) {
      console.error('Error validating project name uniqueness:', error);
      throw error;
    }
  }

  /**
   * Get project statistics for dashboard
   */
  async getProjectStatistics(userId: string): Promise<{
    totalProjects: number;
    currentProjects: number;
    archivedProjects: number;
    totalEstimatedHours: number;
    avgProjectDuration: number;
  }> {
    try {
      const projects = await this.findByUser(userId);
      
      const now = new Date();
      const currentProjects = projects.filter(p => 
        p.status === 'current' || (p.endDate && p.endDate >= now)
      );
      const archivedProjects = projects.filter(p => p.status === 'archived');
      
      const totalEstimatedHours = projects.reduce((sum, p) => sum + (p.estimatedHours || 0), 0);
      
      // Calculate average project duration for non-continuous projects
      const finiteProjects = projects.filter(p => !p.continuous && p.endDate);
      const avgDuration = finiteProjects.length > 0 
        ? finiteProjects.reduce((sum, p) => {
            const duration = p.endDate!.getTime() - p.startDate.getTime();
            return sum + duration;
          }, 0) / finiteProjects.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      return {
        totalProjects: projects.length,
        currentProjects: currentProjects.length,
        archivedProjects: archivedProjects.length,
        totalEstimatedHours,
        avgProjectDuration: Math.round(avgDuration)
      };
    } catch (error) {
      console.error('Error getting project statistics:', error);
      throw error;
    }
  }
}

// -------------------------------------------------------------------------------------
// SINGLETON INSTANCE
// -------------------------------------------------------------------------------------

/**
 * Singleton instance of ProjectRepository
 */
export const projectRepository = new ProjectRepository();

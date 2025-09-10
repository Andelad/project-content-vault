/**
 * Group Repository Implementation
 * 
 * Specialized repository for Group entities with optimized caching,
 * offline support, and group-specific query patterns.
 * 
 * Features:
 * - Intelligent group caching with dependency tracking
 * - Offline-first CRUD operations
 * - Project relationship management
 * - Performance optimization for group workflows
 * 
 * @module GroupRepository
 */

import { UnifiedRepository } from './UnifiedRepository';
import type { Group } from '@/types/core';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import type { SyncResult } from './IBaseRepository';

type GroupRow = Database['public']['Tables']['groups']['Row'];
type GroupInsert = Database['public']['Tables']['groups']['Insert'];
type GroupUpdate = Database['public']['Tables']['groups']['Update'];

/**
 * Group-specific repository extending UnifiedRepository
 * with optimized patterns for group management workflows
 */
export class GroupRepository extends UnifiedRepository<Group, string> {
  
  constructor() {
    super('groups', {
      cache: {
        maxSize: 200, // Groups are relatively few but frequently accessed
        ttl: 300000,  // 5 minutes - groups change infrequently
        enabled: true,
        strategy: 'lru',
        compression: false
      },
      offline: {
        enabled: true,
        maxOfflineOperations: 50,
        autoSync: true,
        syncInterval: 30000, // 30 seconds
        conflictResolution: 'server-wins'
      },
      performance: {
        batchSize: 20,
        maxConcurrentRequests: 5,
        requestTimeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000
      }
    });
  }

  // -------------------------------------------------------------------------------------
  // ABSTRACT METHOD IMPLEMENTATIONS
  // -------------------------------------------------------------------------------------
  
  protected async executeCreate(entity: Omit<Group, 'id'>): Promise<Group> {
    const insert: GroupInsert = {
      name: entity.name,
      description: entity.description || null,
      color: entity.color,
      user_id: await this.getCurrentUserId()
    };

    const { data, error } = await supabase
      .from('groups')
      .insert(insert)
      .select()
      .single();

    if (error) throw error;
    return this.transformFromDb(data);
  }

  protected async executeUpdate(id: string, updates: Partial<Group>): Promise<Group> {
    const update: GroupUpdate = {
      ...(updates.name && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description || null }),
      ...(updates.color && { color: updates.color }),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('groups')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.transformFromDb(data);
  }

  protected async executeDelete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  protected async executeFindById(id: string): Promise<Group | null> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.transformFromDb(data);
  }

  protected async executeFindAll(): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => this.transformFromDb(row));
  }

  protected async executeFindBy(criteria: Partial<Group>): Promise<Group[]> {
    let query = supabase.from('groups').select('*');

    if (criteria.name) {
      query = query.eq('name', criteria.name);
    }
    if (criteria.color) {
      query = query.eq('color', criteria.color);
    }
    if (criteria.description) {
      query = query.eq('description', criteria.description);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => this.transformFromDb(row));
  }

  protected async executeCount(criteria?: Partial<Group>): Promise<number> {
    let query = supabase.from('groups').select('*', { count: 'exact', head: true });

    if (criteria?.name) {
      query = query.eq('name', criteria.name);
    }
    if (criteria?.color) {
      query = query.eq('color', criteria.color);
    }
    if (criteria?.description) {
      query = query.eq('description', criteria.description);
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
                await this.executeCreate(change.data as Omit<Group, 'id'>);
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
  
  private transformFromDb(row: GroupRow): Group {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      color: row.color
    };
  }

  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  // -------------------------------------------------------------------------------------
  // GROUP-SPECIFIC QUERY METHODS
  // -------------------------------------------------------------------------------------

  /**
   * Find groups by user with caching
   */
  async findByUser(userId: string): Promise<Group[]> {
    const cacheKey = `user:${userId}`;
    
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;

      const groups = (data || []).map(row => this.transformFromDb(row));
      
      // Cache each group individually
      groups.forEach(group => {
        this.cache.set(`${this.entityType}:${group.id}`, group);
      });
      
      this.eventManager.emit({
        type: 'synced',
        entityType: 'groups',
        entityId: cacheKey,
        timestamp: new Date(),
        metadata: { operation: 'findByUser', count: groups.length }
      });

      return groups;
    } catch (error) {
      console.error('Error finding groups by user:', error);
      throw error;
    }
  }

  /**
   * Find groups with project counts (for dashboard views)
   */
  async findWithProjectCounts(userId: string): Promise<Array<Group & { projectCount: number }>> {
    const cacheKey = `user:${userId}:with-counts`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      this.eventManager.emit({
        type: 'synced',
        entityType: 'groups',
        entityId: cacheKey,
        timestamp: new Date(),
        metadata: { cacheHit: true }
      });
      return [cached as Group & { projectCount: number }];
    }

    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          projects(count)
        `)
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;

      const groupsWithCounts = (data || []).map(row => ({
        ...this.transformFromDb(row),
        projectCount: Array.isArray(row.projects) ? row.projects.length : 0
      }));
      
      // Cache the results individually
      groupsWithCounts.forEach(group => {
        const baseGroup = { ...group };
        delete (baseGroup as any).projectCount;
        this.cache.set(`${this.entityType}:${group.id}`, baseGroup);
      });
      
      this.eventManager.emit({
        type: 'synced',
        entityType: 'groups',
        entityId: cacheKey,
        timestamp: new Date(),
        metadata: { cacheMiss: true }
      });

      return groupsWithCounts;
    } catch (error) {
      console.error('Error finding groups with project counts:', error);
      throw error;
    }
  }

  /**
   * Validate group name uniqueness within user's groups
   */
  async validateGroupNameUnique(name: string, userId: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('groups')
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
      console.error('Error validating group name uniqueness:', error);
      throw error;
    }
  }
}

// -------------------------------------------------------------------------------------
// SINGLETON INSTANCE
// -------------------------------------------------------------------------------------

/**
 * Singleton instance of GroupRepository
 */
export const groupRepository = new GroupRepository();

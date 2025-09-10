/**
 * Group Repository Implementation - Simplified Pattern
 * 
 * Simple repository for Group entities following AI Development Rules.
 * Provides essential CRUD operations without over-engineering.
 * 
 * @module GroupRepository
 */

import type { Group } from '@/types/core';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type GroupRow = Database['public']['Tables']['groups']['Row'];
type GroupInsert = Database['public']['Tables']['groups']['Insert'];
type GroupUpdate = Database['public']['Tables']['groups']['Update'];

// =====================================================================================
// DOMAIN/DATABASE TRANSFORMERS
// =====================================================================================

function transformToDomain(dbGroup: GroupRow): Group {
  return {
    id: dbGroup.id,
    name: dbGroup.name,
    color: dbGroup.color,
    description: dbGroup.description || undefined,
    userId: dbGroup.user_id,
    createdAt: new Date(dbGroup.created_at),
    updatedAt: new Date(dbGroup.updated_at)
  };
}

function transformToInsert(group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): GroupInsert {
  return {
    name: group.name,
    color: group.color,
    description: group.description || null,
    user_id: group.userId
  };
}

function transformToUpdate(updates: Partial<Group>): GroupUpdate {
  const dbUpdates: GroupUpdate = {};
  
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.description !== undefined) dbUpdates.description = updates.description || null;
  
  dbUpdates.updated_at = new Date().toISOString();
  
  return dbUpdates;
}

// =====================================================================================
// GROUP REPOSITORY CLASS
// =====================================================================================

export class GroupRepository {
  
  // -------------------------------------------------------------------------------------
  // BASIC CRUD OPERATIONS
  // -------------------------------------------------------------------------------------

  async findById(id: string): Promise<Group | null> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return transformToDomain(data);
  }

  async findAll(): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async findByUser(userId: string): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async create(group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<Group> {
    const dbData = transformToInsert(group);
    
    const { data, error } = await supabase
      .from('groups')
      .insert(dbData)
      .select()
      .single();

    if (error) throw error;
    return transformToDomain(data);
  }

  async update(id: string, updates: Partial<Group>): Promise<Group> {
    const dbUpdates = transformToUpdate(updates);
    
    const { data, error } = await supabase
      .from('groups')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // -------------------------------------------------------------------------------------
  // GROUP-SPECIFIC QUERIES
  // -------------------------------------------------------------------------------------

  async findWithProjectCounts(userId: string): Promise<Array<Group & { projectCount: number }>> {
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        projects(count)
      `)
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      ...transformToDomain(row),
      projectCount: Array.isArray(row.projects) ? row.projects.length : 0
    }));
  }

  async validateGroupNameUnique(name: string, userId: string, excludeId?: string): Promise<boolean> {
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
    
    return (data || []).length === 0;
  }

  async findByCreatedDate(startDate: Date, endDate?: Date): Promise<Group[]> {
    let query = supabase
      .from('groups')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async findByUpdatedDate(startDate: Date, endDate?: Date): Promise<Group[]> {
    let query = supabase
      .from('groups')
      .select('*')
      .gte('updated_at', startDate.toISOString());

    if (endDate) {
      query = query.lte('updated_at', endDate.toISOString());
    }

    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async findRecentlyCreated(hours: number = 24): Promise<Group[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.findByCreatedDate(since);
  }

  async findRecentlyUpdated(hours: number = 24): Promise<Group[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.findByUpdatedDate(since);
  }
}

// =====================================================================================
// SINGLETON EXPORT
// =====================================================================================

export const groupRepository = new GroupRepository();

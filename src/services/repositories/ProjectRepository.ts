/**
 * Project Repository Implementation - Simplified Pattern
 * 
 * Simple repository for Project entities following AI Development Rules.
 * Provides essential CRUD operations without over-engineering.
 * 
 * @module ProjectRepository
 */

import type { Project } from '@/types/core';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type ProjectRow = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

// =====================================================================================
// DOMAIN/DATABASE TRANSFORMERS
// =====================================================================================

function transformToDomain(dbProject: ProjectRow): Project {
  // Compute status based on dates
  const now = new Date();
  const endDate = new Date(dbProject.end_date);
  const startDate = new Date(dbProject.start_date);
  
  let status: Project['status'] = 'current';
  if (startDate > now) {
    status = 'future';
  } else if (endDate < now && !dbProject.continuous) {
    status = 'archived';
  }

  return {
    id: dbProject.id,
    name: dbProject.name,
    client: dbProject.client,
    startDate,
    endDate,
    estimatedHours: dbProject.estimated_hours,
    continuous: dbProject.continuous || false,
    color: dbProject.color,
    groupId: dbProject.group_id,
    rowId: dbProject.row_id,
    notes: dbProject.notes || undefined,
    icon: dbProject.icon || 'folder',
    autoEstimateDays: dbProject.auto_estimate_days ? 
      JSON.parse(typeof dbProject.auto_estimate_days === 'string' ? dbProject.auto_estimate_days : JSON.stringify(dbProject.auto_estimate_days)) : 
      undefined,
    status,
    userId: dbProject.user_id,
    createdAt: new Date(dbProject.created_at),
    updatedAt: new Date(dbProject.updated_at)
  };
}

function transformToInsert(project: Omit<Project, 'id' | 'status' | 'createdAt' | 'updatedAt'>): ProjectInsert {
  return {
    name: project.name,
    client: project.client,
    start_date: project.startDate.toISOString(),
    end_date: project.endDate?.toISOString() || project.startDate.toISOString(),
    estimated_hours: project.estimatedHours,
    continuous: project.continuous || false,
    color: project.color,
    group_id: project.groupId,
    row_id: project.rowId,
    notes: project.notes || null,
    icon: project.icon || 'folder',
    auto_estimate_days: project.autoEstimateDays ? JSON.stringify(project.autoEstimateDays) : null,
    user_id: project.userId
  };
}

function transformToUpdate(updates: Partial<Project>): ProjectUpdate {
  const dbUpdates: ProjectUpdate = {};
  
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.client !== undefined) dbUpdates.client = updates.client;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate.toISOString();
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate?.toISOString() || new Date().toISOString();
  if (updates.estimatedHours !== undefined) dbUpdates.estimated_hours = updates.estimatedHours;
  if (updates.continuous !== undefined) dbUpdates.continuous = updates.continuous;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.groupId !== undefined) dbUpdates.group_id = updates.groupId;
  if (updates.rowId !== undefined) dbUpdates.row_id = updates.rowId;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
  if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
  if (updates.autoEstimateDays !== undefined) dbUpdates.auto_estimate_days = updates.autoEstimateDays ? JSON.stringify(updates.autoEstimateDays) : null;
  
  dbUpdates.updated_at = new Date().toISOString();
  
  return dbUpdates;
}

// =====================================================================================
// PROJECT REPOSITORY CLASS
// =====================================================================================

export class ProjectRepository {
  
  // -------------------------------------------------------------------------------------
  // BASIC CRUD OPERATIONS
  // -------------------------------------------------------------------------------------

  async findById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return transformToDomain(data);
  }

  async findAll(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async findByUser(userId: string, options?: {
    status?: Project['status'];
    groupId?: string;
    continuous?: boolean;
    limit?: number;
  }): Promise<Project[]> {
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

    let projects = (data || []).map(transformToDomain);
    
    // Filter by status after transformation since it's computed
    if (options?.status) {
      projects = projects.filter(p => p.status === options.status);
    }

    return projects;
  }

  async findByGroup(groupId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async create(project: Omit<Project, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const dbData = transformToInsert(project);
    
    const { data, error } = await supabase
      .from('projects')
      .insert(dbData)
      .select()
      .single();

    if (error) throw error;
    return transformToDomain(data);
  }

  async update(id: string, updates: Partial<Project>): Promise<Project> {
    const dbUpdates = transformToUpdate(updates);
    
    const { data, error } = await supabase
      .from('projects')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // -------------------------------------------------------------------------------------
  // PROJECT-SPECIFIC QUERIES
  // -------------------------------------------------------------------------------------

  async findWithMilestoneCounts(userId: string): Promise<Array<Project & { milestoneCount: number }>> {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        milestones(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...transformToDomain(row),
      milestoneCount: Array.isArray(row.milestones) ? row.milestones.length : 0
    }));
  }

  async validateProjectNameUnique(name: string, userId: string, excludeId?: string): Promise<boolean> {
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
    
    return (data || []).length === 0;
  }

  async getProjectStatistics(userId: string): Promise<{
    totalProjects: number;
    currentProjects: number;
    archivedProjects: number;
    totalEstimatedHours: number;
    avgProjectDuration: number;
  }> {
    const projects = await this.findByUser(userId);
    
    const currentProjects = projects.filter(p => p.status === 'current');
    const archivedProjects = projects.filter(p => p.status === 'archived');
    const totalEstimatedHours = projects.reduce((sum, p) => sum + (p.estimatedHours || 0), 0);
    
    // Calculate average project duration for non-continuous projects
    const finiteProjects = projects.filter(p => !p.continuous && p.endDate);
    const avgProjectDuration = finiteProjects.length > 0 
      ? finiteProjects.reduce((sum, p) => {
          const duration = (p.endDate!.getTime() - p.startDate.getTime()) / (1000 * 60 * 60 * 24);
          return sum + duration;
        }, 0) / finiteProjects.length
      : 0;

    return {
      totalProjects: projects.length,
      currentProjects: currentProjects.length,
      archivedProjects: archivedProjects.length,
      totalEstimatedHours,
      avgProjectDuration
    };
  }

  // -------------------------------------------------------------------------------------
  // TIMESTAMP QUERIES
  // -------------------------------------------------------------------------------------

  async findByCreatedDate(startDate: Date, endDate?: Date): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async findByUpdatedDate(startDate: Date, endDate?: Date): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*')
      .gte('updated_at', startDate.toISOString());

    if (endDate) {
      query = query.lte('updated_at', endDate.toISOString());
    }

    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async findRecentlyCreated(hours: number = 24): Promise<Project[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.findByCreatedDate(since);
  }

  async findRecentlyUpdated(hours: number = 24): Promise<Project[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.findByUpdatedDate(since);
  }
}

// =====================================================================================
// SINGLETON EXPORT
// =====================================================================================

export const projectRepository = new ProjectRepository();

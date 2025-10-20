/**
 * Milestone Repository Implementation - Phase 5C
 * 
 * Simple repository for Milestone entities following AI Development Rules.
 * Provides essential CRUD operations without over-engineering.
 * 
 * @module MilestoneRepository
 */

import type { Milestone } from '@/types/core';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type MilestoneRow = Database['public']['Tables']['milestones']['Row'];
type MilestoneInsert = Database['public']['Tables']['milestones']['Insert'];
type MilestoneUpdate = Database['public']['Tables']['milestones']['Update'];

// =====================================================================================
// DOMAIN/DATABASE TRANSFORMERS
// =====================================================================================

function transformToDomain(dbMilestone: MilestoneRow): Milestone {
  const endDate = new Date(dbMilestone.due_date);
  const timeAllocationHours = dbMilestone.time_allocation_hours ?? dbMilestone.time_allocation;
  
  return {
    id: dbMilestone.id,
    name: dbMilestone.name,
    projectId: dbMilestone.project_id,
    
    // PRIMARY FIELDS (forecasting/estimation)
    endDate, // Milestone deadline
    timeAllocationHours, // Hours allocated for day estimates
    startDate: dbMilestone.start_date ? new Date(dbMilestone.start_date) : undefined,
    
    // BACKWARD COMPATIBILITY (legacy code may still read these)
    dueDate: endDate,
    timeAllocation: timeAllocationHours,
    
    // RECURRING PATTERN (virtual instance generation)
    isRecurring: dbMilestone.is_recurring ?? false,
    recurringConfig: dbMilestone.recurring_config as any,
    
    // METADATA
    userId: dbMilestone.user_id,
    createdAt: new Date(dbMilestone.created_at),
    updatedAt: new Date(dbMilestone.updated_at)
  };
}

function transformToInsert(milestone: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): MilestoneInsert {
  const endDate = milestone.endDate || milestone.dueDate;
  const timeAllocationHours = milestone.timeAllocationHours ?? milestone.timeAllocation;
  
  return {
    name: milestone.name,
    project_id: milestone.projectId,
    user_id: milestone.userId,
    
    // PRIMARY FIELDS
    due_date: endDate.toISOString(),
    time_allocation: timeAllocationHours, // Legacy column still in DB
    time_allocation_hours: timeAllocationHours,
    
    // OPTIONAL FIELDS
    start_date: milestone.startDate?.toISOString(),
    is_recurring: milestone.isRecurring ?? false,
    recurring_config: milestone.recurringConfig as any
  };
}

function transformToUpdate(updates: Partial<Milestone>): MilestoneUpdate {
  const dbUpdates: MilestoneUpdate = {};
  
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  
  // DATE UPDATES
  if (updates.dueDate !== undefined || updates.endDate !== undefined) {
    const dateToUse = updates.endDate || updates.dueDate;
    if (dateToUse) dbUpdates.due_date = dateToUse.toISOString();
  }
  
  // TIME ALLOCATION UPDATES
  if (updates.timeAllocation !== undefined || updates.timeAllocationHours !== undefined) {
    const hoursToUse = updates.timeAllocationHours ?? updates.timeAllocation;
    if (hoursToUse !== undefined) {
      dbUpdates.time_allocation = hoursToUse; // Legacy column
      dbUpdates.time_allocation_hours = hoursToUse;
    }
  }
  
  // OPTIONAL FIELDS
  if (updates.startDate !== undefined) {
    dbUpdates.start_date = updates.startDate?.toISOString();
  }
  if (updates.isRecurring !== undefined) {
    dbUpdates.is_recurring = updates.isRecurring;
  }
  if (updates.recurringConfig !== undefined) {
    dbUpdates.recurring_config = updates.recurringConfig as any;
  }
  
  return dbUpdates;
}

// =====================================================================================
// MILESTONE REPOSITORY CLASS
// =====================================================================================

export class MilestoneRepository {
  
  // -------------------------------------------------------------------------------------
  // BASIC CRUD OPERATIONS
  // -------------------------------------------------------------------------------------

  async findById(id: string): Promise<Milestone | null> {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return transformToDomain(data);
  }

  async findByProjectId(projectId: string): Promise<Milestone[]> {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async findByUserId(userId: string): Promise<Milestone[]> {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('user_id', userId)
      .order('due_date');

    if (error) throw error;
    return (data || []).map(transformToDomain);
  }

  async create(milestone: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): Promise<Milestone> {
    const dbData = transformToInsert(milestone);
    
    const { data, error } = await supabase
      .from('milestones')
      .insert(dbData)
      .select()
      .single();

    if (error) throw error;
    return transformToDomain(data);
  }

  async update(id: string, updates: Partial<Milestone>): Promise<Milestone> {
    const dbUpdates = transformToUpdate(updates);
    
    const { data, error } = await supabase
      .from('milestones')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // -------------------------------------------------------------------------------------
  // MILESTONE-SPECIFIC QUERIES
  // -------------------------------------------------------------------------------------

  async validateMilestoneNameUnique(name: string, projectId: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('milestones')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', name);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).length === 0;
  }

  async findProjectMilestoneStats(projectId: string): Promise<{
    totalMilestones: number;
    totalTimeAllocation: number;
    averageTimeAllocation: number;
    earliestDueDate: Date | null;
    latestDueDate: Date | null;
  }> {
    const milestones = await this.findByProjectId(projectId);
    
    if (milestones.length === 0) {
      return {
        totalMilestones: 0,
        totalTimeAllocation: 0,
        averageTimeAllocation: 0,
        earliestDueDate: null,
        latestDueDate: null
      };
    }

    const totalTimeAllocation = milestones.reduce((sum, m) => sum + m.timeAllocation, 0);
    const dueDates = milestones.map(m => m.dueDate).sort((a, b) => a.getTime() - b.getTime());

    return {
      totalMilestones: milestones.length,
      totalTimeAllocation,
      averageTimeAllocation: totalTimeAllocation / milestones.length,
      earliestDueDate: dueDates[0],
      latestDueDate: dueDates[dueDates.length - 1]
    };
  }
}

// =====================================================================================
// SINGLETON EXPORT
// =====================================================================================

export const milestoneRepository = new MilestoneRepository();

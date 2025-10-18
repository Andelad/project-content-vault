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
  return {
    id: dbMilestone.id,
    name: dbMilestone.name,
    projectId: dbMilestone.project_id,
    
    // TIME ALLOCATION: Use new column, fallback to old for backward compatibility
    timeAllocationHours: dbMilestone.time_allocation_hours ?? dbMilestone.time_allocation,
    
    // DATE BOUNDARIES
    startDate: dbMilestone.start_date ? new Date(dbMilestone.start_date) : undefined,
    endDate: new Date(dbMilestone.due_date), // Renamed from dueDate for clarity
    
    // RECURRING PATTERN
    isRecurring: dbMilestone.is_recurring ?? false,
    recurringConfig: dbMilestone.recurring_config ? JSON.parse(JSON.stringify(dbMilestone.recurring_config)) : undefined,
    
    // METADATA
    order: dbMilestone.order_index,
    userId: dbMilestone.user_id,
    createdAt: new Date(dbMilestone.created_at),
    updatedAt: new Date(dbMilestone.updated_at)
  };
}

function transformToInsert(milestone: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): MilestoneInsert {
  return {
    name: milestone.name,
    
    // DUAL-WRITE: Write to both old and new columns for backward compatibility
    time_allocation: milestone.timeAllocationHours, // OLD: For backward compatibility
    time_allocation_hours: milestone.timeAllocationHours, // NEW: Primary column
    
    // DATE BOUNDARIES
    start_date: milestone.startDate?.toISOString(),
    due_date: milestone.endDate.toISOString(), // Keep for backward compatibility
    
    // RECURRING PATTERN
    is_recurring: milestone.isRecurring,
    recurring_config: milestone.recurringConfig ? JSON.parse(JSON.stringify(milestone.recurringConfig)) : null,
    
    // METADATA
    project_id: milestone.projectId,
    order_index: milestone.order,
    user_id: milestone.userId
  };
}

function transformToUpdate(updates: Partial<Milestone>): MilestoneUpdate {
  const dbUpdates: MilestoneUpdate = {};
  
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  
  // DUAL-WRITE: Update both old and new columns
  if (updates.timeAllocationHours !== undefined) {
    dbUpdates.time_allocation = updates.timeAllocationHours; // OLD
    dbUpdates.time_allocation_hours = updates.timeAllocationHours; // NEW
  }
  
  // DATE BOUNDARIES
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate?.toISOString();
  if (updates.endDate !== undefined) dbUpdates.due_date = updates.endDate.toISOString();
  
  // RECURRING PATTERN
  if (updates.isRecurring !== undefined) dbUpdates.is_recurring = updates.isRecurring;
  if (updates.recurringConfig !== undefined) {
    dbUpdates.recurring_config = updates.recurringConfig ? JSON.parse(JSON.stringify(updates.recurringConfig)) : null;
  }
  
  // METADATA
  if (updates.order !== undefined) dbUpdates.order_index = updates.order;
  
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
      .order('order_index');

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
    earliestEndDate: Date | null;
    latestEndDate: Date | null;
  }> {
    const milestones = await this.findByProjectId(projectId);
    
    if (milestones.length === 0) {
      return {
        totalMilestones: 0,
        totalTimeAllocation: 0,
        averageTimeAllocation: 0,
        earliestEndDate: null,
        latestEndDate: null
      };
    }

    const totalTimeAllocation = milestones.reduce((sum, m) => sum + m.timeAllocationHours, 0);
    const endDates = milestones.map(m => m.endDate).sort((a, b) => a.getTime() - b.getTime());

    return {
      totalMilestones: milestones.length,
      totalTimeAllocation,
      averageTimeAllocation: totalTimeAllocation / milestones.length,
      earliestEndDate: endDates[0],
      latestEndDate: endDates[endDates.length - 1]
    };
  }
}

// =====================================================================================
// SINGLETON EXPORT
// =====================================================================================

export const milestoneRepository = new MilestoneRepository();

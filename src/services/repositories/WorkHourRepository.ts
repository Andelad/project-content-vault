/**
 * WorkHour Repository
 * 
 * Simple repository implementation for WorkHour entities following AI Development Rules.
 * Provides essential CRUD operations with domain/database transformations.
 * 
 * Follows established patterns from GroupRepository and ProjectRepository.
 * No over-engineering - keeps complexity low with clean separation of concerns.
 * 
 * @module WorkHourRepository
 */

import { supabase } from '@/integrations/supabase/client';
import type { WorkHour } from '@/types/core';

// =====================================================================================
// DOMAIN/DATABASE TRANSFORMERS
// =====================================================================================

/**
 * Transform database record to domain WorkHour
 */
function transformFromDatabase(dbRecord: any): WorkHour {
  return {
    id: dbRecord.id,
    title: dbRecord.title,
    description: dbRecord.description || '',
    startTime: new Date(dbRecord.start),
    endTime: new Date(dbRecord.end),
    duration: calculateDuration(new Date(dbRecord.start), new Date(dbRecord.end)),
    type: 'work'
  };
}

/**
 * Transform domain WorkHour to database record
 */
function transformToDatabase(workHour: Omit<WorkHour, 'id'> | WorkHour): any {
  return {
    title: workHour.title,
    description: workHour.description,
    start: workHour.startTime.toISOString(),
    end: workHour.endTime.toISOString()
  };
}

/**
 * Calculate duration in hours between two dates
 */
function calculateDuration(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

// =====================================================================================
// WORK HOUR REPOSITORY CLASS
// =====================================================================================

export class WorkHourRepository {
  private static instance: WorkHourRepository;

  private constructor() {}

  static getInstance(): WorkHourRepository {
    if (!WorkHourRepository.instance) {
      WorkHourRepository.instance = new WorkHourRepository();
    }
    return WorkHourRepository.instance;
  }

  // -------------------------------------------------------------------------------------
  // CRUD OPERATIONS
  // -------------------------------------------------------------------------------------

  /**
   * Create new work hour
   */
  async create(workHourData: Omit<WorkHour, 'id'>): Promise<WorkHour> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const dbRecord = {
      ...transformToDatabase(workHourData),
      user_id: user.id
    };

    const { data, error } = await supabase
      .from('work_hours')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error('WorkHourRepository.create failed:', error);
      throw new Error(`Failed to create work hour: ${error.message}`);
    }

    return transformFromDatabase(data);
  }

  /**
   * Get work hour by ID
   */
  async getById(id: string): Promise<WorkHour | null> {
    const { data, error } = await supabase
      .from('work_hours')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No rows returned
      }
      console.error('WorkHourRepository.getById failed:', error);
      throw new Error(`Failed to get work hour: ${error.message}`);
    }

    return transformFromDatabase(data);
  }

  /**
   * Get all work hours for current user
   */
  async getAll(): Promise<WorkHour[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('work_hours')
      .select('*')
      .eq('user_id', user.id)
      .order('start', { ascending: true });

    if (error) {
      console.error('WorkHourRepository.getAll failed:', error);
      throw new Error(`Failed to get work hours: ${error.message}`);
    }

    return data.map(transformFromDatabase);
  }

  /**
   * Get work hours within date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<WorkHour[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('work_hours')
      .select('*')
      .eq('user_id', user.id)
      .gte('start', startDate.toISOString())
      .lte('end', endDate.toISOString())
      .order('start', { ascending: true });

    if (error) {
      console.error('WorkHourRepository.getByDateRange failed:', error);
      throw new Error(`Failed to get work hours by date range: ${error.message}`);
    }

    return data.map(transformFromDatabase);
  }

  /**
   * Update work hour
   */
  async update(id: string, updates: Partial<Omit<WorkHour, 'id'>>): Promise<WorkHour> {
    const dbUpdates = transformToDatabase(updates as WorkHour);

    const { data, error } = await supabase
      .from('work_hours')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('WorkHourRepository.update failed:', error);
      throw new Error(`Failed to update work hour: ${error.message}`);
    }

    return transformFromDatabase(data);
  }

  /**
   * Delete work hour
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('work_hours')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('WorkHourRepository.delete failed:', error);
      throw new Error(`Failed to delete work hour: ${error.message}`);
    }
  }

  /**
   * Delete multiple work hours
   */
  async deleteMultiple(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await supabase
      .from('work_hours')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('WorkHourRepository.deleteMultiple failed:', error);
      throw new Error(`Failed to delete work hours: ${error.message}`);
    }
  }
}

// =====================================================================================
// SINGLETON EXPORT
// =====================================================================================

export const workHourRepository = WorkHourRepository.getInstance();

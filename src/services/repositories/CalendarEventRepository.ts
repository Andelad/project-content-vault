/**
 * CalendarEvent Repository
 * 
 * Simple repository implementation for CalendarEvent entities following AI Development Rules.
 * Provides essential CRUD operations with domain/database transformations.
 * 
 * Follows established patterns from GroupRepository, ProjectRepository, and WorkHourRepository.
 * No over-engineering - keeps complexity low with clean separation of concerns.
 * 
 * @module CalendarEventRepository
 */

import { supabase } from '@/integrations/supabase/client';
import type { CalendarEvent } from '@/types/core';

// =====================================================================================
// DOMAIN/DATABASE TRANSFORMERS
// =====================================================================================

/**
 * Transform database record to domain CalendarEvent
 */
function transformFromDatabase(dbRecord: any): CalendarEvent {
  return {
    id: dbRecord.id,
    title: dbRecord.title,
    description: dbRecord.description || '',
    startTime: new Date(dbRecord.start_time),
    endTime: new Date(dbRecord.end_time),
    projectId: dbRecord.project_id || undefined,
    color: dbRecord.color || '#3b82f6',
    completed: dbRecord.completed || false,
    type: dbRecord.event_type || 'planned'
  };
}

/**
 * Transform domain CalendarEvent to database record
 */
function transformToDatabase(event: Omit<CalendarEvent, 'id'> | CalendarEvent): any {
  return {
    title: event.title,
    description: event.description,
    start_time: event.startTime.toISOString(),
    end_time: event.endTime.toISOString(),
    project_id: event.projectId || null,
    color: event.color,
    completed: event.completed,
    event_type: event.type
  };
}

// =====================================================================================
// CALENDAR EVENT REPOSITORY CLASS
// =====================================================================================

export class CalendarEventRepository {
  private static instance: CalendarEventRepository;

  private constructor() {}

  static getInstance(): CalendarEventRepository {
    if (!CalendarEventRepository.instance) {
      CalendarEventRepository.instance = new CalendarEventRepository();
    }
    return CalendarEventRepository.instance;
  }

  // -------------------------------------------------------------------------------------
  // CRUD OPERATIONS
  // -------------------------------------------------------------------------------------

  /**
   * Create new calendar event
   */
  async create(eventData: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const dbRecord = {
      ...transformToDatabase(eventData),
      user_id: user.id
    };

    const { data, error } = await supabase
      .from('calendar_events')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error('CalendarEventRepository.create failed:', error);
      throw new Error(`Failed to create calendar event: ${error.message}`);
    }

    return transformFromDatabase(data);
  }

  /**
   * Get calendar event by ID
   */
  async getById(id: string): Promise<CalendarEvent | null> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No rows returned
      }
      console.error('CalendarEventRepository.getById failed:', error);
      throw new Error(`Failed to get calendar event: ${error.message}`);
    }

    return transformFromDatabase(data);
  }

  /**
   * Get all calendar events for current user
   */
  async getAll(): Promise<CalendarEvent[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('CalendarEventRepository.getAll failed:', error);
      throw new Error(`Failed to get calendar events: ${error.message}`);
    }

    return data.map(transformFromDatabase);
  }

  /**
   * Get calendar events within date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', startDate.toISOString())
      .lte('end_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('CalendarEventRepository.getByDateRange failed:', error);
      throw new Error(`Failed to get calendar events by date range: ${error.message}`);
    }

    return data.map(transformFromDatabase);
  }

  /**
   * Get calendar events by project ID
   */
  async getByProjectId(projectId: string): Promise<CalendarEvent[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('CalendarEventRepository.getByProjectId failed:', error);
      throw new Error(`Failed to get calendar events by project: ${error.message}`);
    }

    return data.map(transformFromDatabase);
  }

  /**
   * Get tracking events (time tracking entries)  
   */
  async getTrackingEvents(): Promise<CalendarEvent[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('event_type', 'tracked')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('CalendarEventRepository.getTrackingEvents failed:', error);
      throw new Error(`Failed to get tracking events: ${error.message}`);
    }

    return data.map(transformFromDatabase);
  }

  /**
   * Update calendar event
   */
  async update(id: string, updates: Partial<Omit<CalendarEvent, 'id'>>): Promise<CalendarEvent> {
    const dbUpdates = transformToDatabase(updates as CalendarEvent);

    const { data, error } = await supabase
      .from('calendar_events')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('CalendarEventRepository.update failed:', error);
      throw new Error(`Failed to update calendar event: ${error.message}`);
    }

    return transformFromDatabase(data);
  }

  /**
   * Delete calendar event
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('CalendarEventRepository.delete failed:', error);
      throw new Error(`Failed to delete calendar event: ${error.message}`);
    }
  }

  /**
   * Delete multiple calendar events
   */
  async deleteMultiple(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('CalendarEventRepository.deleteMultiple failed:', error);
      throw new Error(`Failed to delete calendar events: ${error.message}`);
    }
  }
}

// =====================================================================================
// SINGLETON EXPORT
// =====================================================================================

export const calendarEventRepository = CalendarEventRepository.getInstance();

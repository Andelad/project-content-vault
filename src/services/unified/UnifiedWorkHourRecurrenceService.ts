/**
 * Unified Work Hour Recurrence Service
 * 
 * Handles work hour recurrence patterns and individual day exceptions.
 * Similar to UnifiedRRuleService but specialized for work hours.
 * 
 * Architecture:
 * - Base patterns stored in settings.weekly_work_hours (e.g., Mon-Fri 9-5)
 * - Exceptions stored in work_hour_exceptions table for specific dates
 * - Work hours generate infinitely from pattern + apply exceptions
 * - Follows same edit patterns as RRULE events (this day, all future, all)
 * 
 * USE WHEN:
 * - Creating/updating work hour exceptions for a specific date
 * - Fetching exceptions to apply to generated work hours
 * - Deleting work hours for a specific day
 * - Editing work hours from planner (creates exception)
 * - Editing work hours from settings (updates pattern)
 */

import { WorkHourException, WorkSlot, Settings } from '@/types/core';
import { supabase } from '@/integrations/supabase/client';
import { ErrorHandlingService } from '../infrastructure/ErrorHandlingService';

export interface CreateWorkHourExceptionParams {
  exceptionDate: Date;
  dayOfWeek: string;
  slotId: string;
  exceptionType: 'deleted' | 'modified';
  modifiedStartTime?: string; // HH:MM
  modifiedEndTime?: string; // HH:MM
}

/**
 * Create a work hour exception for a specific date
 * Used when user edits "this day only" from planner
 */
export async function createWorkHourException(
  params: CreateWorkHourExceptionParams
): Promise<{ success: boolean; exception?: WorkHourException; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { exceptionDate, dayOfWeek, slotId, exceptionType, modifiedStartTime, modifiedEndTime } = params;

    // Format date as YYYY-MM-DD for database
    const dateStr = exceptionDate.toISOString().split('T')[0];

    const exceptionData = {
      user_id: user.id,
      exception_date: dateStr,
      day_of_week: dayOfWeek,
      slot_id: slotId,
      exception_type: exceptionType,
      modified_start_time: modifiedStartTime || null,
      modified_end_time: modifiedEndTime || null,
    };

    // Upsert to handle updating existing exceptions
    const { data, error } = await supabase
      .from('work_hour_exceptions' as any)
      .upsert(exceptionData, {
        onConflict: 'user_id,exception_date,slot_id'
      })
      .select()
      .single();

    if (error) throw error;

    const exception: WorkHourException = {
      id: (data as any).id,
      userId: (data as any).user_id,
      exceptionDate: new Date((data as any).exception_date),
      dayOfWeek: (data as any).day_of_week,
      slotId: (data as any).slot_id,
      exceptionType: (data as any).exception_type,
      modifiedStartTime: (data as any).modified_start_time,
      modifiedEndTime: (data as any).modified_end_time,
      createdAt: new Date((data as any).created_at),
      updatedAt: new Date((data as any).updated_at),
    };

    return { success: true, exception };
  } catch (error) {
    ErrorHandlingService.handle(error, { 
      source: 'UnifiedWorkHourRecurrenceService',
      action: 'createWorkHourException' 
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create work hour exception' 
    };
  }
}

/**
 * Fetch all work hour exceptions for the current user
 * Used when generating work hours to apply exceptions
 */
export async function getWorkHourExceptions(
  startDate?: Date,
  endDate?: Date
): Promise<{ success: boolean; exceptions?: WorkHourException[]; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    let query = supabase
      .from('work_hour_exceptions' as any)
      .select('*')
      .eq('user_id', user.id);

    // Add date range filters if provided
    if (startDate) {
      const startStr = startDate.toISOString().split('T')[0];
      query = query.gte('exception_date', startStr);
    }
    if (endDate) {
      const endStr = endDate.toISOString().split('T')[0];
      query = query.lte('exception_date', endStr);
    }

    const { data, error } = await query;

    if (error) throw error;

    const exceptions: WorkHourException[] = (data || []).map((e: any) => ({
      id: e.id,
      userId: e.user_id,
      exceptionDate: new Date(e.exception_date),
      dayOfWeek: e.day_of_week,
      slotId: e.slot_id,
      exceptionType: e.exception_type,
      modifiedStartTime: e.modified_start_time,
      modifiedEndTime: e.modified_end_time,
      createdAt: new Date(e.created_at),
      updatedAt: new Date(e.updated_at),
    }));

    return { success: true, exceptions };
  } catch (error) {
    ErrorHandlingService.handle(error, { 
      source: 'UnifiedWorkHourRecurrenceService',
      action: 'getWorkHourExceptions' 
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch work hour exceptions' 
    };
  }
}

/**
 * Delete a work hour for a specific date
 * Creates a "deleted" exception
 */
export async function deleteWorkHourForDate(
  date: Date,
  dayOfWeek: string,
  slotId: string
): Promise<{ success: boolean; error?: string }> {
  return createWorkHourException({
    exceptionDate: date,
    dayOfWeek,
    slotId,
    exceptionType: 'deleted',
  });
}

/**
 * Update a work hour for a specific date
 * Creates a "modified" exception
 */
export async function updateWorkHourForDate(
  date: Date,
  dayOfWeek: string,
  slotId: string,
  newStartTime: string,
  newEndTime: string
): Promise<{ success: boolean; error?: string }> {
  return createWorkHourException({
    exceptionDate: date,
    dayOfWeek,
    slotId,
    exceptionType: 'modified',
    modifiedStartTime: newStartTime,
    modifiedEndTime: newEndTime,
  });
}

/**
 * Delete a specific exception (restore to pattern)
 */
export async function deleteWorkHourException(
  exceptionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('work_hour_exceptions' as any)
      .delete()
      .eq('id', exceptionId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    ErrorHandlingService.handle(error, { 
      source: 'UnifiedWorkHourRecurrenceService',
      action: 'deleteWorkHourException' 
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete work hour exception' 
    };
  }
}

/**
 * Delete all exceptions for a specific date (restore entire day to pattern)
 */
export async function deleteAllExceptionsForDate(
  date: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const dateStr = date.toISOString().split('T')[0];

    const { error } = await supabase
      .from('work_hour_exceptions' as any)
      .delete()
      .eq('user_id', user.id)
      .eq('exception_date', dateStr);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    ErrorHandlingService.handle(error, { 
      source: 'UnifiedWorkHourRecurrenceService',
      action: 'deleteAllExceptionsForDate' 
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete exceptions for date' 
    };
  }
}

/**
 * Delete all future exceptions from a date (used when updating pattern going forward)
 */
export async function deleteAllFutureExceptions(
  fromDate: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const dateStr = fromDate.toISOString().split('T')[0];

    const { error } = await supabase
      .from('work_hour_exceptions' as any)
      .delete()
      .eq('user_id', user.id)
      .gte('exception_date', dateStr);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    ErrorHandlingService.handle(error, { 
      source: 'UnifiedWorkHourRecurrenceService',
      action: 'deleteAllFutureExceptions' 
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete future exceptions' 
    };
  }
}

/**
 * Check if a work hour has an exception for a specific date
 */
export function hasException(
  exceptions: WorkHourException[],
  date: Date,
  slotId: string
): WorkHourException | undefined {
  const dateStr = date.toISOString().split('T')[0];
  return exceptions.find(e => 
    e.exceptionDate.toISOString().split('T')[0] === dateStr &&
    e.slotId === slotId
  );
}

/**
 * Apply exceptions to generated work hours
 * Filters deleted exceptions and modifies time for modified exceptions
 */
export function applyExceptionsToWorkHours(
  workHours: any[],
  exceptions: WorkHourException[]
): any[] {
  if (!exceptions || exceptions.length === 0) {
    return workHours;
  }

  return workHours
    .map(wh => {
      const exception = hasException(exceptions, new Date(wh.startTime), wh.slotId);
      
      if (!exception) {
        return wh; // No exception, return as-is
      }

      if (exception.exceptionType === 'deleted') {
        return null; // Mark for deletion
      }

      // Apply modified times
      if (exception.exceptionType === 'modified' && exception.modifiedStartTime && exception.modifiedEndTime) {
        const date = new Date(wh.startTime);
        const [startHour, startMin] = exception.modifiedStartTime.split(':').map(Number);
        const [endHour, endMin] = exception.modifiedEndTime.split(':').map(Number);

        const newStartTime = new Date(date);
        newStartTime.setHours(startHour, startMin, 0, 0);

        const newEndTime = new Date(date);
        newEndTime.setHours(endHour, endMin, 0, 0);

        return {
          ...wh,
          startTime: newStartTime,
          endTime: newEndTime,
          duration: (newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60 * 60),
          isException: true,
        };
      }

      return wh;
    })
    .filter(wh => wh !== null); // Remove deleted work hours
}

// Export service object
export const UnifiedWorkHourRecurrenceService = {
  createWorkHourException,
  getWorkHourExceptions,
  deleteWorkHourForDate,
  updateWorkHourForDate,
  deleteWorkHourException,
  deleteAllExceptionsForDate,
  deleteAllFutureExceptions,
  hasException,
  applyExceptionsToWorkHours,
};

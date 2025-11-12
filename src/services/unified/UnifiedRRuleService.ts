/**
 * Unified RRULE Service
 * Handles conversion between old recurring format and RRULE format
 * Manages recurring event exceptions (edited/deleted instances)
 */

import { CalendarEvent } from '@/types/core';
import { supabase } from '@/integrations/supabase/client';
import { ErrorHandlingService } from '../infrastructure/ErrorHandlingService';

export interface RRuleConfig {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  until?: Date; // End date for recurrence
  count?: number; // Number of occurrences
  byDay?: string[]; // For weekly: ['MO', 'TU', etc.]
  byMonthDay?: number; // For monthly by date (1-31)
  bySetPos?: number; // For monthly by day position (1st, 2nd, etc.)
}

export interface EventException {
  id: string;
  masterEventId: string;
  exceptionDate: Date;
  exceptionType: 'deleted' | 'modified';
  modifiedData?: Partial<CalendarEvent>;
}

/**
 * Convert RRuleConfig to RRULE string
 */
export function buildRRuleString(config: RRuleConfig): string {
  const parts: string[] = [];
  
  parts.push(`FREQ=${config.freq}`);
  parts.push(`INTERVAL=${config.interval}`);
  
  if (config.until) {
    const untilStr = config.until.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    parts.push(`UNTIL=${untilStr}`);
  }
  
  if (config.count) {
    parts.push(`COUNT=${config.count}`);
  }
  
  if (config.byDay && config.byDay.length > 0) {
    parts.push(`BYDAY=${config.byDay.join(',')}`);
  }
  
  if (config.byMonthDay) {
    parts.push(`BYMONTHDAY=${config.byMonthDay}`);
  }
  
  if (config.bySetPos) {
    parts.push(`BYSETPOS=${config.bySetPos}`);
  }
  
  return parts.join(';');
}

/**
 * Parse RRULE string to RRuleConfig
 */
export function parseRRuleString(rrule: string): RRuleConfig | null {
  try {
    const parts = rrule.split(';');
    const config: Partial<RRuleConfig> = {};
    
    for (const part of parts) {
      const [key, value] = part.split('=');
      
      switch (key) {
        case 'FREQ':
          config.freq = value as RRuleConfig['freq'];
          break;
        case 'INTERVAL':
          config.interval = parseInt(value, 10);
          break;
        case 'UNTIL':
          config.until = new Date(
            value.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
          );
          break;
        case 'COUNT':
          config.count = parseInt(value, 10);
          break;
        case 'BYDAY':
          config.byDay = value.split(',');
          break;
        case 'BYMONTHDAY':
          config.byMonthDay = parseInt(value, 10);
          break;
        case 'BYSETPOS':
          config.bySetPos = parseInt(value, 10);
          break;
      }
    }
    
    return config as RRuleConfig;
  } catch (error) {
    ErrorHandlingService.handle(error, {
      source: 'UnifiedRRuleService',
      action: 'parseRRuleString'
    });
    return null;
  }
}

/**
 * Convert legacy recurring event data to RRULE
 */
export function convertLegacyToRRule(
  recurringType: 'daily' | 'weekly' | 'monthly' | 'yearly',
  interval: number = 1,
  endDate?: Date,
  count?: number
): string {
  const config: RRuleConfig = {
    freq: recurringType.toUpperCase() as RRuleConfig['freq'],
    interval,
    until: endDate,
    count
  };
  
  return buildRRuleString(config);
}

/**
 * Create an exception for a recurring event instance
 */
export async function createEventException(
  masterEventId: string,
  exceptionDate: Date,
  exceptionType: 'deleted' | 'modified',
  modifiedData?: Partial<CalendarEvent>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { error } = await supabase
      .from('calendar_event_exceptions')
      .insert({
        user_id: user.id,
        master_event_id: masterEventId,
        exception_date: exceptionDate.toISOString().split('T')[0],
        exception_type: exceptionType,
        modified_data: modifiedData ? JSON.stringify(modifiedData) : null
      });
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    ErrorHandlingService.handle(error, {
      source: 'UnifiedRRuleService',
      action: 'createEventException'
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create exception' 
    };
  }
}

/**
 * Get all exceptions for a recurring event
 */
export async function getEventExceptions(masterEventId: string): Promise<EventException[]> {
  try {
    const { data, error } = await supabase
      .from('calendar_event_exceptions')
      .select('*')
      .eq('master_event_id', masterEventId);
    
    if (error) throw error;
    
    return (data || []).map(ex => ({
      id: ex.id,
      masterEventId: ex.master_event_id,
      exceptionDate: new Date(ex.exception_date),
      exceptionType: ex.exception_type as 'deleted' | 'modified',
      modifiedData: ex.modified_data ? JSON.parse(ex.modified_data as string) : undefined
    }));
  } catch (error) {
    ErrorHandlingService.handle(error, {
      source: 'UnifiedRRuleService',
      action: 'getEventExceptions'
    });
    return [];
  }
}

/**
 * Delete a single instance of a recurring event
 */
export async function deleteRecurringInstance(
  masterEventId: string,
  instanceDate: Date
): Promise<{ success: boolean; error?: string }> {
  return createEventException(masterEventId, instanceDate, 'deleted');
}

/**
 * Delete all future instances of a recurring event
 */
export async function deleteRecurringFutureInstances(
  masterEventId: string,
  fromDate: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: masterEvent, error: fetchError } = await supabase
      .from('calendar_events')
      .select('rrule')
      .eq('id', masterEventId)
      .single();
    
    if (fetchError) throw fetchError;
    if (!masterEvent?.rrule) throw new Error('Event is not recurring');
    
    // Parse existing RRULE
    const config = parseRRuleString(masterEvent.rrule);
    if (!config) throw new Error('Invalid RRULE format');
    
    // Add UNTIL clause to end recurrence before fromDate
    config.until = new Date(fromDate);
    config.until.setDate(config.until.getDate() - 1); // End one day before
    delete config.count; // Remove COUNT if present
    
    // Update the master event with new RRULE
    const newRRule = buildRRuleString(config);
    const { error: updateError } = await supabase
      .from('calendar_events')
      .update({ rrule: newRRule })
      .eq('id', masterEventId);
    
    if (updateError) throw updateError;
    
    return { success: true };
  } catch (error) {
    ErrorHandlingService.handle(error, {
      source: 'UnifiedRRuleService',
      action: 'deleteRecurringFutureInstances'
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete future instances' 
    };
  }
}

/**
 * Update a single instance of a recurring event
 */
export async function updateRecurringInstance(
  masterEventId: string,
  instanceDate: Date,
  updates: Partial<CalendarEvent>
): Promise<{ success: boolean; error?: string }> {
  return createEventException(masterEventId, instanceDate, 'modified', updates);
}

/**
 * Update all instances of a recurring event
 */
export async function updateRecurringAllInstances(
  masterEventId: string,
  updates: Partial<CalendarEvent>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('calendar_events')
      .update({
        title: updates.title,
        description: updates.description,
        color: updates.color,
        project_id: updates.projectId || null,
        // Don't update times/dates for all instances - that would break the recurrence
      })
      .eq('id', masterEventId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    ErrorHandlingService.handle(error, {
      source: 'UnifiedRRuleService',
      action: 'updateRecurringAllInstances'
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update all instances' 
    };
  }
}

/**
 * Update all future instances of a recurring event
 */
export async function updateRecurringFutureInstances(
  masterEventId: string,
  fromDate: Date,
  updates: Partial<CalendarEvent>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // First, end the current series before fromDate
    const result = await deleteRecurringFutureInstances(masterEventId, fromDate);
    if (!result.success) throw new Error(result.error);
    
    // Then create a new series starting from fromDate
    const { data: masterEvent, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', masterEventId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const { error: insertError } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        title: updates.title || masterEvent.title,
        description: updates.description ?? masterEvent.description,
        start_time: fromDate.toISOString(),
        end_time: new Date(fromDate.getTime() + 
          (new Date(masterEvent.end_time).getTime() - new Date(masterEvent.start_time).getTime())
        ).toISOString(),
        color: updates.color || masterEvent.color,
        project_id: updates.projectId ?? masterEvent.project_id,
        rrule: masterEvent.rrule,
        event_type: masterEvent.event_type,
        category: masterEvent.category
      });
    
    if (insertError) throw insertError;
    
    return { success: true };
  } catch (error) {
    ErrorHandlingService.handle(error, {
      source: 'UnifiedRRuleService',
      action: 'updateRecurringFutureInstances'
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update future instances' 
    };
  }
}

export const UnifiedRRuleService = {
  buildRRuleString,
  parseRRuleString,
  convertLegacyToRRule,
  createEventException,
  getEventExceptions,
  deleteRecurringInstance,
  deleteRecurringFutureInstances,
  updateRecurringInstance,
  updateRecurringAllInstances,
  updateRecurringFutureInstances
};

/**
 * Recurring Events Orchestrator
 * Handles database operations and maintenance of recurring calendar event series
 * 
 * Migrated from utils/recurringEventsMaintenance
 * Following AI Development Rules - orchestrators handle multi-step processes with database operations
 */

import { CalendarEvent } from '@/types/core';
import { supabase } from '@/integrations/supabase/client';
import { generateRecurringEvents } from '@/domain/rules/events/EventCalculations';
import { addDaysToDate } from '@/utils/dateCalculations';
import { ErrorHandlingService } from '@/infrastructure/ErrorHandlingService';

/**
 * Checks if a recurring series needs more events generated and creates them if necessary
 * This should be called periodically or when viewing future dates
 */
export async function ensureRecurringEventsExist(
  groupId: string,
  originalEvent: CalendarEvent,
  lookAheadMonths: number = 6
): Promise<number> {
  try {
    // Get all existing events in this recurring group
    const { data: existingEvents, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('recurring_group_id', groupId)
      .order('start_time', { ascending: true });

    if (error) throw error;

    if (!existingEvents || existingEvents.length === 0) {
      return 0;
    }

    // Find the last event in the series
    const lastEvent = existingEvents[existingEvents.length - 1];
    const lastEventDate = new Date(lastEvent.start_time);

    // Calculate the target date (look ahead)
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + lookAheadMonths);

    // If the last event is already beyond our look-ahead period, no need to generate more
    if (lastEventDate >= targetDate) {
      return 0;
    }

    // Reconstruct the original recurring configuration
    // We'll use the pattern from existing events to determine the recurrence
    if (existingEvents.length < 2) {
      // Can't determine pattern with only one event
      return 0;
    }

    const firstEvent = existingEvents[0];
    const secondEvent = existingEvents[1];
    
    const firstDate = new Date(firstEvent.start_time);
    const secondDate = new Date(secondEvent.start_time);
    const diffMs = secondDate.getTime() - firstDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // Determine recurrence type and interval
    let recurringType: 'daily' | 'weekly' | 'monthly' | 'yearly';
    let interval: number;

    if (diffDays === 1) {
      recurringType = 'daily';
      interval = 1;
    } else if (diffDays === 7) {
      recurringType = 'weekly';
      interval = 1;
    } else if (diffDays % 7 === 0) {
      recurringType = 'weekly';
      interval = diffDays / 7;
    } else if (diffDays >= 28 && diffDays <= 31) {
      recurringType = 'monthly';
      interval = 1;
    } else if (diffDays >= 365 && diffDays <= 366) {
      recurringType = 'yearly';
      interval = 1;
    } else {
      recurringType = 'daily';
      interval = diffDays;
    }

    // Create a mock recurring event data to generate more events
    const mockEventData: Omit<CalendarEvent, 'id'> = {
      title: lastEvent.title,
      description: lastEvent.description || '',
      startTime: lastEventDate,
      endTime: new Date(lastEvent.end_time),
      projectId: lastEvent.project_id,
      color: lastEvent.color,
      completed: false,
      duration: lastEvent.duration || 0,
      type: (lastEvent.event_type as 'planned' | 'tracked' | 'completed') || 'planned',
      recurring: {
        type: recurringType,
        interval,
        // Generate enough events to reach the target date
        count: calculateEventsNeeded(lastEventDate, targetDate, recurringType, interval)
      }
    };

    // Generate new events starting from the next occurrence after the last event
    const nextOccurrenceDate = calculateNextOccurrence(lastEventDate, recurringType, interval);
    mockEventData.startTime = nextOccurrenceDate;
    mockEventData.endTime = new Date(nextOccurrenceDate.getTime() + 
      (new Date(lastEvent.end_time).getTime() - lastEventDate.getTime()));

    const { events: newEvents } = generateRecurringEvents(mockEventData);

    // Insert new events into the database
    let createdCount = 0;
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('User not authenticated');

    for (const event of newEvents) {
      const { error: insertError } = await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          title: event.title,
          description: event.description || '',
          start_time: event.startTime.toISOString(),
          end_time: event.endTime.toISOString(),
          project_id: event.projectId || null,
          color: event.color,
          completed: event.completed || false,
          duration: event.duration || 0,
          event_type: event.type || 'planned',
          recurring_group_id: groupId,
          recurring_type: null,
          recurring_interval: null,
          recurring_end_date: null,
          recurring_count: null
        });

      if (!insertError) {
        createdCount++;
      }
    }

    return createdCount;
  } catch (error) {
    ErrorHandlingService.handle(error, { source: 'recurringEventsOrchestrator', action: 'Error ensuring recurring events exist:' });
    return 0;
  }
}

function calculateNextOccurrence(
  date: Date, 
  type: 'daily' | 'weekly' | 'monthly' | 'yearly', 
  interval: number
): Date {
  let nextDate = new Date(date);
  
  switch (type) {
    case 'daily':
      nextDate = addDaysToDate(nextDate, interval);
      break;
    case 'weekly':
      nextDate = addDaysToDate(nextDate, 7 * interval);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      break;
  }
  
  return nextDate;
}

function calculateEventsNeeded(
  startDate: Date,
  targetDate: Date,
  type: 'daily' | 'weekly' | 'monthly' | 'yearly',
  interval: number
): number {
  const diffMs = targetDate.getTime() - startDate.getTime();
  
  switch (type) {
    case 'daily':
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * interval));
    case 'weekly':
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7 * interval));
    case 'monthly':
      // Approximate - will be adjusted by actual date calculations
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30 * interval));
    case 'yearly':
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 365 * interval));
    default:
      return 10; // Fallback
  }
}

/**
 * Checks all recurring series and ensures they have sufficient future events
 * This can be called on app startup or periodically
 */
export async function ensureAllRecurringSeriesHaveEvents(): Promise<void> {
  try {
    // Get all distinct recurring group IDs
    const { data: groupIds, error } = await supabase
      .from('calendar_events')
      .select('recurring_group_id')
      .not('recurring_group_id', 'is', null)
      .order('recurring_group_id');

    if (error) throw error;

    const uniqueGroupIds = [...new Set(groupIds?.map(g => g.recurring_group_id) || [])];

    for (const groupId of uniqueGroupIds) {
      if (groupId) {
        // Get the first event of this group to use as the template
        const { data: firstEvent, error: eventError } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('recurring_group_id', groupId)
          .order('start_time', { ascending: true })
          .limit(1)
          .single();

        if (eventError || !firstEvent) continue;

        const calendarEvent: CalendarEvent = {
          id: firstEvent.id,
          title: firstEvent.title,
          description: firstEvent.description || '',
          startTime: new Date(firstEvent.start_time),
          endTime: new Date(firstEvent.end_time),
          projectId: firstEvent.project_id,
          color: firstEvent.color,
          completed: firstEvent.completed || false,
          duration: firstEvent.duration || 0,
          type: (firstEvent.event_type as 'planned' | 'tracked' | 'completed') || 'planned'
        };

        await ensureRecurringEventsExist(groupId, calendarEvent);
      }
    }
  } catch (error) {
    ErrorHandlingService.handle(error, { source: 'recurringEventsOrchestrator', action: 'Error ensuring all recurring series have events:' });
  }
}

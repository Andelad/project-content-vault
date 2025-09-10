import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CalendarEvent, Holiday } from '@/types';
import { useEvents } from '@/hooks/useEvents';
import { useHolidays } from '@/hooks/useHolidays';
import { useWorkHours } from '@/hooks/useWorkHours';
import { EventInput } from '@fullcalendar/core';

// Try direct import from the specific file instead of barrel export
console.log('🔍 Attempting to import PlannerV2CalculationService...');
import { PlannerV2CalculationService } from '@/services/calculations/plannerCalculations';

import { supabase } from '@/integrations/supabase/client';
import { generateRecurringEvents } from '@/services';
import { ensureRecurringEventsExist } from '@/services';

interface PlannerContextType {
  // Calendar Events
  events: CalendarEvent[];
  isEventsLoading: boolean;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<CalendarEvent>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  
  // Recurring Events
  getRecurringGroupEvents: (eventId: string) => Promise<CalendarEvent[]>;
  deleteRecurringSeriesFuture: (eventId: string) => Promise<void>;
  deleteRecurringSeriesAll: (eventId: string) => Promise<void>;
  updateRecurringSeriesFuture: (eventId: string, updates: Partial<CalendarEvent>) => Promise<void>;
  updateRecurringSeriesAll: (eventId: string, updates: Partial<CalendarEvent>) => Promise<void>;
  
  // Holidays
  holidays: Holiday[];
  isHolidaysLoading: boolean;
  addHoliday: (holiday: any) => Promise<any>;
  updateHoliday: (id: string, updates: any, options?: { silent?: boolean }) => Promise<any>;
  deleteHoliday: (id: string) => Promise<any>;
  creatingNewHoliday: { startDate: Date; endDate: Date } | null;
  setCreatingNewHoliday: (creating: { startDate: Date; endDate: Date } | null) => void;
  editingHolidayId: string | null;
  setEditingHolidayId: (holidayId: string | null) => void;
  
  // Work Hours
  workHours: any[];
  isWorkHoursLoading: boolean;
  
  // UI State
  selectedEventId: string | null;
  setSelectedEventId: (eventId: string | null) => void;
  creatingNewEvent: { startTime?: Date; endTime?: Date } | null;
  setCreatingNewEvent: (times: { startTime: Date; endTime: Date } | null) => void;
  
  // Undo functionality
  lastAction: {
    type: 'update' | 'create' | 'delete';
    eventId: string;
    previousState?: Partial<CalendarEvent>;
    event?: CalendarEvent;
  } | null;
  undoLastAction: () => Promise<void>;
  
  // Enhanced event functions with undo tracking
  updateEventWithUndo: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEventWithUndo: (id: string) => Promise<void>;
  
  // PlannerV2 Specific
  layerMode: 'events' | 'work-hours' | 'both';
  setLayerMode: (mode: 'events' | 'work-hours' | 'both') => void;
  currentView: 'week' | 'day';
  setCurrentView: (view: 'week' | 'day') => void;
  
  // FullCalendar Events
  fullCalendarEvents: EventInput[];
  
  // Method to get styled events with project context
  getStyledFullCalendarEvents: (options: { selectedEventId?: string | null; projects?: any[] }) => EventInput[];
  
  // Method to ensure recurring events exist for future viewing
  ensureEventsForDateRange: (startDate: Date, endDate: Date) => Promise<void>;
  
  // Utility functions
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventsInDateRange: (startDate: Date, endDate: Date) => CalendarEvent[];
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  // Database hooks
  const { 
    events: dbEvents, 
    loading: eventsLoading, 
    addEvent: dbAddEventOriginal, 
    updateEvent: dbUpdateEvent, 
    deleteEvent: dbDeleteEvent,
    refetch: refetchEvents
  } = useEvents();
  
  const { 
    holidays: dbHolidays, 
    loading: holidaysLoading,
    addHoliday,
    updateHoliday,
    deleteHoliday
  } = useHolidays();

  const { 
    workHours, 
    loading: workHoursLoading 
  } = useWorkHours();

  // UI state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [creatingNewEvent, setCreatingNewEvent] = useState<{ startTime?: Date; endTime?: Date } | null>(null);
  const [layerMode, setLayerMode] = useState<'events' | 'work-hours' | 'both'>('both');
  const [currentView, setCurrentView] = useState<'week' | 'day'>('week');
  
  // Holiday UI state
  const [creatingNewHoliday, setCreatingNewHoliday] = useState<{ startDate: Date; endDate: Date } | null>(null);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);

  // Enhanced addEvent function to handle recurring events
  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>): Promise<CalendarEvent> => {
    if (event.recurring) {
      // Generate all recurring events
      const { events: recurringEvents, groupId } = generateRecurringEvents(event);
      
      // Create the first event immediately for instant feedback
      const firstRecurringEvent = recurringEvents[0];
      const firstDbEvent = {
        title: firstRecurringEvent.title,
        description: firstRecurringEvent.description,
        start_time: firstRecurringEvent.startTime.toISOString(),
        end_time: firstRecurringEvent.endTime.toISOString(),
        project_id: firstRecurringEvent.projectId,
        color: firstRecurringEvent.color,
        completed: firstRecurringEvent.completed,
        duration: firstRecurringEvent.duration,
        event_type: firstRecurringEvent.type || 'planned',
        recurring_group_id: groupId,
        recurring_type: event.recurring?.type,
        recurring_interval: event.recurring?.interval,
        recurring_end_date: event.recurring?.endDate?.toISOString(),
        recurring_count: event.recurring?.count
      };
      
      const createdFirstEvent = await dbAddEventOriginal(firstDbEvent);
      
      // Create remaining events in background if there are any
      if (recurringEvents.length > 1) {
        // Process remaining events asynchronously without blocking
        setTimeout(async () => {
          try {
            for (let i = 1; i < recurringEvents.length; i++) {
              const recurringEvent = recurringEvents[i];
              const dbEvent = {
                title: recurringEvent.title,
                description: recurringEvent.description,
                start_time: recurringEvent.startTime.toISOString(),
                end_time: recurringEvent.endTime.toISOString(),
                project_id: recurringEvent.projectId,
                color: recurringEvent.color,
                completed: recurringEvent.completed,
                duration: recurringEvent.duration,
                event_type: recurringEvent.type || 'planned',
                recurring_group_id: groupId
              };
              
              await dbAddEventOriginal(dbEvent, { silent: true });
            }
            
            // Refresh events after all are created
            await refetchEvents();
          } catch (error) {
            console.error('Error creating additional recurring events:', error);
          }
        }, 100); // Small delay to allow UI to update
      }
      
      // Return the first event immediately
      return {
        id: createdFirstEvent.id,
        title: createdFirstEvent.title,
        description: createdFirstEvent.description || '',
        startTime: new Date(createdFirstEvent.start_time),
        endTime: new Date(createdFirstEvent.end_time),
        projectId: createdFirstEvent.project_id,
        color: createdFirstEvent.color,
        completed: createdFirstEvent.completed || false,
        duration: createdFirstEvent.duration || 0,
        type: (createdFirstEvent.event_type as 'planned' | 'tracked' | 'completed') || 'planned',
        recurring: event.recurring
      };
    } else {
      // Handle single events as before
      const dbEvent = {
        title: event.title,
        description: event.description,
        start_time: event.startTime.toISOString(),
        end_time: event.endTime.toISOString(),
        project_id: event.projectId,
        color: event.color,
        completed: event.completed,
        duration: event.duration,
        event_type: event.type || 'planned'
      };
      const createdEvent = await dbAddEventOriginal(dbEvent);
      
      return {
        id: createdEvent.id,
        title: createdEvent.title,
        description: createdEvent.description || '',
        startTime: new Date(createdEvent.start_time),
        endTime: new Date(createdEvent.end_time),
        projectId: createdEvent.project_id,
        color: createdEvent.color,
        completed: createdEvent.completed || false,
        duration: createdEvent.duration || 0,
        type: (createdEvent.event_type as 'planned' | 'tracked' | 'completed') || 'planned'
      };
    }
  }, [dbAddEventOriginal, refetchEvents]);
  
  // Undo state
  const [lastAction, setLastAction] = useState<{
    type: 'update' | 'create' | 'delete';
    eventId: string;
    previousState?: Partial<CalendarEvent>;
    event?: CalendarEvent;
  } | null>(null);

  // Process events (convert database format to frontend format)
  const processedEvents: CalendarEvent[] = useMemo(() => {
    return (dbEvents || []).map(event => ({
      id: event.id,
      title: event.title,
      description: event.description || '',
      startTime: new Date(event.start_time),
      endTime: new Date(event.end_time),
      projectId: event.project_id,
      color: event.color,
      completed: event.completed || false,
      duration: event.duration || 0,
      type: (event.event_type as 'planned' | 'tracked' | 'completed') || 'planned',
      recurring: event.recurring_type ? {
        type: event.recurring_type as 'daily' | 'weekly' | 'monthly' | 'yearly',
        interval: event.recurring_interval || 1,
        endDate: event.recurring_end_date ? new Date(event.recurring_end_date) : undefined,
        count: event.recurring_count || undefined
      } : undefined
    }));
  }, [dbEvents]);

  // Process holidays
  const processedHolidays: Holiday[] = useMemo(() => {
    return (dbHolidays || []).map(holiday => ({
      id: holiday.id,
      title: holiday.title,
      startDate: holiday.startDate, // Already transformed by useHolidays hook
      endDate: holiday.endDate,     // Already transformed by useHolidays hook
      notes: holiday.notes || ''
    }));
  }, [dbHolidays]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime.toISOString();
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime.toISOString();
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
    if (updates.type !== undefined) dbUpdates.event_type = updates.type;
    
    await dbUpdateEvent(id, dbUpdates, options);
  }, [dbUpdateEvent]);

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    await dbDeleteEvent(id);
  }, [dbDeleteEvent]);

  // Utility functions
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    return PlannerV2CalculationService.getEventsForDate(processedEvents, date);
  }, [processedEvents]);

  const getEventsInDateRange = useCallback((startDate: Date, endDate: Date): CalendarEvent[] => {
    return PlannerV2CalculationService.filterEventsByDateRange(processedEvents, startDate, endDate);
  }, [processedEvents]);

  // Undo functionality
  const undoLastAction = useCallback(async (): Promise<void> => {
    if (!lastAction) return;

    try {
      switch (lastAction.type) {
        case 'update':
          if (lastAction.previousState) {
            await updateEvent(lastAction.eventId, lastAction.previousState, { silent: true });
          }
          break;
        case 'create':
          await deleteEvent(lastAction.eventId);
          break;
        case 'delete':
          if (lastAction.event) {
            const { id, ...eventData } = lastAction.event;
            await addEvent(eventData);
          }
          break;
      }
      setLastAction(null);
    } catch (error) {
      console.error('Failed to undo action:', error);
    }
  }, [lastAction, updateEvent, deleteEvent, addEvent]);

  const updateEventWithUndo = useCallback(async (id: string, updates: Partial<CalendarEvent>): Promise<void> => {
    const existingEvent = processedEvents.find(e => e.id === id);
    if (existingEvent) {
      // Store previous state for undo
      setLastAction({
        type: 'update',
        eventId: id,
        previousState: {
          startTime: existingEvent.startTime,
          endTime: existingEvent.endTime,
          title: existingEvent.title,
          description: existingEvent.description,
          projectId: existingEvent.projectId,
          color: existingEvent.color,
          completed: existingEvent.completed,
          duration: existingEvent.duration,
          type: existingEvent.type
        }
      });
    }
    
    await updateEvent(id, updates);
  }, [processedEvents, updateEvent]);

  const deleteEventWithUndo = useCallback(async (id: string): Promise<void> => {
    const existingEvent = processedEvents.find(e => e.id === id);
    if (existingEvent) {
      // Store event for undo
      setLastAction({
        type: 'delete',
        eventId: id,
        event: existingEvent
      });
    }
    
    await deleteEvent(id);
  }, [processedEvents, deleteEvent]);

  // Recurring Events
  const getRecurringGroupEvents = useCallback(async (eventId: string): Promise<CalendarEvent[]> => {
    try {
      // First, get the target event from the database to find its recurring_group_id
      const { data: targetEventData, error: targetError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (targetError || !targetEventData || !targetEventData.recurring_group_id) {
        // If no recurring group ID, this is not a recurring event
        const targetEvent = processedEvents.find(e => e.id === eventId);
        return targetEvent ? [targetEvent] : [];
      }

      // Find all events with the same recurring_group_id
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('recurring_group_id', targetEventData.recurring_group_id)
        .order('start_time', { ascending: true });

      if (error) throw error;

      return (data || []).map(event => ({
        id: event.id,
        title: event.title,
        description: event.description || '',
        startTime: new Date(event.start_time),
        endTime: new Date(event.end_time),
        projectId: event.project_id,
        color: event.color,
        completed: event.completed || false,
        duration: event.duration || 0,
        type: (event.event_type as 'planned' | 'tracked' | 'completed') || 'planned',
        recurring: event.recurring_type ? {
          type: event.recurring_type as 'daily' | 'weekly' | 'monthly' | 'yearly',
          interval: event.recurring_interval || 1,
          endDate: event.recurring_end_date ? new Date(event.recurring_end_date) : undefined,
          count: event.recurring_count || undefined
        } : undefined
      }));
    } catch (error) {
      console.error('Error getting recurring group events:', error);
      return [];
    }
  }, [processedEvents]);

  const deleteRecurringSeriesFuture = useCallback(async (eventId: string): Promise<void> => {
    try {
      // First, get the target event from the database to find its recurring_group_id
      const { data: targetEventData, error: targetError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (targetError || !targetEventData || !targetEventData.recurring_group_id) {
        // If no recurring group ID, just delete the single event
        const { error } = await supabase
          .from('calendar_events')
          .delete()
          .eq('id', eventId);
        if (error) throw error;
        
        // Refresh the events list to reflect the changes
        await refetchEvents();
        return;
      }

      // Delete this event and all future events in the series
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('recurring_group_id', targetEventData.recurring_group_id)
        .gte('start_time', targetEventData.start_time);

      if (error) throw error;
      
      // Refresh the events list to reflect the changes
      await refetchEvents();
    } catch (error) {
      console.error('Error deleting future recurring events:', error);
      throw error;
    }
  }, [refetchEvents]);

  const deleteRecurringSeriesAll = useCallback(async (eventId: string): Promise<void> => {
    try {
      // First, get the target event from the database to find its recurring_group_id
      const { data: targetEventData, error: targetError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (targetError || !targetEventData || !targetEventData.recurring_group_id) {
        // If no recurring group ID, just delete the single event
        const { error } = await supabase
          .from('calendar_events')
          .delete()
          .eq('id', eventId);
        if (error) throw error;
        
        // Refresh the events list to reflect the changes
        await refetchEvents();
        return;
      }

      // Delete all events in the series
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('recurring_group_id', targetEventData.recurring_group_id);

      if (error) throw error;
      
      // Refresh the events list to reflect the changes
      await refetchEvents();
    } catch (error) {
      console.error('Error deleting all recurring events:', error);
      throw error;
    }
  }, [refetchEvents]);

  const updateRecurringSeriesFuture = useCallback(async (eventId: string, updates: Partial<CalendarEvent>): Promise<void> => {
    try {
      // First, get the target event from the database to find its recurring_group_id
      const { data: targetEventData, error: targetError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (targetError || !targetEventData || !targetEventData.recurring_group_id) {
        // If no recurring group ID, just update the single event
        const { error } = await supabase
          .from('calendar_events')
          .update({
            title: updates.title,
            description: updates.description,
            project_id: updates.projectId,
            color: updates.color,
            completed: updates.completed,
            duration: updates.duration,
            event_type: updates.type
          })
          .eq('id', eventId);
        if (error) throw error;
        
        // Refresh the events list to reflect the changes
        await refetchEvents();
        return;
      }

      // Update this event and all future events in the series
      const { error } = await supabase
        .from('calendar_events')
        .update({
          title: updates.title,
          description: updates.description,
          project_id: updates.projectId,
          color: updates.color,
          completed: updates.completed,
          duration: updates.duration,
          event_type: updates.type
        })
        .eq('recurring_group_id', targetEventData.recurring_group_id)
        .gte('start_time', targetEventData.start_time);

      if (error) throw error;
      
      // Refresh the events list to reflect the changes
      await refetchEvents();
    } catch (error) {
      console.error('Error updating future recurring events:', error);
      throw error;
    }
  }, [refetchEvents]);

  const updateRecurringSeriesAll = useCallback(async (eventId: string, updates: Partial<CalendarEvent>): Promise<void> => {
    try {
      // First, get the target event from the database to find its recurring_group_id
      const { data: targetEventData, error: targetError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (targetError || !targetEventData || !targetEventData.recurring_group_id) {
        // If no recurring group ID, just update the single event
        const { error } = await supabase
          .from('calendar_events')
          .update({
            title: updates.title,
            description: updates.description,
            project_id: updates.projectId,
            color: updates.color,
            completed: updates.completed,
            duration: updates.duration,
            event_type: updates.type
          })
          .eq('id', eventId);
        if (error) throw error;
        
        // Refresh the events list to reflect the changes
        await refetchEvents();
        return;
      }

      // Update all events in the series
      const { error } = await supabase
        .from('calendar_events')
        .update({
          title: updates.title,
          description: updates.description,
          project_id: updates.projectId,
          color: updates.color,
          completed: updates.completed,
          duration: updates.duration,
          event_type: updates.type
        })
        .eq('recurring_group_id', targetEventData.recurring_group_id);

      if (error) throw error;
      
      // Refresh the events list to reflect the changes
      await refetchEvents();
    } catch (error) {
      console.error('Error updating all recurring events:', error);
      throw error;
    }
  }, [refetchEvents]);

  // Prepare FullCalendar events
  const fullCalendarEvents = useMemo(() => {
    return PlannerV2CalculationService.prepareEventsForFullCalendar(
      processedEvents,
      workHours || [],
      layerMode
    );
  }, [processedEvents, workHours, layerMode]);

  // Method to get styled events with project context
  const getStyledFullCalendarEvents = useCallback((options: { selectedEventId?: string | null; projects?: any[] } = {}) => {
    return PlannerV2CalculationService.prepareEventsForFullCalendar(
      processedEvents,
      workHours || [],
      layerMode,
      options
    );
  }, [processedEvents, workHours, layerMode]);

  // Method to ensure recurring events exist for future dates
  const ensureEventsForDateRange = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      // Get all recurring groups that might need more events
      const { data: recurringGroups, error } = await supabase
        .from('calendar_events')
        .select('recurring_group_id')
        .not('recurring_group_id', 'is', null)
        .not('recurring_type', 'is', null);

      if (error || !recurringGroups) return;

      const uniqueGroupIds = [...new Set(recurringGroups.map(g => g.recurring_group_id))];
      
      // For each group, ensure events exist up to the end date
      for (const groupId of uniqueGroupIds) {
        if (groupId) {
          try {
            const { data: firstEvent } = await supabase
              .from('calendar_events')
              .select('*')
              .eq('recurring_group_id', groupId)
              .order('start_time', { ascending: true })
              .limit(1)
              .single();

            if (firstEvent) {
              await ensureRecurringEventsExist(groupId, {
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
              }, 3); // Look ahead 3 months
            }
          } catch (err) {
            console.warn('Failed to ensure events for group', groupId, err);
          }
        }
      }
      
      // Refresh events after generating new ones
      await refetchEvents();
    } catch (error) {
      console.warn('Failed to ensure recurring events exist:', error);
    }
  }, [refetchEvents]);

  const contextValue: PlannerContextType = {
    // Calendar Events
    events: processedEvents,
    isEventsLoading: eventsLoading,
    addEvent,
    updateEvent,
    deleteEvent,
    
    // Recurring Events
    getRecurringGroupEvents,
    deleteRecurringSeriesFuture,
    deleteRecurringSeriesAll,
    updateRecurringSeriesFuture,
    updateRecurringSeriesAll,
    
    // Holidays
    holidays: processedHolidays,
    isHolidaysLoading: holidaysLoading,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    creatingNewHoliday,
    setCreatingNewHoliday,
    editingHolidayId,
    setEditingHolidayId,
    
    // Work Hours
    workHours: workHours || [],
    isWorkHoursLoading: workHoursLoading,
    
    // UI State
    selectedEventId,
    setSelectedEventId,
    creatingNewEvent,
    setCreatingNewEvent,
    
    // Undo functionality
    lastAction,
    undoLastAction,
    updateEventWithUndo,
    deleteEventWithUndo,
    
    // PlannerV2 Specific
    layerMode,
    setLayerMode,
    currentView,
    setCurrentView,
    
    // FullCalendar Events
    fullCalendarEvents,
    
    // Method to get styled events with project context
    getStyledFullCalendarEvents,
    
    // Method to ensure recurring events exist for future viewing
    ensureEventsForDateRange,
    
    // Utility functions
    getEventsForDate,
    getEventsInDateRange
  };

  return (
    <PlannerContext.Provider value={contextValue}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlannerContext() {
  const context = useContext(PlannerContext);
  if (context === undefined) {
    throw new Error('usePlannerContext must be used within a PlannerProvider');
  }
  return context;
}

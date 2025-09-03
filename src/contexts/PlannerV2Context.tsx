import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CalendarEvent, Holiday } from '@/types';
import { useEvents } from '@/hooks/useEvents';
import { useHolidays } from '@/hooks/useHolidays';
import { useWorkHours } from '@/hooks/useWorkHours';
import { EventInput } from '@fullcalendar/core';
import { PlannerV2CalculationService } from '@/services';

interface PlannerV2ContextType {
  // Calendar Events
  events: CalendarEvent[];
  isEventsLoading: boolean;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<CalendarEvent>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  
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
  
  // Utility functions
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventsInDateRange: (startDate: Date, endDate: Date) => CalendarEvent[];
}

const PlannerV2Context = createContext<PlannerV2ContextType | undefined>(undefined);

export function PlannerV2Provider({ children }: { children: React.ReactNode }) {
  // Database hooks
  const { 
    events: dbEvents, 
    loading: eventsLoading, 
    addEvent: dbAddEvent, 
    updateEvent: dbUpdateEvent, 
    deleteEvent: dbDeleteEvent 
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

  // Event management functions
  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>): Promise<CalendarEvent> => {
    const dbEvent = {
      title: event.title,
      description: event.description,
      start_time: event.startTime.toISOString(),
      end_time: event.endTime.toISOString(),
      project_id: event.projectId,
      color: event.color,
      completed: event.completed,
      duration: event.duration,
      event_type: event.type || 'planned',
      recurring_type: event.recurring?.type,
      recurring_interval: event.recurring?.interval,
      recurring_end_date: event.recurring?.endDate?.toISOString(),
      recurring_count: event.recurring?.count
    };
    const createdEvent = await dbAddEvent(dbEvent);
    
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
      type: (createdEvent.event_type as 'planned' | 'tracked' | 'completed') || 'planned',
      recurring: createdEvent.recurring_type ? {
        type: createdEvent.recurring_type as 'daily' | 'weekly' | 'monthly' | 'yearly',
        interval: createdEvent.recurring_interval || 1,
        endDate: createdEvent.recurring_end_date ? new Date(createdEvent.recurring_end_date) : undefined,
        count: createdEvent.recurring_count || undefined
      } : undefined
    };
  }, [dbAddEvent]);

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

  const contextValue: PlannerV2ContextType = {
    // Calendar Events
    events: processedEvents,
    isEventsLoading: eventsLoading,
    addEvent,
    updateEvent,
    deleteEvent,
    
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
    
    // Utility functions
    getEventsForDate,
    getEventsInDateRange
  };

  return (
    <PlannerV2Context.Provider value={contextValue}>
      {children}
    </PlannerV2Context.Provider>
  );
}

export function usePlannerV2Context() {
  const context = useContext(PlannerV2Context);
  if (context === undefined) {
    throw new Error('usePlannerV2Context must be used within a PlannerV2Provider');
  }
  return context;
}

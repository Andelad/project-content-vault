import React, { createContext, useContext, useCallback, useState, useMemo } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { useHolidays } from '@/hooks/useHolidays';
import { CalendarEvent, Holiday } from '@/types/core';
import type { Database } from '@/integrations/supabase/types';

interface PlannerContextType {
  // Calendar Events
  events: CalendarEvent[];
  isEventsLoading: boolean;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<CalendarEvent>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  
  // Holidays
  holidays: Holiday[];
  isHolidaysLoading: boolean;
  addHoliday: (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateHoliday: (id: string, updates: Partial<Holiday>, options?: { silent?: boolean }) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
  
  // UI State for modals
  selectedEventId: string | null;
  setSelectedEventId: (eventId: string | null) => void;
  creatingNewEvent: { startTime?: Date; endTime?: Date } | null;
  setCreatingNewEvent: (times: { startTime: Date; endTime: Date } | null) => void;
  creatingNewHoliday: { startDate: Date; endDate: Date } | null;
  setCreatingNewHoliday: (creating: { startDate: Date; endDate: Date } | null) => void;
  editingHolidayId: string | null;
  setEditingHolidayId: (holidayId: string | null) => void;
  
  // Planner Utilities
  getEventsForDate: (date: Date) => CalendarEvent[];
  getHolidaysForDate: (date: Date) => Holiday[];
  getEventsInDateRange: (startDate: Date, endDate: Date) => CalendarEvent[];
  
  // Recurring Event Management
  getRecurringGroupEvents: (eventId: string) => Promise<CalendarEvent[]>;
  deleteRecurringSeriesFuture: (eventId: string) => Promise<void>;
  deleteRecurringSeriesAll: (eventId: string) => Promise<void>;
  getHolidaysInDateRange: (startDate: Date, endDate: Date) => Holiday[];
  isWorkingDay: (date: Date) => boolean;
  ensureRecurringEvents: () => Promise<void>;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
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
    addHoliday: dbAddHoliday, 
    updateHoliday: dbUpdateHoliday, 
    deleteHoliday: dbDeleteHoliday 
  } = useHolidays();

  // UI state for modals and selection
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [creatingNewEvent, setCreatingNewEvent] = useState<{ startTime?: Date; endTime?: Date } | null>(null);
  const [creatingNewHoliday, setCreatingNewHoliday] = useState<{ startDate: Date; endDate: Date } | null>(null);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);

  // Transform database events to match AppContext format
  const processedEvents = useMemo(() => dbEvents?.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description || '',
    startTime: new Date(e.start_time),
    endTime: new Date(e.end_time),
    projectId: e.project_id,
    color: e.color,
    completed: e.completed || false,
    duration: e.duration || 0,
    type: (e.event_type as 'planned' | 'tracked' | 'completed') || 'planned',
    recurring: e.recurring_type ? {
      type: e.recurring_type as 'daily' | 'weekly' | 'monthly' | 'yearly',
      interval: e.recurring_interval || 1,
      endDate: e.recurring_end_date ? new Date(e.recurring_end_date) : undefined,
      count: e.recurring_count || undefined
    } : undefined
  })) || [], [dbEvents]);

  // Transform database holidays to match AppContext format  
  const processedHolidays = useMemo(() => dbHolidays?.map(h => ({
    id: h.id,
    title: h.title,
    startDate: new Date(h.start_date),
    endDate: new Date(h.end_date),
    notes: h.notes || ''
  })) || [], [dbHolidays]);

  // Wrapped functions to match expected signatures and handle type transformations
  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>): Promise<CalendarEvent> => {
    // Transform camelCase to snake_case for database
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
    
    // Transform the created event back to frontend format
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
    // Transform camelCase to snake_case for database
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
    if (updates.recurring !== undefined) {
      dbUpdates.recurring_type = updates.recurring?.type;
      dbUpdates.recurring_interval = updates.recurring?.interval;
      dbUpdates.recurring_end_date = updates.recurring?.endDate?.toISOString();
      dbUpdates.recurring_count = updates.recurring?.count;
    }
    
    await dbUpdateEvent(id, dbUpdates, options);
  }, [dbUpdateEvent]);

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    await dbDeleteEvent(id);
  }, [dbDeleteEvent]);

  const addHoliday = useCallback(async (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>): Promise<void> => {
    // Transform camelCase to snake_case for database
    const dbHoliday = {
      title: holiday.title,
      start_date: holiday.startDate.toISOString().split('T')[0], // Just the date part
      end_date: holiday.endDate.toISOString().split('T')[0], // Just the date part
      notes: holiday.notes
    };
    await dbAddHoliday(dbHoliday);
  }, [dbAddHoliday]);

  const updateHoliday = useCallback(async (id: string, updates: Partial<Holiday>, options: { silent?: boolean } = {}): Promise<void> => {
    // Transform camelCase to snake_case for database
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate.toISOString().split('T')[0];
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate.toISOString().split('T')[0];
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    
    await dbUpdateHoliday(id, dbUpdates, options);
  }, [dbUpdateHoliday]);

  const deleteHoliday = useCallback(async (id: string): Promise<void> => {
    await dbDeleteHoliday(id);
  }, [dbDeleteHoliday]);

  // Recurring events management
  const ensureRecurringEvents = useCallback(async (): Promise<void> => {
    // TODO: Implement recurring events logic
    // For now, this is a placeholder
  }, []);

  // Utility functions
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split('T')[0];
    return processedEvents.filter(event => {
      const eventStartDate = event.startTime.toISOString().split('T')[0];
      const eventEndDate = event.endTime.toISOString().split('T')[0];
      return dateStr >= eventStartDate && dateStr <= eventEndDate;
    });
  }, [processedEvents]);

  const getHolidaysForDate = useCallback((date: Date): Holiday[] => {
    const dateStr = date.toISOString().split('T')[0];
    return processedHolidays.filter(holiday => {
      const holidayStartDate = holiday.startDate.toISOString().split('T')[0];
      const holidayEndDate = holiday.endDate.toISOString().split('T')[0];
      return dateStr >= holidayStartDate && dateStr <= holidayEndDate;
    });
  }, [processedHolidays]);

  const getEventsInDateRange = useCallback((startDate: Date, endDate: Date): CalendarEvent[] => {
    return processedEvents.filter(event => {
      const eventStart = event.startTime;
      const eventEnd = event.endTime;
      return (eventStart <= endDate && eventEnd >= startDate);
    });
  }, [processedEvents]);

  const getHolidaysInDateRange = useCallback((startDate: Date, endDate: Date): Holiday[] => {
    return processedHolidays.filter(holiday => {
      const holidayStart = holiday.startDate;
      const holidayEnd = holiday.endDate;
      return (holidayStart <= endDate && holidayEnd >= startDate);
    });
  }, [processedHolidays]);

  const isWorkingDay = useCallback((date: Date): boolean => {
    // Check if it's a weekend
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
    
    // Check if it's a holiday
    const holidaysOnDate = getHolidaysForDate(date);
    const isHoliday = holidaysOnDate.length > 0;
    
    return !isWeekend && !isHoliday;
  }, [getHolidaysForDate]);

  // Recurring event functions (simplified implementations for now)
  const getRecurringGroupEvents = useCallback(async (eventId: string): Promise<CalendarEvent[]> => {
    // TODO: Implement proper recurring group logic
    const event = processedEvents.find(e => e.id === eventId);
    return event ? [event] : [];
  }, [processedEvents]);

  const deleteRecurringSeriesFuture = useCallback(async (eventId: string): Promise<void> => {
    // TODO: Implement proper recurring deletion logic
    await dbDeleteEvent(eventId);
  }, [dbDeleteEvent]);

  const deleteRecurringSeriesAll = useCallback(async (eventId: string): Promise<void> => {
    // TODO: Implement proper recurring deletion logic
    await dbDeleteEvent(eventId);
  }, [dbDeleteEvent]);

  const contextValue: PlannerContextType = {
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
    
    // UI State for modals
    selectedEventId,
    setSelectedEventId,
    creatingNewEvent,
    setCreatingNewEvent,
    creatingNewHoliday,
    setCreatingNewHoliday,
    editingHolidayId,
    setEditingHolidayId,
    
    // Planner Utilities
    getEventsForDate,
    getHolidaysForDate,
    getEventsInDateRange,
    getHolidaysInDateRange,
    isWorkingDay,
    ensureRecurringEvents,
    
    // Recurring Event Management
    getRecurringGroupEvents,
    deleteRecurringSeriesFuture,
    deleteRecurringSeriesAll,
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

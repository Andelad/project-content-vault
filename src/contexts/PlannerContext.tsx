import React, { createContext, useContext, useCallback } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { useHolidays } from '@/hooks/useHolidays';
import type { Database } from '@/integrations/supabase/types';

type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
type Holiday = Database['public']['Tables']['holidays']['Row'];

interface PlannerContextType {
  // Calendar Events
  events: CalendarEvent[];
  isEventsLoading: boolean;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  
  // Holidays
  holidays: Holiday[];
  isHolidaysLoading: boolean;
  addHoliday: (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateHoliday: (id: string, updates: Partial<Holiday>) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
  
  // Planner Utilities
  getEventsForDate: (date: Date) => CalendarEvent[];
  getHolidaysForDate: (date: Date) => Holiday[];
  getEventsInDateRange: (startDate: Date, endDate: Date) => CalendarEvent[];
  getHolidaysInDateRange: (startDate: Date, endDate: Date) => Holiday[];
  isWorkingDay: (date: Date) => boolean;
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

  // Wrapped functions to match expected signatures
  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>): Promise<void> => {
    await dbAddEvent(event);
  }, [dbAddEvent]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>): Promise<void> => {
    await dbUpdateEvent(id, updates);
  }, [dbUpdateEvent]);

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    await dbDeleteEvent(id);
  }, [dbDeleteEvent]);

  const addHoliday = useCallback(async (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>): Promise<void> => {
    await dbAddHoliday(holiday);
  }, [dbAddHoliday]);

  const updateHoliday = useCallback(async (id: string, updates: Partial<Holiday>): Promise<void> => {
    await dbUpdateHoliday(id, updates);
  }, [dbUpdateHoliday]);

  const deleteHoliday = useCallback(async (id: string): Promise<void> => {
    await dbDeleteHoliday(id);
  }, [dbDeleteHoliday]);

  // Utility functions
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split('T')[0];
    return (dbEvents || []).filter(event => {
      const eventStartDate = new Date(event.start_time).toISOString().split('T')[0];
      const eventEndDate = new Date(event.end_time).toISOString().split('T')[0];
      return dateStr >= eventStartDate && dateStr <= eventEndDate;
    });
  }, [dbEvents]);

  const getHolidaysForDate = useCallback((date: Date): Holiday[] => {
    const dateStr = date.toISOString().split('T')[0];
    return (dbHolidays || []).filter(holiday => {
      const holidayStartDate = new Date(holiday.start_date).toISOString().split('T')[0];
      const holidayEndDate = new Date(holiday.end_date).toISOString().split('T')[0];
      return dateStr >= holidayStartDate && dateStr <= holidayEndDate;
    });
  }, [dbHolidays]);

  const getEventsInDateRange = useCallback((startDate: Date, endDate: Date): CalendarEvent[] => {
    return (dbEvents || []).filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      return (eventStart <= endDate && eventEnd >= startDate);
    });
  }, [dbEvents]);

  const getHolidaysInDateRange = useCallback((startDate: Date, endDate: Date): Holiday[] => {
    return (dbHolidays || []).filter(holiday => {
      const holidayStart = new Date(holiday.start_date);
      const holidayEnd = new Date(holiday.end_date);
      return (holidayStart <= endDate && holidayEnd >= startDate);
    });
  }, [dbHolidays]);

  const isWorkingDay = useCallback((date: Date): boolean => {
    // Check if it's a weekend
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
    
    // Check if it's a holiday
    const holidaysOnDate = getHolidaysForDate(date);
    const isHoliday = holidaysOnDate.length > 0;
    
    return !isWeekend && !isHoliday;
  }, [getHolidaysForDate]);

  const contextValue: PlannerContextType = {
    // Calendar Events
    events: dbEvents || [],
    isEventsLoading: eventsLoading,
    addEvent,
    updateEvent,
    deleteEvent,
    
    // Holidays
    holidays: dbHolidays || [],
    isHolidaysLoading: holidaysLoading,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    
    // Planner Utilities
    getEventsForDate,
    getHolidaysForDate,
    getEventsInDateRange,
    getHolidaysInDateRange,
    isWorkingDay,
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

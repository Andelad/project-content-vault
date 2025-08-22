import React, { createContext, useContext, useState, useCallback } from 'react';
import { CalendarEvent, Holiday } from '@/types/core';
import { useEvents } from '@/hooks/useEvents';
import { useHolidays } from '@/hooks/useHolidays';

interface CalendarContextType {
  // Events
  events: any[];
  addEvent: (event: any) => Promise<any>;
  updateEvent: (id: string, updates: any, options?: { silent?: boolean }) => void;
  deleteEvent: (id: string) => void;
  
  // Holidays
  holidays: any[];
  addHoliday: (holiday: any) => void;
  updateHoliday: (id: string, updates: any) => void;
  deleteHoliday: (id: string) => void;
  
  // Selection state
  selectedEventId: string | null;
  setSelectedEventId: (eventId: string | null) => void;
  creatingNewEvent: { startTime?: Date; endTime?: Date } | null;
  setCreatingNewEvent: (times: { startTime: Date; endTime: Date } | null) => void;
  creatingNewHoliday: { startDate: Date; endDate: Date } | null;
  setCreatingNewHoliday: (creating: { startDate: Date; endDate: Date } | null) => void;
  editingHolidayId: string | null;
  setEditingHolidayId: (holidayId: string | null) => void;
  
  // Loading states
  isLoading: boolean;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
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

  // Local state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [creatingNewEvent, setCreatingNewEvent] = useState<{ startTime?: Date; endTime?: Date } | null>(null);
  const [creatingNewHoliday, setCreatingNewHoliday] = useState<{ startDate: Date; endDate: Date } | null>(null);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);

  const isLoading = eventsLoading || holidaysLoading;

  const contextValue: CalendarContextType = {
    // Events
    events: dbEvents || [],
    addEvent: dbAddEvent,
    updateEvent: dbUpdateEvent,
    deleteEvent: dbDeleteEvent,
    
    // Holidays
    holidays: dbHolidays || [],
    addHoliday: dbAddHoliday,
    updateHoliday: dbUpdateHoliday,
    deleteHoliday: dbDeleteHoliday,
    
    // Selection state
    selectedEventId,
    setSelectedEventId,
    creatingNewEvent,
    setCreatingNewEvent,
    creatingNewHoliday,
    setCreatingNewHoliday,
    editingHolidayId,
    setEditingHolidayId,
    
    // Loading states
    isLoading,
  };

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendarContext() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendarContext must be used within a CalendarProvider');
  }
  return context;
}

// Export types
export type { CalendarEvent, Holiday } from '@/types/core';

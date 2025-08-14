import React, { createContext, useContext, ReactNode } from 'react';
import { useAppState, TimeSlot } from './AppStateContext';
import { toast } from '@/hooks/use-toast';

interface AppActions {
  addTimeSlot: (timeSlot: Omit<TimeSlot, 'id'>) => void;
  updateTimeSlot: (id: string, updates: Partial<TimeSlot>) => void;
  deleteTimeSlot: (id: string) => void;
  setSelectedDate: (date: Date) => void;
  setViewMode: (mode: 'day' | 'week' | 'month') => void;
  generateSchedule: (preferences: any) => void;
}

const AppActionsContext = createContext<AppActions | null>(null);

export const AppActionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { dispatch } = useAppState();

  const addTimeSlot = (timeSlot: Omit<TimeSlot, 'id'>) => {
    const newTimeSlot: TimeSlot = {
      ...timeSlot,
      id: crypto.randomUUID(),
    };
    dispatch({ type: 'ADD_TIME_SLOT', payload: newTimeSlot });
    toast({
      title: "Time slot added",
      description: "Your time slot has been successfully added.",
    });
  };

  const updateTimeSlot = (id: string, updates: Partial<TimeSlot>) => {
    dispatch({ type: 'UPDATE_TIME_SLOT', payload: { id, updates } });
    toast({
      title: "Time slot updated",
      description: "Your time slot has been successfully updated.",
    });
  };

  const deleteTimeSlot = (id: string) => {
    dispatch({ type: 'DELETE_TIME_SLOT', payload: id });
    toast({
      title: "Time slot deleted",
      description: "Your time slot has been successfully deleted.",
    });
  };

  const setSelectedDate = (date: Date) => {
    dispatch({ type: 'SET_SELECTED_DATE', payload: date });
  };

  const setViewMode = (mode: 'day' | 'week' | 'month') => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  };

  const generateSchedule = (preferences: any) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // Simulate schedule generation
    setTimeout(() => {
      const generatedSlots: TimeSlot[] = [
        {
          id: crypto.randomUUID(),
          startTime: '09:00',
          endTime: '10:00',
          date: new Date().toISOString().split('T')[0],
          isAvailable: true,
          title: 'Generated Meeting',
          description: 'Auto-generated time slot',
        },
        {
          id: crypto.randomUUID(),
          startTime: '14:00',
          endTime: '15:30',
          date: new Date().toISOString().split('T')[0],
          isAvailable: true,
          title: 'Generated Work Block',
          description: 'Auto-generated time slot',
        },
      ];
      
      dispatch({ type: 'SET_TIME_SLOTS', payload: generatedSlots });
      dispatch({ type: 'SET_LOADING', payload: false });
      
      toast({
        title: "Schedule generated",
        description: "Your schedule has been automatically generated based on your preferences.",
      });
    }, 2000);
  };

  const actions: AppActions = {
    addTimeSlot,
    updateTimeSlot,
    deleteTimeSlot,
    setSelectedDate,
    setViewMode,
    generateSchedule,
  };

  return (
    <AppActionsContext.Provider value={actions}>
      {children}
    </AppActionsContext.Provider>
  );
};

export const useAppActions = () => {
  const context = useContext(AppActionsContext);
  if (!context) {
    throw new Error('useAppActions must be used within an AppActionsProvider');
  }
  return context;
};
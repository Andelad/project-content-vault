import React, { createContext, useContext, useMemo } from 'react';
import { Project, Group, CalendarEvent, Settings, Holiday, Row, Milestone } from './AppContext';

interface AppStateContextType {
  currentView: string;
  currentDate: Date;
  projects: Project[];
  groups: Group[];
  rows: Row[]; // Add rows to state
  events: CalendarEvent[];
  settings: Settings;
  selectedProjectId: string | null;
  holidays: Holiday[];
  selectedEventId: string | null;
  creatingNewEvent: { startTime?: Date; endTime?: Date } | null;
  milestones: Milestone[];
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ 
  children, 
  value 
}: { 
  children: React.ReactNode;
  value: AppStateContextType;
}) {
  // Memoize the context value to prevent unnecessary re-renders
  const memoizedValue = useMemo(() => value, [
    value.currentView,
    value.currentDate,
    value.projects,
    value.groups,
    value.rows,
    value.events,
    value.settings,
    value.selectedProjectId,
    value.holidays,
    value.selectedEventId,
    value.creatingNewEvent,
    value.milestones
  ]);

  return (
    <AppStateContext.Provider value={memoizedValue}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
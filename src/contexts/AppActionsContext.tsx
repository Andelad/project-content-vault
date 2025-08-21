import React, { createContext, useContext, useMemo } from 'react';
import { Project, Group, CalendarEvent, Settings } from './AppContext';

interface AppActionsContextType {
  setCurrentView: (view: string) => void;
  setCurrentDate: (date: Date) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  reorderProjects: (groupId: string, fromIndex: number, toIndex: number) => void;
  addGroup: (group: Omit<Group, 'id'>) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }) => void;
  deleteEvent: (id: string) => void;
  updateHoliday: (id: string, updates: any) => void;
  setSelectedProjectId: (projectId: string | null) => void;
}

const AppActionsContext = createContext<AppActionsContextType | undefined>(undefined);

export function AppActionsProvider({ 
  children, 
  actions 
}: { 
  children: React.ReactNode;
  actions: AppActionsContextType;
}) {
  // Memoize the actions to prevent unnecessary re-renders
  const memoizedActions = useMemo(() => actions, [
    actions.setCurrentView,
    actions.setCurrentDate,
    actions.updateSettings,
    actions.addProject,
    actions.updateProject,
    actions.deleteProject,
    actions.reorderProjects,
    actions.addGroup,
    actions.updateGroup,
    actions.deleteGroup,
    actions.addEvent,
    actions.updateEvent,
    actions.deleteEvent,
    actions.setSelectedProjectId
  ]);

  return (
    <AppActionsContext.Provider value={memoizedActions}>
      {children}
    </AppActionsContext.Provider>
  );
}

export function useAppActions() {
  const context = useContext(AppActionsContext);
  if (context === undefined) {
    throw new Error('useAppActions must be used within an AppActionsProvider');
  }
  return context;
}
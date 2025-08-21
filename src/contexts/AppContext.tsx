import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AppStateProvider, useAppState } from './AppStateContext';
import { AppActionsProvider, useAppActions } from './AppActionsContext';
import { getProjectColor, getGroupColor, PERFORMANCE_LIMITS } from '@/constants';
import { checkProjectOverlap, datesOverlap } from '@/lib/projectOverlapUtils';
import { 
  Project, 
  Group, 
  Row,
  CalendarEvent, 
  Holiday, 
  WorkSlot, 
  Settings,
  Milestone
} from '@/types/core';
import { useProjects } from '@/hooks/useProjects';
import { useGroups } from '@/hooks/useGroups';
import { useRows } from '@/hooks/useRows';
import { useEvents } from '@/hooks/useEvents';
import { useHolidays } from '@/hooks/useHolidays';
import { useSettings } from '@/hooks/useSettings';
import { useMilestones } from '@/hooks/useMilestones';

// Individual work hour override for specific dates
export interface WorkHourOverride {
  date: string; // ISO date string (YYYY-MM-DD)
  dayName: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  slotIndex: number; // Index in the day's slots array
  startTime: string;
  endTime: string;
  duration: number;
}

interface AppContextType {
  currentView: string;
  setCurrentView: (view: string) => void;
  timelineMode: 'days' | 'weeks';
  setTimelineMode: (mode: 'days' | 'weeks') => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  projects: Project[];
  groups: Group[];
  rows: Row[];
  events: CalendarEvent[];
  settings: Settings;
  workHours: any[];
  timelineEntries: any[];
  updateTimelineEntry: (entry: any) => void;
  workHourOverrides: WorkHourOverride[];
  updateSettings: (updates: Partial<Settings>) => void;
  addWorkHourOverride: (override: WorkHourOverride) => void;
  removeWorkHourOverride: (date: string, dayName: string, slotIndex: number) => void;
  addProject: (project: Omit<Project, 'id'>) => Promise<any>;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  reorderProjects: (groupId: string, fromIndex: number, toIndex: number) => void;
  addGroup: (group: Omit<Group, 'id'>) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  reorderGroups: (fromIndex: number, toIndex: number) => void;
  addRow: (row: Omit<Row, 'id'>) => void;
  updateRow: (id: string, updates: Partial<Row>) => void;
  deleteRow: (id: string) => void;
  reorderRows: (groupId: string, fromIndex: number, toIndex: number) => void;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<any>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }) => void;
  deleteEvent: (id: string) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  creatingNewProject: { groupId: string; rowId?: string; startDate?: Date; endDate?: Date } | null;
  setCreatingNewProject: (groupId: string | null, dates?: { startDate: Date; endDate: Date }, rowId?: string) => void;
  selectedEventId: string | null;
  setSelectedEventId: (eventId: string | null) => void;
  creatingNewEvent: { startTime?: Date; endTime?: Date } | null;
  setCreatingNewEvent: (times: { startTime: Date; endTime: Date } | null) => void;
  holidays: Holiday[];
  addHoliday: (holiday: Omit<Holiday, 'id'>) => void;
  updateHoliday: (id: string, updates: Partial<Holiday>) => void;
  deleteHoliday: (id: string) => void;
  creatingNewHoliday: { startDate: Date; endDate: Date } | null;
  setCreatingNewHoliday: (creating: { startDate: Date; endDate: Date } | null) => void;
  editingHolidayId: string | null;
  setEditingHolidayId: (holidayId: string | null) => void;
  setDefaultView: (defaultViewSetting: string) => void;
  // Milestone management
  milestones: Milestone[];
  addMilestone: (milestone: Omit<Milestone, 'id'>) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  reorderMilestones: (projectId: string, fromIndex: number, toIndex: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Global color counter for assigning colors to new projects/groups
let colorIndex = 0;
const getNextProjectColor = () => {
  const color = getProjectColor(colorIndex);
  colorIndex++;
  return color;
};

const getNextGroupColor = () => {
  const color = getGroupColor(colorIndex);
  colorIndex++;
  return color;
};

// Helper to get YYYY-MM-DD in local time, not UTC
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Import database hooks
  const { projects: dbProjects, loading: projectsLoading, addProject: dbAddProject, updateProject: dbUpdateProject, deleteProject: dbDeleteProject, reorderProjects: dbReorderProjects } = useProjects();
  const { groups: dbGroups, loading: groupsLoading, addGroup: dbAddGroup, updateGroup: dbUpdateGroup, deleteGroup: dbDeleteGroup } = useGroups();
  const { rows: dbRows, loading: rowsLoading, addRow: dbAddRow, updateRow: dbUpdateRow, deleteRow: dbDeleteRow, reorderRows: dbReorderRows } = useRows();
  const { events: dbEvents, loading: eventsLoading, addEvent: dbAddEvent, updateEvent: dbUpdateEvent, deleteEvent: dbDeleteEvent } = useEvents();
  const { holidays: dbHolidays, loading: holidaysLoading, addHoliday: dbAddHoliday, updateHoliday: dbUpdateHoliday, deleteHoliday: dbDeleteHoliday } = useHolidays();
  const { settings: dbSettings, loading: settingsLoading, updateSettings: dbUpdateSettings } = useSettings();
  const { milestones: dbMilestones, loading: milestonesLoading, addMilestone: dbAddMilestone, updateMilestone: dbUpdateMilestone, deleteMilestone: dbDeleteMilestone, reorderMilestones: dbReorderMilestones } = useMilestones();

  const [currentView, setCurrentView] = useState('timeline');
  const [timelineMode, setTimelineMode] = useState<'days' | 'weeks'>('days');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [creatingNewProject, setCreatingNewProjectState] = useState<{ groupId: string; rowId?: string; startDate?: Date; endDate?: Date } | null>(null);
  const [creatingNewHoliday, setCreatingNewHoliday] = useState<{ startDate: Date; endDate: Date } | null>(null);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [creatingNewEvent, setCreatingNewEvent] = useState<{ startTime?: Date; endTime?: Date } | null>(null);

  // Work hour overrides for individual date-specific changes
  const [workHourOverrides, setWorkHourOverrides] = useState<WorkHourOverride[]>([]);
  
  // Add missing state
  const [workHours] = useState<any[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);

  const setCreatingNewProject = useCallback((groupId: string | null, dates?: { startDate: Date; endDate: Date }, rowId?: string) => {
    if (groupId) {
      setCreatingNewProjectState({ groupId, ...dates, rowId });
    } else {
      setCreatingNewProjectState(null);
    }
  }, []);
  
  // Default settings fallback if not loaded from database
  const defaultSettings: Settings = {
    weeklyWorkHours: {
      monday: [{ id: '1', startTime: '09:00', endTime: '17:00', duration: 8 }],
      tuesday: [{ id: '2', startTime: '09:00', endTime: '17:00', duration: 8 }],
      wednesday: [
        { id: '3a', startTime: '09:00', endTime: '13:00', duration: 4 },
        { id: '3b', startTime: '14:00', endTime: '18:00', duration: 4 }
      ],
      thursday: [{ id: '4', startTime: '09:00', endTime: '17:00', duration: 8 }],
      friday: [{ id: '5', startTime: '09:00', endTime: '17:00', duration: 8 }],
      saturday: [],
      sunday: []
    },
    defaultView: 'timeline'
  };

  // Convert database data to component format
  const processedProjects = useMemo(() => dbProjects?.map(p => ({
    id: p.id,
    name: p.name,
    client: p.client,
    startDate: new Date(p.start_date),
    endDate: new Date(p.end_date),
    estimatedHours: p.estimated_hours,
    color: p.color,
    groupId: p.group_id,
    rowId: p.row_id,
    notes: p.notes || '',
    icon: p.icon || 'folder'
  })) || [], [dbProjects]);

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
    type: (e.event_type as 'planned' | 'tracked' | 'completed') || 'planned', // Type assertion for event_type
    recurringType: e.recurring_type,
    recurringInterval: e.recurring_interval,
    recurringEndDate: e.recurring_end_date ? new Date(e.recurring_end_date) : undefined,
    recurringCount: e.recurring_count
  })) || [], [dbEvents]);

  const processedHolidays = useMemo(() => dbHolidays?.map(h => ({
    id: h.id,
    title: h.title,
    // Correctly parse date strings from DB to avoid timezone issues
    startDate: new Date(h.start_date.replace(/-/g, '/')),
    endDate: new Date(h.end_date.replace(/-/g, '/')),
    notes: h.notes || ''
  })) || [], [dbHolidays]);

  const processedRows = useMemo(() => dbRows?.map(r => ({
    id: r.id,
    name: r.name,
    groupId: r.group_id,
    order: r.order_index
  })) || [], [dbRows]);

  const processedMilestones = useMemo(() => dbMilestones?.map(m => ({
    id: m.id,
    name: m.name,
    dueDate: new Date(m.due_date),
    timeAllocation: m.time_allocation,
    projectId: m.project_id,
    order: m.order_index
  })) || [], [dbMilestones]);

  // Temporary local storage for defaultView until database migration is applied
  const [localDefaultView, setLocalDefaultView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('defaultView') || defaultSettings.defaultView;
    }
    return defaultSettings.defaultView;
  });

  const processedSettings: Settings = dbSettings ? {
    weeklyWorkHours: (typeof dbSettings.weekly_work_hours === 'object' && 
                     dbSettings.weekly_work_hours !== null && 
                     !Array.isArray(dbSettings.weekly_work_hours) &&
                     'monday' in dbSettings.weekly_work_hours) 
      ? dbSettings.weekly_work_hours as unknown as Settings['weeklyWorkHours']
      : defaultSettings.weeklyWorkHours,
    defaultView: localDefaultView // Use local storage value for now
  } : { ...defaultSettings, defaultView: localDefaultView };

  // Helper function to set view based on default view setting
  const setDefaultView = useCallback((defaultViewSetting: string) => {
    switch (defaultViewSetting) {
      case 'timeline':
        setCurrentView('timeline');
        setTimelineMode('days');
        break;
      case 'timeline-weeks':
        setCurrentView('timeline');
        setTimelineMode('weeks');
        break;
      case 'projects':
        setCurrentView('projects');
        break;
      case 'calendar':
        setCurrentView('calendar');
        break;
      default:
        setCurrentView('timeline');
        setTimelineMode('days');
    }
  }, []);

  // Apply default view setting on app initialization
  useEffect(() => {
    if (processedSettings.defaultView) {
      setDefaultView(processedSettings.defaultView);
    }
  }, [processedSettings.defaultView, setDefaultView]);

  const addProject = useCallback(async (projectData: Omit<Project, 'id'>) => {
    try {
      const dbProjectData = {
        name: projectData.name,
        client: projectData.client,
        start_date: projectData.startDate.toISOString().split('T')[0],
        end_date: projectData.endDate.toISOString().split('T')[0],
        estimated_hours: projectData.estimatedHours,
        color: projectData.color || getNextProjectColor(),
        group_id: projectData.groupId,
        row_id: projectData.rowId,
        notes: projectData.notes || '',
        icon: projectData.icon || 'folder'
      };
      
      const createdProject = await dbAddProject(dbProjectData);
      return createdProject;
    } catch (error) {
      console.error('Failed to add project:', error);
      throw error;
    }
  }, [dbAddProject]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.client !== undefined) dbUpdates.client = updates.client;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate.toISOString().split('T')[0];
      if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate.toISOString().split('T')[0];
      if (updates.estimatedHours !== undefined) dbUpdates.estimated_hours = updates.estimatedHours;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      if (updates.groupId !== undefined) dbUpdates.group_id = updates.groupId;
      if (updates.rowId !== undefined) dbUpdates.row_id = updates.rowId;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
      
      await dbUpdateProject(id, dbUpdates);
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  }, [dbUpdateProject]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await dbDeleteProject(id);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }, [dbDeleteProject]);

  const reorderProjects = useCallback((groupId: string, fromIndex: number, toIndex: number) => {
    dbReorderProjects(groupId, fromIndex, toIndex);
  }, [dbReorderProjects]);

  const addGroup = useCallback(async (groupData: Omit<Group, 'id'>) => {
    try {
      await dbAddGroup(groupData);
    } catch (error) {
      console.error('Failed to add group:', error);
    }
  }, [dbAddGroup]);

  const updateGroup = useCallback(async (id: string, updates: Partial<Group>) => {
    try {
      await dbUpdateGroup(id, updates);
    } catch (error) {
      console.error('Failed to update group:', error);
    }
  }, [dbUpdateGroup]);

  const deleteGroup = useCallback(async (id: string) => {
    try {
      await dbDeleteGroup(id);
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  }, [dbDeleteGroup]);

  const reorderGroups = useCallback((fromIndex: number, toIndex: number) => {
    // This functionality isn't implemented in the hook yet
    console.log('Group reordering not implemented yet');
  }, []);

  const addRow = useCallback(async (rowData: Omit<Row, 'id'>) => {
    try {
      const dbRowData = {
        name: rowData.name,
        group_id: rowData.groupId,
        order_index: rowData.order
      };
      await dbAddRow(dbRowData);
    } catch (error) {
      console.error('Failed to add row:', error);
    }
  }, [dbAddRow]);

  const updateRow = useCallback(async (id: string, updates: Partial<Row>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.groupId !== undefined) dbUpdates.group_id = updates.groupId;
      if (updates.order !== undefined) dbUpdates.order_index = updates.order;
      
      await dbUpdateRow(id, dbUpdates);
    } catch (error) {
      console.error('Failed to update row:', error);
    }
  }, [dbUpdateRow]);

  const deleteRow = useCallback(async (id: string) => {
    try {
      await dbDeleteRow(id);
    } catch (error) {
      console.error('Failed to delete row:', error);
    }
  }, [dbDeleteRow]);

  const reorderRows = useCallback((groupId: string, fromIndex: number, toIndex: number) => {
    dbReorderRows(groupId, fromIndex, toIndex);
  }, [dbReorderRows]);

  const addEvent = useCallback(async (eventData: Omit<CalendarEvent, 'id'>) => {
    try {
      const dbEventData = {
        title: eventData.title,
        description: eventData.description || '',
        start_time: eventData.startTime.toISOString(),
        end_time: eventData.endTime.toISOString(),
        project_id: eventData.projectId || null,
        color: eventData.color,
        completed: eventData.completed || false,
        duration: eventData.duration || 0,
        event_type: eventData.type || 'planned', // Include event type
        recurring_type: null,
        recurring_interval: null,
        recurring_end_date: null,
        recurring_count: null
      };
      
      const result = await dbAddEvent(dbEventData);
      return result; // Return the created event
    } catch (error) {
      console.error('Failed to add event:', error);
      throw error; // Re-throw so caller can handle
    }
  }, [dbAddEvent]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }) => {
    try {
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime.toISOString();
      if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime.toISOString();
      if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
      if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
      if (updates.type !== undefined) dbUpdates.event_type = updates.type; // Include event type
      // Recurring fields are disabled for now
      
      await dbUpdateEvent(id, dbUpdates, options);
    } catch (error) {
      console.error('Failed to update event:', error);
    }
  }, [dbUpdateEvent]);

  const deleteEvent = useCallback(async (id: string) => {
    try {
      await dbDeleteEvent(id);
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  }, [dbDeleteEvent]);

  const addHoliday = useCallback(async (holidayData: Omit<Holiday, 'id'>) => {
    try {
      const dbHolidayData = {
        title: holidayData.title,
        start_date: toLocalDateString(holidayData.startDate),
        end_date: toLocalDateString(holidayData.endDate),
        notes: holidayData.notes || ''
      };
      
      await dbAddHoliday(dbHolidayData);
    } catch (error) {
      console.error('Failed to add holiday:', error);
    }
  }, [dbAddHoliday]);

  const updateHoliday = useCallback(async (id: string, updates: Partial<Holiday>) => {
    try {
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.startDate !== undefined) dbUpdates.start_date = toLocalDateString(updates.startDate);
      if (updates.endDate !== undefined) dbUpdates.end_date = toLocalDateString(updates.endDate);
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      
      await dbUpdateHoliday(id, dbUpdates);
    } catch (error) {
      console.error('Failed to update holiday:', error);
    }
  }, [dbUpdateHoliday]);

  const deleteHoliday = useCallback(async (id: string) => {
    try {
      await dbDeleteHoliday(id);
    } catch (error) {
      console.error('Failed to delete holiday:', error);
    }
  }, [dbDeleteHoliday]);

  // Milestone management functions
  const addMilestone = useCallback(async (milestoneData: Omit<Milestone, 'id'>) => {
    try {
      const dbMilestoneData = {
        name: milestoneData.name,
        due_date: milestoneData.dueDate.toISOString(),
        time_allocation: milestoneData.timeAllocation,
        project_id: milestoneData.projectId,
        order_index: milestoneData.order
      };
      
      await dbAddMilestone(dbMilestoneData);
    } catch (error) {
      console.error('Failed to add milestone:', error);
    }
  }, [dbAddMilestone]);

  const updateMilestone = useCallback(async (id: string, updates: Partial<Milestone>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate.toISOString();
      if (updates.timeAllocation !== undefined) dbUpdates.time_allocation = updates.timeAllocation;
      if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
      if (updates.order !== undefined) dbUpdates.order_index = updates.order;
      
      await dbUpdateMilestone(id, dbUpdates);
    } catch (error) {
      console.error('Failed to update milestone:', error);
    }
  }, [dbUpdateMilestone]);

  const deleteMilestone = useCallback(async (id: string) => {
    try {
      await dbDeleteMilestone(id);
    } catch (error) {
      console.error('Failed to delete milestone:', error);
    }
  }, [dbDeleteMilestone]);

  const reorderMilestones = useCallback((projectId: string, fromIndex: number, toIndex: number) => {
    dbReorderMilestones(projectId, fromIndex, toIndex);
  }, [dbReorderMilestones]);

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    try {
      const dbUpdates: any = {};
      if (updates.weeklyWorkHours !== undefined) dbUpdates.weekly_work_hours = updates.weeklyWorkHours;
      
      // Handle defaultView with local storage until database migration is applied
      if (updates.defaultView !== undefined) {
        setLocalDefaultView(updates.defaultView);
        if (typeof window !== 'undefined') {
          localStorage.setItem('defaultView', updates.defaultView);
        }
        // For now, we skip database save for defaultView
        // if (updates.defaultView !== undefined) dbUpdates.default_view = updates.defaultView;
      }
      
      // Only update database if there are actual database fields to update
      if (Object.keys(dbUpdates).length > 0) {
        await dbUpdateSettings(dbUpdates);
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error; // Re-throw so the UI can handle the error
    }
  }, [dbUpdateSettings]);

  // Work hour override management
  const addWorkHourOverride = useCallback((override: WorkHourOverride) => {
    setWorkHourOverrides(prev => {
      // Remove any existing override for the same date, day, and slot
      const filtered = prev.filter(o => 
        !(o.date === override.date && o.dayName === override.dayName && o.slotIndex === override.slotIndex)
      );
      return [...filtered, override];
    });
  }, []);

  const removeWorkHourOverride = useCallback((date: string, dayName: string, slotIndex: number) => {
    setWorkHourOverrides(prev => 
      prev.filter(o => !(o.date === date && o.dayName === dayName && o.slotIndex === slotIndex))
    );
  }, []);

  // Add missing function implementations
  const updateTimelineEntry = useCallback((entry: any) => {
    setTimelineEntries(prev => {
      const index = prev.findIndex(e => e.id === entry.id);
      if (index >= 0) {
        return prev.map((e, i) => i === index ? { ...e, ...entry } : e);
      }
      return [...prev, entry];
    });
  }, []);

  // Memoize state and actions separately
  const state = useMemo(() => ({
    currentView,
    timelineMode,
    currentDate,
    projects: processedProjects,
    groups: dbGroups || [],
    rows: processedRows,
    events: processedEvents,
    settings: processedSettings,
    workHours,
    timelineEntries,
    workHourOverrides,
    selectedProjectId,
    creatingNewProject,
    holidays: processedHolidays,
    creatingNewHoliday,
    editingHolidayId,
    selectedEventId,
    creatingNewEvent,
    milestones: processedMilestones
  }), [currentView, timelineMode, currentDate, processedProjects, dbGroups, processedRows, processedEvents, processedSettings, workHours, timelineEntries, workHourOverrides, selectedProjectId, creatingNewProject, processedHolidays, creatingNewHoliday, editingHolidayId, selectedEventId, creatingNewEvent, processedMilestones]);

  const actions = useMemo(() => ({
    setCurrentView,
    setTimelineMode,
    setCurrentDate,
    updateSettings,
    updateTimelineEntry,
    addWorkHourOverride,
    removeWorkHourOverride,
    addProject,
    updateProject,
    deleteProject,
    reorderProjects,
    addGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    addRow,
    updateRow,
    deleteRow,
    reorderRows,
    addEvent,
    updateEvent,
    deleteEvent,
    setSelectedProjectId,
    setCreatingNewProject,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    setCreatingNewHoliday,
    setEditingHolidayId,
    setSelectedEventId,
    setCreatingNewEvent,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    reorderMilestones
  }), [
    setCurrentView,
    setCurrentDate,
    updateSettings,
    updateTimelineEntry,
    addWorkHourOverride,
    removeWorkHourOverride,
    addProject,
    updateProject,
    deleteProject,
    reorderProjects,
    addGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    addRow,
    updateRow,
    deleteRow,
    reorderRows,
    addEvent,
    updateEvent,
    deleteEvent,
    setSelectedProjectId,
    setCreatingNewProject,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    setCreatingNewHoliday,
    setEditingHolidayId,
    setSelectedEventId,
    setCreatingNewEvent,
    setDefaultView,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    reorderMilestones
  ]);

  return (
    <AppStateProvider value={state}>
      <AppActionsProvider actions={actions}>
        <AppContext.Provider value={{
          ...state,
          ...actions
        } as unknown as AppContextType}>
          {children}
        </AppContext.Provider>
      </AppActionsProvider>
    </AppStateProvider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Additional optimized hooks for specific use cases
export function useAppDataOnly() {
  return useAppState();
}

export function useAppActionsOnly() {
  return useAppActions();
}

// Re-export core types for components that need them
export type { Project, Group, Row, CalendarEvent, Holiday, WorkSlot, Settings, Milestone } from '@/types/core';
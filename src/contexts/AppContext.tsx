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
  Settings 
} from '@/types/core';

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
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  projects: Project[];
  groups: Group[];
  rows: Row[]; // Add rows to interface
  events: CalendarEvent[];
  settings: Settings;
  workHours: any[]; // Add workHours property
  timelineEntries: any[]; // Add timelineEntries property
  updateTimelineEntry: (entry: any) => void; // Add updateTimelineEntry method
  workHourOverrides: WorkHourOverride[];
  updateSettings: (updates: Partial<Settings>) => void;
  addWorkHourOverride: (override: WorkHourOverride) => void;
  removeWorkHourOverride: (date: string, dayName: string, slotIndex: number) => void;
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  reorderProjects: (groupId: string, fromIndex: number, toIndex: number) => void;
  addGroup: (group: Omit<Group, 'id'>) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  reorderGroups: (fromIndex: number, toIndex: number) => void;
  addRow: (row: Omit<Row, 'id'>) => void; // Add row management functions
  updateRow: (id: string, updates: Partial<Row>) => void;
  deleteRow: (id: string) => void;
  reorderRows: (groupId: string, fromIndex: number, toIndex: number) => void;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  creatingNewProject: { groupId: string; rowId?: string; startDate?: Date; endDate?: Date } | null; // Add rowId
  setCreatingNewProject: (groupId: string | null, dates?: { startDate: Date; endDate: Date }, rowId?: string) => void;
  selectedEventId: string | null;
  setSelectedEventId: (eventId: string | null) => void;
  creatingNewEvent: { startTime?: Date; endTime?: Date } | null;
  setCreatingNewEvent: (times: { startTime: Date; endTime: Date } | null) => void;
  holidays: Holiday[];
  addHoliday: (holiday: Omit<Holiday, 'id'>) => void;
  updateHoliday: (id: string, updates: Partial<Holiday>) => void;
  deleteHoliday: (id: string) => void;
  creatingNewHoliday: boolean;
  setCreatingNewHoliday: (creating: boolean) => void;
  editingHolidayId: string | null;
  setEditingHolidayId: (holidayId: string | null) => void;
  holidayCreationState: { startDate: Date | null; phase: 'start' | 'end' } | null;
  setHolidayCreationState: (state: { startDate: Date | null; phase: 'start' | 'end' } | null) => void;
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState('timeline');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [creatingNewProject, setCreatingNewProjectState] = useState<{ groupId: string; rowId?: string; startDate?: Date; endDate?: Date } | null>(null);
  const [creatingNewHoliday, setCreatingNewHoliday] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidayCreationState, setHolidayCreationState] = useState<{ startDate: Date | null; phase: 'start' | 'end' } | null>(null);
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
  
  // Settings state
  const [settings, setSettings] = useState<Settings>({
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
    }
  });
  
  // Sample groups
  const [groups, setGroups] = useState<Group[]>([
    { 
      id: 'work-group', 
      name: 'Work Projects', 
      description: 'Professional work projects',
      color: 'oklch(0.8 0.12 240)' // Blue
    },
    { 
      id: 'home-group', 
      name: 'Personal Projects', 
      description: 'Personal and home projects',
      color: 'oklch(0.8 0.12 120)' // Green
    }
  ]);

  // Sample rows - each group starts with one row
  const [rows, setRows] = useState<Row[]>([
    {
      id: 'work-row-1',
      groupId: 'work-group',
      name: 'Row 1',
      order: 1
    },
    {
      id: 'work-row-2',
      groupId: 'work-group',
      name: 'Row 2',
      order: 2
    },
    {
      id: 'work-row-3',
      groupId: 'work-group',
      name: 'Row 3',
      order: 3
    },
    {
      id: 'home-row-1',
      groupId: 'home-group',
      name: 'Row 1',
      order: 1
    }
  ]);

  // Sample projects with OKLCH colors
  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: 'Website Redesign (Starts Today)',
      client: 'Acme Corp',
      startDate: new Date(), // Starts today
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks from today
      estimatedHours: 120,
      color: 'oklch(0.8 0.12 240)', // Blue
      groupId: 'work-group',
      rowId: 'work-row-1',
      notes: 'Initial requirements gathering completed. Need to focus on responsive design and modern UI/UX patterns. Key stakeholders include marketing team and design lead.'
    },
    {
      id: '2',
      name: 'Mobile App Development (Past Project)',
      client: 'Tech Startup',
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Started 60 days ago
      endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Ended 30 days ago
      estimatedHours: 200,
      color: 'oklch(0.8 0.12 0)', // Red
      groupId: 'work-group',
      rowId: 'work-row-2',
      notes: 'Native mobile app development using React Native. Target platforms: iOS and Android. Will need to coordinate with backend team for API integration.'
    },
    {
      id: '3',
      name: 'Brand Identity (Future Project)',
      client: 'Creative Agency',
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Starts 30 days from now
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // Ends 60 days from now
      estimatedHours: 80,
      color: 'oklch(0.8 0.12 270)', // Purple
      groupId: 'work-group',
      rowId: 'work-row-3',
      notes: 'Complete brand identity overhaul including:\\n• Logo design and variations\\n• Color palette and typography\\n• Brand guidelines document\\n• Marketing materials templates'
    },
    {
      id: '4',
      name: 'Home Renovation',
      client: 'Personal',
      startDate: new Date(2025, 1, 10), // Feb 10, 2025
      endDate: new Date(2025, 2, 25), // Mar 25, 2025
      estimatedHours: 100,
      color: 'oklch(0.8 0.12 120)', // Green
      groupId: 'home-group',
      rowId: 'home-row-1'
    },
    {
      id: '5',
      name: 'Garden Planning',
      client: 'Personal',
      startDate: new Date(2025, 3, 1), // Apr 1, 2025 (no overlap with Home Renovation)
      endDate: new Date(2025, 4, 15), // May 15, 2025
      estimatedHours: 40,
      color: 'oklch(0.8 0.12 150)', // Green-Cyan
      groupId: 'home-group',
      rowId: 'home-row-1'
    },
    {
      id: '6',
      name: 'Past Project (Left Scroll)',
      client: 'Test Client',
      startDate: new Date(2024, 10, 1), // November 2024
      endDate: new Date(2024, 11, 15), // December 2024
      estimatedHours: 60,
      color: 'oklch(0.8 0.12 30)', // Orange
      groupId: 'work-group',
      rowId: 'work-row-1', // Different row from Mobile App to avoid any potential overlap
      notes: 'Completed project for reference'
    },
    {
      id: '7',
      name: 'Future Project (Right Scroll)',
      client: 'Test Client',
      startDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Starts 90 days from now (3 months)
      endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // Ends 120 days from now (4 months)
      estimatedHours: 80,
      color: 'oklch(0.8 0.12 180)', // Cyan
      groupId: 'work-group',
      rowId: 'work-row-2', // Different row from Brand Identity to ensure no overlap
      notes: 'Future expansion project'
    }
  ]);

  const [events, setEvents] = useState<CalendarEvent[]>([
    // Dummy event 1: Connected to Website Redesign project, during work hours
    {
      id: 'dummy-1',
      title: 'Website Redesign Kickoff Meeting',
      startTime: (() => {
        const today = new Date();
        const thisWeekMonday = new Date(today);
        thisWeekMonday.setDate(today.getDate() - today.getDay() + 1); // Get Monday of this week
        thisWeekMonday.setHours(10, 0, 0, 0); // 10:00 AM Monday
        return thisWeekMonday;
      })(),
      endTime: (() => {
        const today = new Date();
        const thisWeekMonday = new Date(today);
        thisWeekMonday.setDate(today.getDate() - today.getDay() + 1); // Get Monday of this week
        thisWeekMonday.setHours(12, 0, 0, 0); // 12:00 PM Monday (2 hours, within work time)
        return thisWeekMonday;
      })(),
      projectId: '1', // Website Redesign project
      color: 'oklch(0.8 0.12 240)' // Blue to match project
    },
    // Dummy event 2: Connected to Mobile App Development project, overlapping work/non-work hours
    {
      id: 'dummy-2',
      title: 'Mobile App Dev Team Dinner',
      startTime: (() => {
        const today = new Date();
        const thisWeekTuesday = new Date(today);
        thisWeekTuesday.setDate(today.getDate() - today.getDay() + 2); // Get Tuesday of this week
        thisWeekTuesday.setHours(16, 30, 0, 0); // 4:30 PM Tuesday (starts in work hours)
        return thisWeekTuesday;
      })(),
      endTime: (() => {
        const today = new Date();
        const thisWeekTuesday = new Date(today);
        thisWeekTuesday.setDate(today.getDate() - today.getDay() + 2); // Get Tuesday of this week
        thisWeekTuesday.setHours(19, 30, 0, 0); // 7:30 PM Tuesday (ends outside work hours - overlaps)
        return thisWeekTuesday;
      })(),
      projectId: '2', // Mobile App Development project
      color: 'oklch(0.8 0.12 0)' // Red to match project
    },
    // Dummy event 3: Connected to Brand Identity project, completely outside work hours
    {
      id: 'dummy-3',
      title: 'Brand Identity Client Call',
      startTime: (() => {
        const today = new Date();
        const thisWeekWednesday = new Date(today);
        thisWeekWednesday.setDate(today.getDate() - today.getDay() + 3); // Get Wednesday of this week
        thisWeekWednesday.setHours(19, 0, 0, 0); // 7:00 PM Wednesday (outside work hours)
        return thisWeekWednesday;
      })(),
      endTime: (() => {
        const today = new Date();
        const thisWeekWednesday = new Date(today);
        thisWeekWednesday.setDate(today.getDate() - today.getDay() + 3); // Get Wednesday of this week
        thisWeekWednesday.setHours(20, 30, 0, 0); // 8:30 PM Wednesday (1.5 hours, fully outside work hours)
        return thisWeekWednesday;
      })(),
      projectId: '3', // Brand Identity project
      color: 'oklch(0.8 0.12 270)' // Purple to match project
    }
  ]);

  const [holidays, setHolidays] = useState<Holiday[]>([
    {
      id: 'demo-holiday',
      title: 'Team Holiday',
      startDate: new Date(), // Today
      endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 5 days total (today + 4 more days)
      notes: 'Company-wide holiday period for team bonding and rest.'
    }
  ]);

  // Data integrity check - DISABLED to prevent project jumping
  // This was automatically moving newly created projects to different rows
  // even when SmartHoverAddProjectBar had already validated placement
  useEffect(() => {
    console.log('⚠️ DATA INTEGRITY CHECK DISABLED - Was causing project jumping');
    console.log('ℹ️ If manual cleanup is needed, check for overlapping projects manually');
    
    // Only log project data for debugging, no automatic moves
    console.log('📋 Current Projects:');
    projects.forEach(project => {
      console.log(`  - "${project.name}": ${project.groupId} → ${project.rowId}`);
      console.log(`    ${new Date(project.startDate).toDateString()} - ${new Date(project.endDate).toDateString()}`);
    });
    
    // DISABLED: All automatic cleanup logic that was moving projects
    // const cleanedProjects = projects.map(project => { ... });
    // Auto-moving logic removed to prevent interference with user intentions
  }, [projects.length]); // Only run when number of projects changes

  const addProject = useCallback((projectData: Omit<Project, 'id'>) => {
    console.log('📝 AppContext.addProject called with FULL DATA:', projectData);
    console.log('📝 DETAILED: startDate ISO:', projectData.startDate.toISOString(), 'endDate ISO:', projectData.endDate.toISOString());
    console.log('📝 DETAILED: rowId received:', projectData.rowId, 'groupId received:', projectData.groupId);
    // Check project limit for the group
    const projectsInGroup = projects.filter(p => p.groupId === projectData.groupId).length;
    if (projectsInGroup >= PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP) {
      console.warn(`Cannot add project: Group has reached maximum limit of ${PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP} projects`);
      return;
    }

    // REMOVED: Third competing overlap check - SmartHoverAddProjectBar already validated this
    // Trust the UI component's validation instead of re-checking here

    const newProject: Project = {
      ...projectData,
      id: Date.now().toString(),
      color: projectData.color || getNextProjectColor()
    };
    
    console.log('📝 FINAL: newProject being added:', {
      id: newProject.id,
      name: newProject.name,
      rowId: newProject.rowId,
      groupId: newProject.groupId,
      startDate: newProject.startDate.toISOString(),
      endDate: newProject.endDate.toISOString()
    });
    
    setProjects(prev => [...prev, newProject]);
    return true; // Return success so modal closes
  }, [projects]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    // Import overlap checking function
    
    const currentProject = projects.find(p => p.id === id);
    if (!currentProject) return;
    
    const updatedProject = { ...currentProject, ...updates };
    
    // Check for overlaps if rowId, startDate, or endDate is being changed
    if (updatedProject.rowId && (updates.rowId || updates.startDate || updates.endDate)) {
      const overlaps = checkProjectOverlap(
        id,
        updatedProject.rowId,
        updatedProject.startDate,
        updatedProject.endDate,
        projects
      );
      
      if (overlaps.length > 0) {
        console.error('Cannot update project: Would overlap with existing projects in the same row:', overlaps);
        alert(`Cannot update project: It would overlap with "${overlaps[0].name}" in the same row. Projects in the same row cannot have overlapping dates.`);
        return;
      }
    }
    
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [projects]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    // Also delete related events
    setEvents(prev => prev.filter(e => e.projectId !== id));
  }, []);

  const reorderProjects = useCallback((groupId: string, fromIndex: number, toIndex: number) => {
    setProjects(prev => {
      const groupProjects = prev.filter(p => p.groupId === groupId);
      const otherProjects = prev.filter(p => p.groupId !== groupId);
      
      const [movedProject] = groupProjects.splice(fromIndex, 1);
      groupProjects.splice(toIndex, 0, movedProject);
      
      return [...otherProjects, ...groupProjects];
    });
  }, []);

  const addGroup = useCallback((groupData: Omit<Group, 'id'>) => {
    // Check group limit
    if (groups.length >= PERFORMANCE_LIMITS.MAX_GROUPS) {
      console.warn(`Cannot add group: Maximum limit of ${PERFORMANCE_LIMITS.MAX_GROUPS} groups reached`);
      return;
    }

    const newGroup: Group = {
      ...groupData,
      id: Date.now().toString(),
      color: groupData.color || getNextGroupColor()
    };
    setGroups(prev => [...prev, newGroup]);
  }, [groups]);

  const updateGroup = useCallback((id: string, updates: Partial<Group>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    // Don't allow deleting default groups
    if (id === 'work-group' || id === 'home-group') return;
    
    setGroups(prev => prev.filter(g => g.id !== id));
    // Move projects from deleted group to work group
    setProjects(prev => prev.map(p => 
      p.groupId === id ? { ...p, groupId: 'work-group' } : p
    ));
  }, []);

  const reorderGroups = useCallback((fromIndex: number, toIndex: number) => {
    setGroups(prev => {
      const newGroups = [...prev];
      const [movedGroup] = newGroups.splice(fromIndex, 1);
      newGroups.splice(toIndex, 0, movedGroup);
      return newGroups;
    });
  }, []);

  const addRow = useCallback((rowData: Omit<Row, 'id'>) => {
    const newRow: Row = {
      ...rowData,
      id: Date.now().toString()
    };
    setRows(prev => [...prev, newRow]);
  }, []);

  const updateRow = useCallback((id: string, updates: Partial<Row>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const deleteRow = useCallback((id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  }, []);

  const reorderRows = useCallback((groupId: string, fromIndex: number, toIndex: number) => {
    setRows(prev => {
      const groupRows = prev.filter(r => r.groupId === groupId);
      const otherRows = prev.filter(r => r.groupId !== groupId);
      
      const [movedRow] = groupRows.splice(fromIndex, 1);
      groupRows.splice(toIndex, 0, movedRow);
      
      return [...otherRows, ...groupRows];
    });
  }, []);

  const addEvent = useCallback((eventData: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: Date.now().toString(),
      color: eventData.color || '#3b82f6' // Default to blue if no color provided
    };
    setEvents(prev => [...prev, newEvent]);
  }, []);

  const updateEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const addHoliday = useCallback((holidayData: Omit<Holiday, 'id'>) => {
    const newHoliday: Holiday = {
      ...holidayData,
      id: Date.now().toString()
    };
    setHolidays(prev => [...prev, newHoliday]);
  }, []);

  const updateHoliday = useCallback((id: string, updates: Partial<Holiday>) => {
    setHolidays(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  }, []);

  const deleteHoliday = useCallback((id: string) => {
    setHolidays(prev => prev.filter(h => h.id !== id));
  }, []);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

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
    currentDate,
    projects,
    groups,
    rows, // Add rows to state properly
    events,
    settings,
    workHours,
    timelineEntries,
    workHourOverrides,
    selectedProjectId,
    creatingNewProject,
    holidays,
    creatingNewHoliday,
    editingHolidayId,
    holidayCreationState,
    selectedEventId,
    creatingNewEvent
  }), [currentView, currentDate, projects, groups, rows, events, settings, workHours, timelineEntries, workHourOverrides, selectedProjectId, creatingNewProject, holidays, creatingNewHoliday, editingHolidayId, holidayCreationState, selectedEventId, creatingNewEvent]);

  const actions = useMemo(() => ({
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
    setHolidayCreationState,
    setSelectedEventId,
    setCreatingNewEvent
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
    setHolidayCreationState,
    setSelectedEventId,
    setCreatingNewEvent
  ]);

  return (
    <AppStateProvider value={state}>
      <AppActionsProvider actions={actions}>
        <AppContext.Provider value={{
          ...state,
          ...actions
        }}>
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
export type { Project, Group, Row, CalendarEvent, Holiday, WorkSlot, Settings } from '@/types/core';
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Project, Group, Row } from '@/types/core';
import { useProjects as useProjectsHook } from '@/hooks/useProjects';
import { useGroups } from '@/hooks/useGroups';
import { useRows } from '@/hooks/useRows';
import { useMilestones } from '@/hooks/useMilestones';
import { getProjectColor, getGroupColor } from '@/constants';
import type { Database } from '@/integrations/supabase/types';
import { Milestone } from '@/types/core';

type DbMilestone = Database['public']['Tables']['milestones']['Row'];

interface ProjectContextType {
  // Projects
  projects: any[]; // Using any[] for now to avoid type conflicts
  addProject: (project: any) => Promise<any>;
  updateProject: (id: string, updates: any, options?: { silent?: boolean }) => void;
  deleteProject: (id: string) => void;
  reorderProjects: (groupId: string, fromIndex: number, toIndex: number) => void;
  showProjectSuccessToast: (message?: string) => void;
  
  // Groups
  groups: any[];
  addGroup: (group: any) => void;
  updateGroup: (id: string, updates: any) => void;
  deleteGroup: (id: string) => void;
  reorderGroups: (fromIndex: number, toIndex: number) => void;
  
  // Rows
  rows: any[];
  addRow: (row: any) => void;
  updateRow: (id: string, updates: any) => void;
  deleteRow: (id: string) => void;
  reorderRows: (groupId: string, fromIndex: number, toIndex: number) => void;
  
    // Milestones
  milestones: Milestone[];
  addMilestone: (milestone: any, options?: { silent?: boolean }) => Promise<void>;
  updateMilestone: (id: string, updates: any, options?: { silent?: boolean }) => void;
  deleteMilestone: (id: string, options?: { silent?: boolean }) => Promise<void>;
  getMilestonesForProject: (projectId: string) => Milestone[];
  showMilestoneSuccessToast: (message?: string) => void;
  normalizeMilestoneOrders: (projectId?: string, options?: { silent?: boolean }) => Promise<void>;
  refetchMilestones: () => Promise<void>;
  
  // Selection state
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  creatingNewProject: { groupId: string; rowId?: string; startDate?: Date; endDate?: Date } | null;
  setCreatingNewProject: (groupId: string | null, dates?: { startDate: Date; endDate: Date }, rowId?: string) => void;
  
  // Loading states
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  // Move color index inside the provider to avoid module-level state issues
  const [colorIndex, setColorIndex] = useState(0);
  
  const getNextProjectColor = useCallback(() => {
    const color = getProjectColor(colorIndex);
    setColorIndex(prev => prev + 1);
    return color;
  }, [colorIndex]);

  const getNextGroupColor = useCallback(() => {
    const color = getGroupColor(colorIndex);
    setColorIndex(prev => prev + 1);
    return color;
  }, [colorIndex]);
  // Database hooks
  const { 
    projects: dbProjects, 
    loading: projectsLoading, 
    addProject: dbAddProject, 
    updateProject: dbUpdateProject, 
    deleteProject: dbDeleteProject, 
    reorderProjects: dbReorderProjects,
    showSuccessToast: showProjectSuccessToast
  } = useProjectsHook();
  
  const { 
    groups: dbGroups, 
    loading: groupsLoading, 
    addGroup: dbAddGroup, 
    updateGroup: dbUpdateGroup, 
    deleteGroup: dbDeleteGroup 
  } = useGroups();
  
  const { 
    rows: dbRows, 
    loading: rowsLoading, 
    addRow: dbAddRow, 
    updateRow: dbUpdateRow, 
    deleteRow: dbDeleteRow, 
    reorderRows: dbReorderRows 
  } = useRows();

  // Fetch all milestones (not project-specific)
  const {
    milestones: dbMilestones,
    loading: milestonesLoading,
    addMilestone: dbAddMilestone,
    updateMilestone: dbUpdateMilestone,
    deleteMilestone: dbDeleteMilestone,
    showSuccessToast: showMilestoneSuccessToast,
    normalizeMilestoneOrders: dbNormalizeMilestoneOrders,
    refetch: refetchMilestones
  } = useMilestones(); // Fetch all milestones

  // Transform milestones to match app types (camelCase) - Phase 5: Added new fields
  const processedMilestones = useMemo(() => (dbMilestones?.map(m => ({
    id: m.id,
    name: m.name,
    projectId: m.project_id,
    
    // OLD fields (for backward compatibility)
    dueDate: new Date(m.due_date),
    timeAllocation: m.time_allocation,
    
    // NEW fields (Phase 5)
    endDate: new Date(m.due_date), // Maps due_date to endDate
    timeAllocationHours: m.time_allocation_hours ?? m.time_allocation,
    startDate: m.start_date ? new Date(m.start_date) : undefined,
    isRecurring: m.is_recurring ?? false,
    recurringConfig: m.recurring_config as any,
    
    // METADATA
    userId: m.user_id || '',
    createdAt: m.created_at ? new Date(m.created_at) : new Date(),
    updatedAt: m.updated_at ? new Date(m.updated_at) : new Date()
  })) || []).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()), [dbMilestones]);

  // Local state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [creatingNewProject, setCreatingNewProjectState] = useState<{ groupId: string; rowId?: string; startDate?: Date; endDate?: Date } | null>(null);

  const setCreatingNewProject = useCallback((groupId: string | null, dates?: { startDate: Date; endDate: Date }, rowId?: string) => {
    if (groupId) {
      setCreatingNewProjectState({ groupId, ...dates, rowId });
    } else {
      setCreatingNewProjectState(null);
    }
  }, []);

  // Listen for milestone updates to refresh data
  React.useEffect(() => {
    const handleMilestonesUpdated = (event: CustomEvent) => {
      // Trigger a refresh of milestone data
      refetchMilestones();
    };

    window.addEventListener('milestonesUpdated', handleMilestonesUpdated as EventListener);
    return () => window.removeEventListener('milestonesUpdated', handleMilestonesUpdated as EventListener);
  }, [refetchMilestones]);

  // Wrapped functions to add color assignment
  const addProject = useCallback(async (project: any) => {
    const projectWithColor = {
      ...project,
      color: project.color || getNextProjectColor()
    };
    return dbAddProject(projectWithColor);
  }, [dbAddProject]);

  const addGroup = useCallback((group: any) => {
    const groupWithColor = {
      ...group,
      color: group.color || getNextGroupColor()
    };
    dbAddGroup(groupWithColor);
  }, [dbAddGroup]);

  // Milestone utility function
  const getMilestonesForProject = useCallback((projectId: string): Milestone[] => {
    return processedMilestones?.filter(milestone => milestone.projectId === projectId) || [];
  }, [processedMilestones]);

  // Wrapped milestone functions to match expected signatures
  const addMilestone = useCallback(async (milestone: any, options?: { silent?: boolean }): Promise<void> => {
    await dbAddMilestone(milestone, options);
  }, [dbAddMilestone]);

  const updateMilestone = useCallback(async (id: string, updates: any, options?: { silent?: boolean }): Promise<void> => {
    // Map camelCase fields from UI to snake_case fields expected by the DB layer
    // DUAL-WRITE: Write to both old and new columns (Phase 5)
    const dbUpdates: any = {};
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
    if (updates.order !== undefined) dbUpdates.order_index = updates.order;
    
    // DUAL-WRITE for time allocation
    if (updates.timeAllocation !== undefined) {
      dbUpdates.time_allocation = updates.timeAllocation;
      dbUpdates.time_allocation_hours = updates.timeAllocationHours ?? updates.timeAllocation;
    }
    if (updates.timeAllocationHours !== undefined) {
      dbUpdates.time_allocation = updates.timeAllocationHours;
      dbUpdates.time_allocation_hours = updates.timeAllocationHours;
    }

    // DUAL-WRITE for due date / end date
    if (updates.dueDate !== undefined) {
      if (updates.dueDate instanceof Date) {
        dbUpdates.due_date = updates.dueDate.toISOString();
      } else {
        dbUpdates.due_date = updates.dueDate;
      }
    }
    if (updates.endDate !== undefined) {
      if (updates.endDate instanceof Date) {
        dbUpdates.due_date = updates.endDate.toISOString();
      } else {
        dbUpdates.due_date = updates.endDate;
      }
    }
    
    // NEW fields
    if (updates.startDate !== undefined) {
      dbUpdates.start_date = updates.startDate instanceof Date ? 
        updates.startDate.toISOString() : updates.startDate;
    }
    if (updates.isRecurring !== undefined) {
      dbUpdates.is_recurring = updates.isRecurring;
    }
    if (updates.recurringConfig !== undefined) {
      dbUpdates.recurring_config = updates.recurringConfig;
    }

    await dbUpdateMilestone(id, dbUpdates, options);
  }, [dbUpdateMilestone]);

  const deleteMilestone = useCallback(async (id: string, options?: { silent?: boolean }): Promise<void> => {
    await dbDeleteMilestone(id, options);
  }, [dbDeleteMilestone]);

  // Transform rows to match app types (camelCase)
  const processedRows = useMemo(() => (
    (dbRows || []).map(r => ({
      id: r.id,
      groupId: (r as any).group_id ?? (r as any).groupId, // tolerate either shape
      name: r.name,
      order: (r as any).order_index ?? (r as any).order
    }))
  ), [dbRows]);

  // Wrap row mutations to accept camelCase from UI and convert to DB shape
  const addRow = useCallback((row: { groupId: string; name: string; order: number }) => {
    return dbAddRow({
      // DB expects snake_case
      group_id: row.groupId,
      name: row.name,
      order_index: row.order
    } as any);
  }, [dbAddRow]);

  const updateRow = useCallback((id: string, updates: { groupId?: string; name?: string; order?: number }) => {
    const dbUpdates: any = {};
    if (updates.groupId !== undefined) dbUpdates.group_id = updates.groupId;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.order !== undefined) dbUpdates.order_index = updates.order;
    return dbUpdateRow(id, dbUpdates);
  }, [dbUpdateRow]);

  const isLoading = projectsLoading || groupsLoading || rowsLoading || milestonesLoading;

  const contextValue: ProjectContextType = {
    // Projects
    projects: dbProjects || [],
    addProject,
    updateProject: dbUpdateProject,
    deleteProject: dbDeleteProject,
    reorderProjects: dbReorderProjects,
    showProjectSuccessToast,
    
  // Groups
  groups: (dbGroups || []).map(g => ({ ...g })),
    addGroup,
    updateGroup: dbUpdateGroup,
    deleteGroup: dbDeleteGroup,
    reorderGroups: () => {}, // TODO: Implement if needed
    
  // Rows
  rows: processedRows || [],
  addRow,
  updateRow,
    deleteRow: dbDeleteRow,
    reorderRows: dbReorderRows,
    
    // Milestones
    milestones: processedMilestones || [],
    addMilestone,
    updateMilestone,
    deleteMilestone,
    getMilestonesForProject,
    showMilestoneSuccessToast,
    normalizeMilestoneOrders: dbNormalizeMilestoneOrders,
    refetchMilestones: refetchMilestones,
    
    // Selection state
    selectedProjectId,
    setSelectedProjectId,
    creatingNewProject,
    setCreatingNewProject,
    
    // Loading states
    isLoading,
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    // Add more debugging information
    console.error('useProjectContext was called outside of ProjectProvider. Current context:', context);
    console.error('Stack trace:', new Error().stack);
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}

// Export types
export type { Project, Group, Row } from '@/types/core';

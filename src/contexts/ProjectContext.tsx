import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { Project, Group, Row } from '@/types/core';
import { useProjects as useProjectsHook } from '@/hooks/useProjects';
import { useGroups } from '@/hooks/useGroups';
import { useRows } from '@/hooks/useRows';
import { useMilestones } from '@/hooks/useMilestones';
import { getProjectColor, getGroupColor } from '@/constants';
import type { Database } from '@/integrations/supabase/types';
import { Milestone } from '@/types/core';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
type SupabaseGroupRow = Database['public']['Tables']['groups']['Row'];
type SupabaseRowRow = Database['public']['Tables']['rows']['Row'];
type SupabaseMilestoneRow = Database['public']['Tables']['milestones']['Row'];
type SupabaseMilestoneInsert = Database['public']['Tables']['milestones']['Insert'];
type SupabaseGroupInsert = Database['public']['Tables']['groups']['Insert'];
type SupabaseGroupUpdate = Database['public']['Tables']['groups']['Update'];
type SupabaseRowInsert = Database['public']['Tables']['rows']['Insert'];
type SupabaseRowUpdate = Database['public']['Tables']['rows']['Update'];
type SupabaseMilestoneUpdate = Database['public']['Tables']['milestones']['Update'];

interface ProjectGroup extends Group {
  color?: string;
}

type ProjectCreationInput = {
  name: string;
  client?: string;
  clientId?: string;
  startDate: Date;
  endDate?: Date;
  estimatedHours: number;
  groupId?: string;
  rowId?: string;
  color?: string;
  notes?: string;
  icon?: string;
  continuous?: boolean;
  autoEstimateDays?: Project['autoEstimateDays'];
};

type ProjectUpdateInput = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'milestones' | 'userId'>>;

type GroupCreateInput = {
  name: string;
  color?: string;
};

type GroupUpdateInput = {
  name?: string;
};

type RowCreateInput = {
  groupId: string;
  name: string;
  order: number;
};

type RowUpdateInput = Partial<Pick<Row, 'groupId' | 'name' | 'order'>>;

type MilestoneCreateInput = {
  name: string;
  projectId: string;
  dueDate: Date | string;
  timeAllocation: number;
  timeAllocationHours?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  isRecurring?: boolean;
  recurringConfig?: Milestone['recurringConfig'];
  order?: number;
};

type MilestoneUpdateInput = Partial<MilestoneCreateInput>;

interface CreatingProjectState {
  groupId: string;
  rowId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface ProjectContextType {
  // Projects
  projects: Project[];
  addProject: (project: ProjectCreationInput) => Promise<Project>;
  updateProject: (id: string, updates: ProjectUpdateInput, options?: { silent?: boolean }) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  reorderProjects: (groupId: string, fromIndex: number, toIndex: number) => void;
  showProjectSuccessToast: (message?: string) => void;

  // Groups
  groups: ProjectGroup[];
  addGroup: (group: GroupCreateInput) => Promise<ProjectGroup>;
  updateGroup: (id: string, updates: GroupUpdateInput) => Promise<ProjectGroup>;
  deleteGroup: (id: string) => Promise<void>;
  reorderGroups: (fromIndex: number, toIndex: number) => void;

  // Rows
  rows: Row[];
  addRow: (row: RowCreateInput) => Promise<void>;
  updateRow: (id: string, updates: RowUpdateInput) => Promise<void>;
  deleteRow: (id: string) => Promise<void>;
  reorderRows: (groupId: string, fromIndex: number, toIndex: number) => void;

  // Milestones
  milestones: Milestone[];
  addMilestone: (milestone: MilestoneCreateInput, options?: { silent?: boolean }) => Promise<Milestone | undefined>;
  updateMilestone: (id: string, updates: MilestoneUpdateInput, options?: { silent?: boolean }) => Promise<void>;
  deleteMilestone: (id: string, options?: { silent?: boolean }) => Promise<void>;
  getMilestonesForProject: (projectId: string) => Milestone[];
  showMilestoneSuccessToast: (message?: string) => void;
  refetchMilestones: () => Promise<void>;

  // Selection state
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  creatingNewProject: CreatingProjectState | null;
  setCreatingNewProject: (groupId: string | null, dates?: { startDate: Date; endDate: Date }, rowId?: string) => void;

  // Loading states
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [colorIndex, setColorIndex] = useState(0);
  const groupColorsRef = useRef<Record<string, string>>({});

  const getNextProjectColor = useCallback(() => {
    const color = getProjectColor(colorIndex);
    setColorIndex(prev => prev + 1);
    return color;
  }, [colorIndex]);

  const assignGroupColor = useCallback((groupId: string, preferred?: string) => {
    const trimmed = preferred?.trim();
    if (trimmed) {
      groupColorsRef.current[groupId] = trimmed;
      return trimmed;
    }

    if (groupColorsRef.current[groupId]) {
      return groupColorsRef.current[groupId];
    }

    const color = getGroupColor(Object.keys(groupColorsRef.current).length);
    groupColorsRef.current[groupId] = color;
    return color;
  }, []);

  const {
    projects: dbProjects,
    loading: projectsLoading,
    addProject: dbAddProject,
    updateProject: dbUpdateProject,
    deleteProject: dbDeleteProject,
    reorderProjects: dbReorderProjects,
    showSuccessToast: showProjectSuccessToast,
  } = useProjectsHook();

  const {
    groups: dbGroups,
    loading: groupsLoading,
    addGroup: dbAddGroup,
    updateGroup: dbUpdateGroup,
    deleteGroup: dbDeleteGroup,
  } = useGroups();

  const {
    rows: dbRows,
    loading: rowsLoading,
    addRow: dbAddRow,
    updateRow: dbUpdateRow,
    deleteRow: dbDeleteRow,
    reorderRows: dbReorderRows,
  } = useRows();

  const {
    milestones: dbMilestones,
    loading: milestonesLoading,
    addMilestone: dbAddMilestone,
    updateMilestone: dbUpdateMilestone,
    deleteMilestone: dbDeleteMilestone,
    showSuccessToast: showMilestoneSuccessToast,
    refetch: refetchMilestones,
  } = useMilestones();

  const processedMilestones = useMemo<Milestone[]>(() => {
    if (!dbMilestones) {
      return [];
    }

    return dbMilestones
      .map((milestone): Milestone => ({
        id: milestone.id,
        name: milestone.name,
        projectId: milestone.project_id,
        dueDate: new Date(milestone.due_date),
        timeAllocation: milestone.time_allocation,
        endDate: new Date(milestone.due_date),
        timeAllocationHours: milestone.time_allocation_hours ?? milestone.time_allocation,
        startDate: milestone.start_date ? new Date(milestone.start_date) : undefined,
        isRecurring: milestone.is_recurring ?? false,
        recurringConfig: milestone.recurring_config
          ? (milestone.recurring_config as unknown as Milestone['recurringConfig'])
          : undefined,
        userId: milestone.user_id || '',
        createdAt: milestone.created_at ? new Date(milestone.created_at) : new Date(),
        updatedAt: milestone.updated_at ? new Date(milestone.updated_at) : new Date(),
      }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [dbMilestones]);

  const processedGroups = useMemo<ProjectGroup[]>(() => {
    if (!dbGroups) {
      return [];
    }

    return dbGroups.map((group: SupabaseGroupRow & { color?: string }): ProjectGroup => ({
      id: group.id,
      name: group.name,
      userId: group.user_id,
      createdAt: new Date(group.created_at),
      updatedAt: new Date(group.updated_at),
      color: assignGroupColor(group.id, group.color),
    }));
  }, [dbGroups, assignGroupColor]);

  const processedRows = useMemo<Row[]>(() => {
    if (!dbRows) {
      return [];
    }

    return dbRows.map((row: SupabaseRowRow): Row => ({
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      order: row.order_index,
    }));
  }, [dbRows]);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [creatingNewProject, setCreatingNewProjectState] = useState<CreatingProjectState | null>(null);

  const setCreatingNewProject = useCallback((groupId: string | null, dates?: { startDate: Date; endDate: Date }, rowId?: string) => {
    if (groupId) {
      setCreatingNewProjectState({ groupId, ...dates, rowId });
    } else {
      setCreatingNewProjectState(null);
    }
  }, []);

  React.useEffect(() => {
    const handleMilestonesUpdated = () => {
      void refetchMilestones();
    };

    window.addEventListener('milestonesUpdated', handleMilestonesUpdated as EventListener);
    return () => window.removeEventListener('milestonesUpdated', handleMilestonesUpdated as EventListener);
  }, [refetchMilestones]);

  const addProject = useCallback(async (project: ProjectCreationInput) => {
    const projectWithColor = {
      ...project,
      color: project.color ?? getNextProjectColor(),
    };
    return dbAddProject(projectWithColor);
  }, [dbAddProject, getNextProjectColor]);

  const updateProject = useCallback((id: string, updates: ProjectUpdateInput, options?: { silent?: boolean }) => {
    return dbUpdateProject(id, updates, options);
  }, [dbUpdateProject]);

  const deleteProject = useCallback((id: string) => dbDeleteProject(id), [dbDeleteProject]);

  const addGroup = useCallback(async (group: GroupCreateInput): Promise<ProjectGroup> => {
    const payload: Omit<SupabaseGroupInsert, 'user_id'> = {
      name: group.name,
    };
    const created = await dbAddGroup(payload);
    const color = assignGroupColor(created.id, group.color);
    return {
      id: created.id,
      name: created.name,
      userId: created.user_id,
      createdAt: new Date(created.created_at),
      updatedAt: new Date(created.updated_at),
      color,
    };
  }, [dbAddGroup, assignGroupColor]);

  const updateGroup = useCallback(async (id: string, updates: GroupUpdateInput): Promise<ProjectGroup> => {
    const supabaseUpdates: SupabaseGroupUpdate = {};
    if (updates.name !== undefined) {
      supabaseUpdates.name = updates.name;
    }

    const updated = await dbUpdateGroup(id, supabaseUpdates);
    const color = assignGroupColor(updated.id);
    return {
      id: updated.id,
      name: updated.name,
      userId: updated.user_id,
      createdAt: new Date(updated.created_at),
      updatedAt: new Date(updated.updated_at),
      color,
    };
  }, [dbUpdateGroup, assignGroupColor]);

  const deleteGroup = useCallback(async (id: string) => {
    await dbDeleteGroup(id);
    if (groupColorsRef.current[id]) {
      const { [id]: _removed, ...remaining } = groupColorsRef.current;
      groupColorsRef.current = remaining;
    }
  }, [dbDeleteGroup]);

  const addRow = useCallback(async (row: RowCreateInput) => {
    const payload: Omit<SupabaseRowInsert, 'user_id'> = {
      group_id: row.groupId,
      name: row.name,
      order_index: row.order,
    };
    await dbAddRow(payload);
  }, [dbAddRow]);

  const updateRow = useCallback(async (id: string, updates: RowUpdateInput) => {
    const supabaseUpdates: SupabaseRowUpdate = {};
    if (updates.groupId !== undefined) supabaseUpdates.group_id = updates.groupId;
    if (updates.name !== undefined) supabaseUpdates.name = updates.name;
    if (updates.order !== undefined) supabaseUpdates.order_index = updates.order;
    await dbUpdateRow(id, supabaseUpdates);
  }, [dbUpdateRow]);

  const deleteRow = useCallback(async (id: string) => {
    await dbDeleteRow(id);
  }, [dbDeleteRow]);

  const getMilestonesForProject = useCallback((projectId: string) => {
    return processedMilestones.filter(milestone => milestone.projectId === projectId);
  }, [processedMilestones]);

  const addMilestone = useCallback(async (milestone: MilestoneCreateInput, options?: { silent?: boolean }) => {
    const dueDateSource = milestone.dueDate ?? milestone.endDate;
    if (!dueDateSource) {
      throw new Error('Milestone due date is required.');
    }

    const payload: Omit<SupabaseMilestoneInsert, 'user_id'> = {
      name: milestone.name,
      project_id: milestone.projectId,
      due_date: dueDateSource instanceof Date ? dueDateSource.toISOString() : dueDateSource,
      time_allocation: milestone.timeAllocation,
      time_allocation_hours: milestone.timeAllocationHours ?? milestone.timeAllocation,
    };

    if (milestone.startDate !== undefined) {
      payload.start_date = milestone.startDate instanceof Date ? milestone.startDate.toISOString() : milestone.startDate;
    }

    if (milestone.isRecurring !== undefined) {
      payload.is_recurring = milestone.isRecurring;
    }

    if (milestone.recurringConfig !== undefined) {
      payload.recurring_config = milestone.recurringConfig as unknown as SupabaseMilestoneInsert['recurring_config'];
    }

    const result = await dbAddMilestone(payload, options);
    await refetchMilestones();
    
    // Convert database result to Milestone type
    if (result) {
      return {
        id: result.id,
        name: result.name,
        projectId: result.project_id,
        endDate: new Date(result.due_date),
        dueDate: new Date(result.due_date),
        timeAllocation: result.time_allocation,
        timeAllocationHours: result.time_allocation_hours,
        startDate: result.start_date ? new Date(result.start_date) : undefined,
        isRecurring: result.is_recurring ?? undefined,
        recurringConfig: result.recurring_config as any,
        userId: result.user_id,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at)
      };
    }
    
    return undefined;
  }, [dbAddMilestone, refetchMilestones]);

  const updateMilestone = useCallback(async (id: string, updates: MilestoneUpdateInput, options?: { silent?: boolean }) => {
    const dbUpdates: SupabaseMilestoneUpdate = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;

    if (updates.timeAllocation !== undefined) {
      dbUpdates.time_allocation = updates.timeAllocation;
      dbUpdates.time_allocation_hours = updates.timeAllocationHours ?? updates.timeAllocation;
    }

    if (updates.timeAllocationHours !== undefined) {
      dbUpdates.time_allocation = updates.timeAllocationHours;
      dbUpdates.time_allocation_hours = updates.timeAllocationHours;
    }

    if (updates.dueDate !== undefined) {
      dbUpdates.due_date = updates.dueDate instanceof Date ? updates.dueDate.toISOString() : updates.dueDate;
    }

    if (updates.endDate !== undefined) {
      dbUpdates.due_date = updates.endDate instanceof Date ? updates.endDate.toISOString() : updates.endDate;
    }

    if (updates.startDate !== undefined) {
      dbUpdates.start_date = updates.startDate instanceof Date ? updates.startDate.toISOString() : updates.startDate;
    }

    if (updates.isRecurring !== undefined) {
      dbUpdates.is_recurring = updates.isRecurring;
    }

    if (updates.recurringConfig !== undefined) {
      dbUpdates.recurring_config = updates.recurringConfig as unknown as SupabaseMilestoneUpdate['recurring_config'];
    }

    await dbUpdateMilestone(id, dbUpdates, options);
  }, [dbUpdateMilestone]);

  const deleteMilestone = useCallback(async (id: string, options?: { silent?: boolean }) => {
    await dbDeleteMilestone(id, options);
  }, [dbDeleteMilestone]);

  const isLoading = projectsLoading || groupsLoading || rowsLoading || milestonesLoading;

  const contextValue: ProjectContextType = {
    projects: dbProjects ?? [],
    addProject,
    updateProject,
    deleteProject,
    reorderProjects: dbReorderProjects,
    showProjectSuccessToast,
    groups: processedGroups,
    addGroup,
    updateGroup,
    deleteGroup,
    reorderGroups: () => {},
    rows: processedRows,
    addRow,
    updateRow,
    deleteRow,
    reorderRows: dbReorderRows,
    milestones: processedMilestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    getMilestonesForProject,
    showMilestoneSuccessToast,
    refetchMilestones,
    selectedProjectId,
    setSelectedProjectId,
    creatingNewProject,
    setCreatingNewProject,
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
    const error = new Error('useProjectContext must be used within a ProjectProvider');
    ErrorHandlingService.handle(error, { source: 'ProjectContext', action: 'useProjectContext was called outside of ProjectProvider' });
    console.error('Stack trace:', error.stack);
    throw error;
  }
  return context;
}

// Export types
export type { Project, Group, Row } from '@/types/core';

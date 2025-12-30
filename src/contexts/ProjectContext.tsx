/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import type { PhaseDTO, Project, Group, Row, Phase } from '@/types/core';
import { useProjects as useProjectsHook } from '@/hooks/useProjects';
import { useGroups } from '@/hooks/useGroups';
import { useRows } from '@/hooks/useRows';
import { usePhases } from '@/hooks/usePhases';
import { getProjectColor, getGroupColor } from '@/constants';
import type { Database } from '@/integrations/supabase/types';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import { Group as GroupEntity } from '@/domain/entities/Group';
type SupabaseGroupRow = Database['public']['Tables']['groups']['Row'];
type SupabaseRowRow = Database['public']['Tables']['rows']['Row'];
// Note: Table renamed from 'milestones' to 'phases' in database
type SupabaseMilestoneRow = Database['public']['Tables']['phases']['Row'];
type SupabaseMilestoneInsert = Database['public']['Tables']['phases']['Insert'];
type SupabaseGroupInsert = Database['public']['Tables']['groups']['Insert'];
type SupabaseGroupUpdate = Database['public']['Tables']['groups']['Update'];
type SupabaseRowInsert = Database['public']['Tables']['rows']['Insert'];
type SupabaseRowUpdate = Database['public']['Tables']['rows']['Update'];
type SupabaseMilestoneUpdate = Database['public']['Tables']['phases']['Update'];

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
  recurringConfig?: PhaseDTO['recurringConfig'];
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
  phases: PhaseDTO[];
  addPhase: (milestone: MilestoneCreateInput, options?: { silent?: boolean }) => Promise<PhaseDTO | undefined>;
  updatePhase: (id: string, updates: MilestoneUpdateInput, options?: { silent?: boolean }) => Promise<void>;
  deletePhase: (id: string, options?: { silent?: boolean }) => Promise<void>;
  getMilestonesForProject: (projectId: string) => PhaseDTO[];
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
    phases: dbMilestones,
    loading: milestonesLoading,
    addPhase: dbAddMilestone,
    updatePhase: dbUpdateMilestone,
    deletePhase: dbDeleteMilestone,
    showSuccessToast: showMilestoneSuccessToast,
    refetch: refetchMilestones,
  } = usePhases();

  const processedMilestones = useMemo<PhaseDTO[]>(() => {
    if (!dbMilestones) {
      return [];
    }

    return dbMilestones
      .map((phase): Phase => ({
        id: phase.id,
        name: phase.name,
        projectId: phase.project_id,
        dueDate: new Date(phase.end_date),
        timeAllocation: phase.time_allocation,
        endDate: new Date(phase.end_date),
        timeAllocationHours: phase.time_allocation_hours ?? phase.time_allocation,
        startDate: phase.start_date ? new Date(phase.start_date) : undefined,
        isRecurring: phase.is_recurring ?? false,
        recurringConfig: phase.recurring_config
          ? (phase.recurring_config as unknown as PhaseDTO['recurringConfig'])
          : undefined,
        userId: phase.user_id || '',
        createdAt: phase.created_at ? new Date(phase.created_at) : new Date(),
        updatedAt: phase.updated_at ? new Date(phase.updated_at) : new Date(),
      }))
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  }, [dbMilestones]);

  const processedGroups = useMemo<ProjectGroup[]>(() => {
    if (!dbGroups) {
      return [];
    }

    return dbGroups.map((group: SupabaseGroupRow & { color?: string }): ProjectGroup => {
      const groupData = GroupEntity.fromDatabase(group).toData();
      return {
        ...groupData,
        color: assignGroupColor(group.id, group.color),
      };
    });
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
      // Ensure endDate is provided, default to startDate + 30 days if not specified
      endDate: project.endDate ?? new Date(new Date(project.startDate).getTime() + 30 * 24 * 60 * 60 * 1000),
    };
    return dbAddProject(projectWithColor as Parameters<typeof dbAddProject>[0]);
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
      userId: created.userId,
      createdAt: new Date(created.createdAt),
      updatedAt: new Date(created.updatedAt),
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
      userId: updated.userId,
      createdAt: new Date(updated.createdAt),
      updatedAt: new Date(updated.updatedAt),
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
    return processedMilestones.filter(phase => phase.projectId === projectId);
  }, [processedMilestones]);

  const addPhase = useCallback(async (phase: MilestoneCreateInput, options?: { silent?: boolean }) => {
    const dueDateSource = phase.dueDate ?? phase.endDate;
    if (!dueDateSource) {
      throw new Error('Milestone due date is required.');
    }

    const endDateIso = dueDateSource instanceof Date ? dueDateSource.toISOString() : dueDateSource;
    const startDateIso = phase.startDate 
      ? (phase.startDate instanceof Date ? phase.startDate.toISOString() : phase.startDate)
      : endDateIso; // Default start_date to end_date if not provided

    const payload: Omit<SupabaseMilestoneInsert, 'user_id'> = {
      name: phase.name,
      project_id: phase.projectId,
      end_date: endDateIso,
      start_date: startDateIso,
      time_allocation: phase.timeAllocation,
      time_allocation_hours: phase.timeAllocationHours ?? phase.timeAllocation,
    };

    if (phase.isRecurring !== undefined) {
      payload.is_recurring = phase.isRecurring;
    }

    if (phase.recurringConfig !== undefined) {
      payload.recurring_config = phase.recurringConfig as unknown as SupabaseMilestoneInsert['recurring_config'];
    }

    const result = await dbAddMilestone(payload, options);
    await refetchMilestones();
    
    // Convert database result to Phase type
    if (result) {
      return {
        id: result.id,
        name: result.name,
        projectId: result.projectId,
        endDate: new Date(result.endDate),
        dueDate: new Date(result.endDate),
        timeAllocation: result.timeAllocation,
        timeAllocationHours: result.timeAllocationHours ?? result.timeAllocation,
        startDate: result.startDate ? new Date(result.startDate) : new Date(result.endDate),
        isRecurring: result.isRecurring ?? false,
        recurringConfig: result.recurringConfig,
        userId: result.userId,
        createdAt: new Date(result.createdAt),
        updatedAt: new Date(result.updatedAt)
      } satisfies import('@/types/core').PhaseDTO;
    }
    
    return undefined;
  }, [dbAddMilestone, refetchMilestones]);

  const updatePhase = useCallback(async (id: string, updates: MilestoneUpdateInput, options?: { silent?: boolean }) => {
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
      dbUpdates.end_date = updates.dueDate instanceof Date ? updates.dueDate.toISOString() : updates.dueDate;
    }

    if (updates.endDate !== undefined) {
      dbUpdates.end_date = updates.endDate instanceof Date ? updates.endDate.toISOString() : updates.endDate;
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

  const deletePhase = useCallback(async (id: string, options?: { silent?: boolean }) => {
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
    phases: processedMilestones,
    addPhase,
    updatePhase,
    deletePhase,
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

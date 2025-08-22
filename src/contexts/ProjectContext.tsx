import React, { createContext, useContext, useState, useCallback } from 'react';
import { Project, Group, Row } from '@/types/core';
import { useProjects as useProjectsHook } from '@/hooks/useProjects';
import { useGroups } from '@/hooks/useGroups';
import { useRows } from '@/hooks/useRows';
import { useMilestones } from '@/hooks/useMilestones';
import { getProjectColor, getGroupColor } from '@/constants';
import type { Database } from '@/integrations/supabase/types';

type Milestone = Database['public']['Tables']['milestones']['Row'];

interface ProjectContextType {
  // Projects
  projects: any[]; // Using any[] for now to avoid type conflicts
  addProject: (project: any) => Promise<any>;
  updateProject: (id: string, updates: any) => void;
  deleteProject: (id: string) => void;
  reorderProjects: (groupId: string, fromIndex: number, toIndex: number) => void;
  
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
  addMilestone: (milestone: any) => Promise<void>;
  updateMilestone: (id: string, updates: any) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  getMilestonesForProject: (projectId: string) => Milestone[];
  
  // Selection state
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  creatingNewProject: { groupId: string; rowId?: string; startDate?: Date; endDate?: Date } | null;
  setCreatingNewProject: (groupId: string | null, dates?: { startDate: Date; endDate: Date }, rowId?: string) => void;
  
  // Loading states
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

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

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  // Database hooks
  const { 
    projects: dbProjects, 
    loading: projectsLoading, 
    addProject: dbAddProject, 
    updateProject: dbUpdateProject, 
    deleteProject: dbDeleteProject, 
    reorderProjects: dbReorderProjects 
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
    deleteMilestone: dbDeleteMilestone
  } = useMilestones(); // Fetch all milestones

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
    return dbMilestones?.filter(milestone => milestone.project_id === projectId) || [];
  }, [dbMilestones]);

  // Wrapped milestone functions to match expected signatures
  const addMilestone = useCallback(async (milestone: any): Promise<void> => {
    await dbAddMilestone(milestone);
  }, [dbAddMilestone]);

  const updateMilestone = useCallback(async (id: string, updates: any): Promise<void> => {
    await dbUpdateMilestone(id, updates);
  }, [dbUpdateMilestone]);

  const deleteMilestone = useCallback(async (id: string): Promise<void> => {
    await dbDeleteMilestone(id);
  }, [dbDeleteMilestone]);

  const isLoading = projectsLoading || groupsLoading || rowsLoading || milestonesLoading;

  const contextValue: ProjectContextType = {
    // Projects
    projects: dbProjects || [],
    addProject,
    updateProject: dbUpdateProject,
    deleteProject: dbDeleteProject,
    reorderProjects: dbReorderProjects,
    
    // Groups
    groups: dbGroups || [],
    addGroup,
    updateGroup: dbUpdateGroup,
    deleteGroup: dbDeleteGroup,
    reorderGroups: () => {}, // TODO: Implement if needed
    
    // Rows
    rows: dbRows || [],
    addRow: dbAddRow,
    updateRow: dbUpdateRow,
    deleteRow: dbDeleteRow,
    reorderRows: dbReorderRows,
    
    // Milestones
    milestones: dbMilestones || [],
    addMilestone,
    updateMilestone,
    deleteMilestone,
    getMilestonesForProject,
    
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
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}

// Export types
export type { Project, Group, Row } from '@/types/core';

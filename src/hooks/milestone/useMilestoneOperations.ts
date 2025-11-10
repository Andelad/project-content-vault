import { useState, useCallback } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ProjectMilestoneOrchestrator } from '@/services';
import { Milestone } from '@/types/core';
import { useToast } from '@/hooks/use-toast';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

export interface LocalMilestone extends Omit<Milestone, 'id'> {
  id?: string;
  isNew?: boolean;
}

interface UseMilestoneOperationsConfig {
  projectId?: string;
  projectEstimatedHours: number;
  projectStartDate: Date;
  projectEndDate: Date;
  isCreatingProject?: boolean;
  localMilestonesState?: {
    milestones: LocalMilestone[];
    setMilestones: (milestones: LocalMilestone[]) => void;
  };
  trackedAddMilestone?: (milestone: any, options?: { silent?: boolean }) => Promise<any>;
}

/**
 * Hook for managing milestone CRUD operations
 * Coordinates React state with ProjectMilestoneOrchestrator service
 * Handles both local state (new projects) and database operations (existing projects)
 */
export function useMilestoneOperations(config: UseMilestoneOperationsConfig) {
  const {
    projectId,
    projectEstimatedHours,
    projectStartDate,
    projectEndDate,
    isCreatingProject = false,
    localMilestonesState,
    trackedAddMilestone
  } = config;

  const {
    milestones: contextMilestones,
    addMilestone: contextAddMilestone,
    updateMilestone: contextUpdateMilestone,
    deleteMilestone: contextDeleteMilestone,
    refetchMilestones
  } = useProjectContext();

  const { toast } = useToast();
  const [localMilestones, setLocalMilestones] = useState<LocalMilestone[]>([]);

  // Use tracked version if provided (for rollback support), otherwise use context version
  const addMilestoneToContext = trackedAddMilestone || contextAddMilestone;

  // Get all milestones for this project
  const projectMilestones = isCreatingProject && localMilestonesState
    ? localMilestonesState.milestones || []
    : projectId
    ? [...(Array.isArray(contextMilestones) ? contextMilestones.filter(m =>
        m.projectId === projectId &&
        m.dueDate >= projectStartDate &&
        m.dueDate <= projectEndDate
      ) : []), ...localMilestones.filter(m => 'isNew' in m && m.isNew)]
    : localMilestones || [];

  // Create a new milestone
  const createMilestone = useCallback(async (milestone: LocalMilestone) => {
    if (isCreatingProject && localMilestonesState) {
      localMilestonesState.setMilestones([...localMilestonesState.milestones, milestone]);
      return milestone;
    } else if (projectId) {
      try {
        const created = await addMilestoneToContext(milestone);
        await refetchMilestones();
        return created;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'useMilestoneOperations',
          action: 'createMilestone'
        });
        toast({
          title: "Error",
          description: "Failed to create milestone. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    } else {
      setLocalMilestones(prev => [...prev, milestone]);
      return milestone;
    }
  }, [isCreatingProject, localMilestonesState, projectId, addMilestoneToContext, refetchMilestones, toast]);

  // Update an existing milestone
  const updateMilestone = useCallback(async (milestoneId: string, updates: Partial<Milestone>) => {
    if (isCreatingProject && localMilestonesState) {
      const updated = localMilestonesState.milestones.map(m =>
        m.id === milestoneId ? { ...m, ...updates } : m
      );
      localMilestonesState.setMilestones(updated);
      return true;
    } else if (projectId) {
      try {
        await contextUpdateMilestone(milestoneId, updates, { silent: true });
        return true;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'useMilestoneOperations',
          action: 'updateMilestone',
          metadata: { milestoneId }
        });
        toast({
          title: "Error",
          description: "Failed to update milestone. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    } else {
      setLocalMilestones(prev => prev.map(m =>
        m.id === milestoneId ? { ...m, ...updates } : m
      ));
      return true;
    }
  }, [isCreatingProject, localMilestonesState, projectId, contextUpdateMilestone, toast]);

  // Delete a milestone
  const deleteMilestone = useCallback(async (milestoneId: string) => {
    if (isCreatingProject && localMilestonesState) {
      const filtered = localMilestonesState.milestones.filter(m => m.id !== milestoneId);
      localMilestonesState.setMilestones(filtered);
      return true;
    } else if (projectId) {
      try {
        await contextDeleteMilestone(milestoneId, { silent: true });
        return true;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'useMilestoneOperations',
          action: 'deleteMilestone',
          metadata: { milestoneId }
        });
        toast({
          title: "Error",
          description: "Failed to delete milestone. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    } else {
      setLocalMilestones(prev => prev.filter(m => m.id !== milestoneId));
      return true;
    }
  }, [isCreatingProject, localMilestonesState, projectId, contextDeleteMilestone, toast]);

  // Update milestone property (delegates to orchestrator)
  const updateMilestoneProperty = useCallback(async (
    milestoneId: string,
    property: string,
    value: any
  ) => {
    const validMilestones = projectMilestones.filter(m => m.id) as Milestone[];
    const result = await ProjectMilestoneOrchestrator.updateMilestoneProperty(
      milestoneId,
      property,
      value,
      {
        projectMilestones: validMilestones,
        projectEstimatedHours,
        localMilestones,
        isCreatingProject,
        localMilestonesState,
        addMilestone: createMilestone,
        updateMilestone: async (id: string, updates: any, options?: any) => {
          await updateMilestone(id, updates);
        },
        setLocalMilestones
      }
    );

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [projectMilestones, projectEstimatedHours, localMilestones, isCreatingProject, localMilestonesState, createMilestone, updateMilestone, toast]);

  return {
    projectMilestones,
    localMilestones,
    setLocalMilestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    updateMilestoneProperty,
    refetchMilestones
  };
}

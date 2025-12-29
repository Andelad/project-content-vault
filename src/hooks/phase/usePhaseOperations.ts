import { useState, useCallback, useMemo } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ProjectPhaseOrchestrator } from '@/services';
import { Phase } from '@/types/core';
import { useToast } from '@/hooks/use-toast';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

export interface LocalPhase extends Omit<Milestone, 'id'> {
  id?: string;
  isNew?: boolean;
}

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

interface UseMilestoneOperationsConfig {
  projectId?: string;
  projectEstimatedHours: number;
  projectStartDate: Date;
  projectEndDate: Date;
  isCreatingProject?: boolean;
  localPhasesState?: {
    phases: LocalPhase[];
    setPhases: (phases: LocalPhase[]) => void;
  };
  trackedAddMilestone?: (
    milestone: LocalPhase | MilestoneCreateInput,
    options?: { silent?: boolean }
  ) => Promise<Milestone | undefined>;
}

/**
 * Hook for managing milestone CRUD operations
 * Coordinates React state with ProjectPhaseOrchestrator service
 * Handles both local state (new projects) and database operations (existing projects)
 */
export function usePhaseOperations(config: UseMilestoneOperationsConfig) {
  const {
    projectId,
    projectEstimatedHours,
    projectStartDate,
    projectEndDate,
    isCreatingProject = false,
    localPhasesState,
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
  const [localPhases, setLocalPhases] = useState<LocalPhase[]>([]);

  // Use tracked version if provided (for rollback support), otherwise use context version
  const addMilestoneToContext = trackedAddMilestone || contextAddMilestone;

  // Get all milestones for this project
  const projectPhases = useMemo(() => {
    if (isCreatingProject && localPhasesState) {
      return localPhasesState.phases || [];
    }

    if (projectId) {
      const contextList = Array.isArray(contextMilestones)
        ? contextMilestones.filter(p =>
            m.projectId === projectId &&
            m.dueDate >= projectStartDate &&
            m.dueDate <= projectEndDate
          )
        : [];
      const localNew = localPhases.filter(p => 'isNew' in m && m.isNew);
      return [...contextList, ...localNew];
    }

    return localPhases || [];
  }, [contextMilestones, isCreatingProject, localPhases, localPhasesState, projectEndDate, projectId, projectStartDate]);

  // Create a new milestone
  const createMilestone = useCallback(async (
    milestone: LocalPhase,
    options?: { silent?: boolean }
  ): Promise<Phase> => {
    if (isCreatingProject && localPhasesState) {
      // For local creation, generate a temporary id if not present
      const milestoneWithId: Phase = {
        ...milestone,
        id: milestone.id || `temp-${Date.now()}`,
      } as Milestone;
      localPhasesState.setMilestones([...localPhasesState.phases, milestoneWithId]);
      return milestoneWithId;
    } else if (projectId) {
      try {
        const created = await addMilestoneToContext(milestone as MilestoneCreateInput, options);
        await refetchMilestones();
        if (!created) {
          throw new Error('Milestone creation returned undefined');
        }
        return created;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'usePhaseOperations',
          action: 'createMilestone'
        });
        toast({
          title: "Error",
          description: "Failed to create phase. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    } else {
      // For standalone local creation, generate a temporary id if not present
      const milestoneWithId: Phase = {
        ...milestone,
        id: milestone.id || `temp-${Date.now()}`,
      } as Milestone;
      setLocalPhases(prev => [...prev, milestoneWithId]);
      return milestoneWithId;
    }
  }, [isCreatingProject, localPhasesState, projectId, addMilestoneToContext, refetchMilestones, toast]);

  // Update an existing milestone
  const updateMilestone = useCallback(async (milestoneId: string, updates: Partial<Phase>) => {
    if (isCreatingProject && localPhasesState) {
      const updated = localPhasesState.phases.map(p =>
        m.id === milestoneId ? { ...p, ...updates } : m
      );
      localPhasesState.setMilestones(updated);
      return true;
    } else if (projectId) {
      try {
        await contextUpdateMilestone(milestoneId, updates, { silent: true });
        return true;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'usePhaseOperations',
          action: 'updateMilestone',
          metadata: { milestoneId }
        });
        toast({
          title: "Error",
          description: "Failed to update phase. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    } else {
      setLocalPhases(prev => prev.map(p =>
        m.id === milestoneId ? { ...p, ...updates } : m
      ));
      return true;
    }
  }, [isCreatingProject, localPhasesState, projectId, contextUpdateMilestone, toast]);

  // Delete a milestone
  const deleteMilestone = useCallback(async (milestoneId: string) => {
    if (isCreatingProject && localPhasesState) {
      const filtered = localPhasesState.phases.filter(p => m.id !== milestoneId);
      localPhasesState.setMilestones(filtered);
      return true;
    } else if (projectId) {
      try {
        await contextDeleteMilestone(milestoneId, { silent: true });
        return true;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'usePhaseOperations',
          action: 'deleteMilestone',
          metadata: { milestoneId }
        });
        toast({
          title: "Error",
          description: "Failed to delete phase. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    } else {
      setLocalPhases(prev => prev.filter(p => m.id !== milestoneId));
      return true;
    }
  }, [isCreatingProject, localPhasesState, projectId, contextDeleteMilestone, toast]);

  // Update milestone property (delegates to orchestrator)
  const updateMilestoneProperty = useCallback(async <K extends keyof Milestone>(
    milestoneId: string,
    property: K,
    value: Milestone[K]
  ) => {
    const validMilestones = projectPhases.filter(p => m.id) as Milestone[];
    const result = await ProjectPhaseOrchestrator.updateMilestoneProperty(
      milestoneId,
      property,
      value,
      {
        projectPhases: validMilestones,
        projectEstimatedHours,
        localPhases,
        isCreatingProject,
        localPhasesState,
        addMilestone: createMilestone,
        updateMilestone: async (id: string, updates: Partial<Phase>) => {
          await updateMilestone(id, updates);
        },
        setLocalPhases
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
  }, [projectPhases, projectEstimatedHours, localPhases, isCreatingProject, localPhasesState, createMilestone, updateMilestone, toast]);

  return {
    projectPhases,
    localPhases,
    setLocalPhases,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    updateMilestoneProperty,
    refetchMilestones
  };
}

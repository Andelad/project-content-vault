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
  recurringConfig?: Phase['recurringConfig'];
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
    addPhase: contextAddMilestone,
    updatePhase: contextUpdateMilestone,
    deletePhase: contextDeleteMilestone,
    refetchPhases
  } = useProjectContext();

  const { toast } = useToast();
  const [localPhases, setLocalPhases] = useState<LocalPhase[]>([]);

  // Use tracked version if provided (for rollback support), otherwise use context version
  const addPhaseToContext = trackedAddMilestone || contextAddMilestone;

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
  const createPhase = useCallback(async (
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
        const created = await addPhaseToContext(milestone as MilestoneCreateInput, options);
        await refetchPhases();
        if (!created) {
          throw new Error('Milestone creation returned undefined');
        }
        return created;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'usePhaseOperations',
          action: 'createPhase'
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
  }, [isCreatingProject, localPhasesState, projectId, addPhaseToContext, refetchPhases, toast]);

  // Update an existing milestone
  const updatePhase = useCallback(async (milestoneId: string, updates: Partial<Phase>) => {
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
          action: 'updatePhase',
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
  const deletePhase = useCallback(async (milestoneId: string) => {
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
          action: 'deletePhase',
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
  const updatePhaseProperty = useCallback(async <K extends keyof Milestone>(
    milestoneId: string,
    property: K,
    value: Phase[K]
  ) => {
    const validMilestones = projectPhases.filter(p => m.id) as Milestone[];
    const result = await ProjectPhaseOrchestrator.updatePhaseProperty(
      milestoneId,
      property,
      value,
      {
        projectPhases: validMilestones,
        projectEstimatedHours,
        localPhases,
        isCreatingProject,
        localPhasesState,
        addPhase: createPhase,
        updatePhase: async (id: string, updates: Partial<Phase>) => {
          await updatePhase(id, updates);
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
  }, [projectPhases, projectEstimatedHours, localPhases, isCreatingProject, localPhasesState, createPhase, updatePhase, toast]);

  return {
    projectPhases,
    localPhases,
    setLocalPhases,
    createPhase,
    updatePhase,
    deletePhase,
    updatePhaseProperty,
    refetchPhases
  };
}

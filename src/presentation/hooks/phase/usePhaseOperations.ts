import { useState, useCallback, useMemo } from 'react';
import { useProjectContext } from '@/presentation/contexts/ProjectContext';
import { PhaseOrchestrator } from '@/application/orchestrators/PhaseOrchestrator';;
import type { PhaseDTO, Phase } from '@/shared/types/core';
import { useToast } from '@/presentation/hooks/ui/use-toast';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';

export interface LocalPhase extends Omit<PhaseDTO, 'id'> {
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
  recurringConfig?: PhaseDTO['recurringConfig'];
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
  ) => Promise<PhaseDTO | undefined>;
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
    phases: contextMilestones,
    addPhase: contextAddMilestone,
    updatePhase: contextUpdateMilestone,
    deletePhase: contextDeleteMilestone,
    refetchMilestones: refetchPhases
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
        ? contextMilestones.filter(p => {
            // Always include recurring templates regardless of date range
            if (p.isRecurring === true) return p.projectId === projectId;
            
            // For regular phases, filter by project and date range
            return p.projectId === projectId &&
              p.dueDate >= projectStartDate &&
              p.dueDate <= projectEndDate;
          })
        : [];
      const localNew = localPhases.filter(p => 'isNew' in p && p.isNew);
      return [...contextList, ...localNew];
    }

    return localPhases || [];
  }, [contextMilestones, isCreatingProject, localPhases, localPhasesState, projectEndDate, projectId, projectStartDate]);

  // Create a new milestone
  const createPhase = useCallback(async (
    milestone: LocalPhase,
    options?: { silent?: boolean }
  ): Promise<PhaseDTO> => {
    if (isCreatingProject && localPhasesState) {
      // For local creation, generate a temporary id if not present
      const milestoneWithId: PhaseDTO = {
        ...milestone,
        id: milestone.id || `temp-${Date.now()}`,
      } as PhaseDTO;
      localPhasesState.setPhases([...localPhasesState.phases, milestoneWithId]);
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
      const milestoneWithId: PhaseDTO = {
        ...milestone,
        id: milestone.id || `temp-${Date.now()}`,
      } as PhaseDTO;
      setLocalPhases(prev => [...prev, milestoneWithId]);
      return milestoneWithId;
    }
  }, [isCreatingProject, localPhasesState, projectId, addPhaseToContext, refetchPhases, toast]);

  // Update an existing phase (legacy APIs still use milestone ids)
  const updatePhase = useCallback(async (milestoneId: string, updates: Partial<PhaseDTO>) => {
    if (isCreatingProject && localPhasesState) {
      const updated = localPhasesState.phases.map(p =>
        p.id === milestoneId ? { ...p, ...updates } : p
      );
      localPhasesState.setPhases(updated);
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
        p.id === milestoneId ? { ...p, ...updates } : p
      ));
      return true;
    }
  }, [isCreatingProject, localPhasesState, projectId, contextUpdateMilestone, toast]);

  // Delete a phase (legacy APIs still use milestone ids)
  const deletePhase = useCallback(async (milestoneId: string) => {
    if (isCreatingProject && localPhasesState) {
      const filtered = localPhasesState.phases.filter(p => p.id !== milestoneId);
      localPhasesState.setPhases(filtered);
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
      setLocalPhases(prev => prev.filter(p => p.id !== milestoneId));
      return true;
    }
  }, [isCreatingProject, localPhasesState, projectId, contextDeleteMilestone, toast]);

  // Update phase property (delegates to orchestrator; legacy milestone ids supported)
  const updatePhaseProperty = useCallback(async <K extends keyof PhaseDTO>(
    milestoneId: string,
    property: K,
    value: PhaseDTO[K]
  ) => {
    const validMilestones = projectPhases.filter(p => p.id) as PhaseDTO[];
    const result = await PhaseOrchestrator.updatePhaseProperty(
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
        updatePhase: async (id: string, updates: Partial<PhaseDTO>) => {
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

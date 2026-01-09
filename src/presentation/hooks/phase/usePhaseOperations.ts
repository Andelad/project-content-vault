import { useState, useCallback, useMemo } from 'react';
import { useProjectContext } from '@/presentation/contexts/ProjectContext';
import { PhaseOrchestrator } from '@/application/orchestrators/PhaseOrchestrator';;
import type { PhaseDTO, Phase, Project } from '@/shared/types/core';
import { useToast } from '@/presentation/hooks/ui/use-toast';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';

export interface LocalPhase extends Omit<PhaseDTO, 'id'> {
  id?: string;
  isNew?: boolean;
}

type PhaseCreateInput = {
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
  trackedAddPhase?: (
    phase: LocalPhase | PhaseCreateInput,
    options?: { silent?: boolean }
  ) => Promise<PhaseDTO | undefined>;
}

/**
 * Hook for managing phase CRUD operations
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
    trackedAddPhase
  } = config;

  const {
    phases: contextPhases,
    addPhase: contextAddMilestone,
    updatePhase: contextUpdateMilestone,
    deletePhase: contextDeleteMilestone,
    refetchPhases: refetchPhases,
    updateProject: contextUpdateProject
  } = useProjectContext();

  const { toast } = useToast();
  const [localPhases, setLocalPhases] = useState<LocalPhase[]>([]);

  // Use tracked version if provided (for rollback support), otherwise use context version
  const addPhaseToContext = trackedAddPhase || contextAddMilestone;

  // Get all phases for this project
  const projectPhases = useMemo(() => {
    if (isCreatingProject && localPhasesState) {
      return localPhasesState.phases || [];
    }

    if (projectId) {
      const contextList = Array.isArray(contextPhases)
        ? contextPhases.filter(p => {
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
  }, [contextPhases, isCreatingProject, localPhases, localPhasesState, projectEndDate, projectId, projectStartDate]);

  // Create a new phase
  const createPhase = useCallback(async (
    phase: LocalPhase,
    options?: { silent?: boolean }
  ): Promise<PhaseDTO> => {
    if (isCreatingProject && localPhasesState) {
      // For local creation, generate a temporary id if not present
      const phaseWithId: PhaseDTO = {
        ...phase,
        id: phase.id || `temp-${Date.now()}`,
      } as PhaseDTO;
      localPhasesState.setPhases([...localPhasesState.phases, phaseWithId]);
      return phaseWithId;
    } else if (projectId) {
      try {
        const created = await addPhaseToContext(phase as PhaseCreateInput, options);
        await refetchPhases();
        if (!created) {
          throw new Error('Phase creation returned undefined');
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
      const phaseWithId: PhaseDTO = {
        ...phase,
        id: phase.id || `temp-${Date.now()}`,
      } as PhaseDTO;
      setLocalPhases(prev => [...prev, phaseWithId]);
      return phaseWithId;
    }
  }, [isCreatingProject, localPhasesState, projectId, addPhaseToContext, refetchPhases, toast]);

  // Update an existing phase
  const updatePhase = useCallback(async (phaseId: string, updates: Partial<PhaseDTO>) => {
    if (isCreatingProject && localPhasesState) {
      const updated = localPhasesState.phases.map(p =>
        p.id === phaseId ? { ...p, ...updates } : p
      );
      localPhasesState.setPhases(updated);
      return true;
    } else if (projectId) {
      try {
        await contextUpdateMilestone(phaseId, updates, { silent: true });
        return true;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'usePhaseOperations',
          action: 'updatePhase',
          metadata: { phaseId }
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
        p.id === phaseId ? { ...p, ...updates } : p
      ));
      return true;
    }
  }, [isCreatingProject, localPhasesState, projectId, contextUpdateMilestone, toast]);

  // Delete a phase
  const deletePhase = useCallback(async (phaseId: string) => {
    if (isCreatingProject && localPhasesState) {
      const filtered = localPhasesState.phases.filter(p => p.id !== phaseId);
      localPhasesState.setPhases(filtered);
      return true;
    } else if (projectId) {
      try {
        await contextDeleteMilestone(phaseId, { silent: true });
        return true;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'usePhaseOperations',
          action: 'deletePhase',
          metadata: { phaseId }
        });
        toast({
          title: "Error",
          description: "Failed to delete phase. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    } else {
      setLocalPhases(prev => prev.filter(p => p.id !== phaseId));
      return true;
    }
  }, [isCreatingProject, localPhasesState, projectId, contextDeleteMilestone, toast]);

  // Update phase property
  const updatePhaseProperty = useCallback(async <K extends keyof PhaseDTO>(
    phaseId: string,
    property: K,
    value: PhaseDTO[K]
  ) => {
    const validPhases = projectPhases.filter(p => p.id) as PhaseDTO[];
    const result = await PhaseOrchestrator.updatePhaseProperty(
      phaseId,
      property,
      value,
      {
        projectPhases: validPhases,
        projectEstimatedHours,
        localPhases,
        isCreatingProject,
        localPhasesState,
        addPhase: createPhase,
        updatePhase: async (id: string, updates: Partial<PhaseDTO>) => {
          await updatePhase(id, updates);
        },
        setLocalPhases,
        projectId,
        updateProject: async (id: string, updates: Partial<Project>, options?: { silent?: boolean }) => {
          await contextUpdateProject(id, updates as any, options);
        }
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
  }, [projectPhases, projectEstimatedHours, localPhases, isCreatingProject, localPhasesState, createPhase, updatePhase, toast, projectId, contextUpdateProject]);

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

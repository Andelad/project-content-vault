import { useState, useEffect, useCallback } from 'react';
import { Phase, Project } from '@/types/core';
import { PhaseOrchestrator, detectRecurringPattern } from '@/services';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/ui/use-toast';
import { ErrorHandlingService } from '@/infrastructure/ErrorHandlingService';
import type { LocalPhase } from './usePhaseOperations';

export interface RecurringPhase {
  id: string;
  name: string;
  timeAllocation: number;
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  projectId: string;
  isRecurring: true;
  weeklyDayOfWeek?: number;
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number;
  monthlyWeekOfMonth?: number;
  monthlyDayOfWeek?: number;
}

export interface RecurringPhaseConfig {
  name: string;
  timeAllocation: number;
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  weeklyDayOfWeek?: number;
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number;
  monthlyWeekOfMonth?: number;
  monthlyDayOfWeek?: number;
}

interface UseRecurringPhasesConfig {
  projectId?: string;
  projectPhases: (Phase | LocalPhase)[];
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous: boolean;
  projectEstimatedHours: number;
  isDeletingRecurringPhase: boolean;
  refetchMilestones: () => Promise<void>;
  isCreatingProject?: boolean;
  localPhasesState?: {
    phases: LocalPhase[];
    setPhases: (phases: LocalPhase[]) => void;
  };
}

/**
 * Hook for managing recurring milestone patterns
 * Coordinates React state with ProjectPhaseOrchestrator for recurring operations
 * Handles pattern detection, auto-generation, and deletion
 */
export function useRecurringPhases(config: UseRecurringPhasesConfig) {
  const {
    projectId,
    projectPhases,
    projectStartDate,
    projectEndDate,
    projectContinuous,
    projectEstimatedHours,
    isDeletingRecurringPhase,
    refetchMilestones,
    isCreatingProject,
    localPhasesState
  } = config;

  const { toast } = useToast();
  const [recurringMilestone, setRecurringPhase] = useState<RecurringPhase | null>(null);

  // Detect recurring pattern from existing milestones
  useEffect(() => {
    // Don't re-detect if already have recurring milestone or if deleting
    if (recurringMilestone || !projectId || isDeletingRecurringPhase) return;
    
    // Check if any NON-RECURRING milestones have startDate (regular phases) - if so, don't detect recurring
    const hasRegularPhases = projectPhases.some(p => p.startDate !== undefined && p.isRecurring !== true);
    if (hasRegularPhases) return;

    // NEW SYSTEM: First check for template milestone with isRecurring=true
    const templateMilestone = projectPhases.find(p => p.isRecurring === true);
    if (templateMilestone && templateMilestone.recurringConfig) {
      const config = templateMilestone.recurringConfig;
      setRecurringPhase({
        id: templateMilestone.id || 'recurring-milestone',
        name: templateMilestone.name,
        timeAllocation: templateMilestone.timeAllocationHours ?? templateMilestone.timeAllocation,
        recurringType: config.type,
        recurringInterval: config.interval,
        projectId,
        isRecurring: true,
        weeklyDayOfWeek: config.weeklyDayOfWeek,
        monthlyPattern: config.monthlyPattern,
        monthlyDate: config.monthlyDate,
        monthlyWeekOfMonth: config.monthlyWeekOfMonth,
        monthlyDayOfWeek: config.monthlyDayOfWeek
      });
      return;
    }
  }, [projectPhases, recurringMilestone, projectId, isDeletingRecurringPhase]);

  // Simple placeholder - recurring templates expand at runtime, not stored
  const ensureRecurringPhasesAvailable = useCallback(async (targetDate?: Date) => {
    // No-op: NEW SYSTEM uses single template that expands at runtime
    // The template milestone (is_recurring=true) is detected above and instances
    // are generated dynamically when needed by calculation services
    return Promise.resolve();
  }, []);

  // Create recurring phases
  const createRecurringPhases = useCallback(async (config: RecurringPhaseConfig) => {
    // For new projects being created, store config to create later when project is saved
    if (!projectId) {
      // CRITICAL: Clear all local phases first (mutual exclusivity rule)
      if (isCreatingProject && localPhasesState) {
        localPhasesState.setPhases([]);
      }
      
      // Create a local recurring milestone object for UI display
      const localRecurringPhase: RecurringPhase = {
        id: `temp-recurring-${Date.now()}`,
        name: config.name,
        timeAllocation: config.timeAllocation,
        recurringType: config.recurringType,
        recurringInterval: config.recurringInterval,
        projectId: 'temp',
        isRecurring: true as const,
        weeklyDayOfWeek: config.weeklyDayOfWeek,
        monthlyPattern: config.monthlyPattern,
        monthlyDate: config.monthlyDate,
        monthlyWeekOfMonth: config.monthlyWeekOfMonth,
        monthlyDayOfWeek: config.monthlyDayOfWeek
      };
      
      setRecurringPhase(localRecurringPhase);
      
      // No toast needed - the card appearing is sufficient visual feedback
      // and the modal's Save/Cancel buttons make persistence behavior clear
      
      return { success: true };
    }

    try {
      const project: Project = {
        id: projectId,
        startDate: projectStartDate,
        endDate: projectEndDate,
        continuous: projectContinuous,
        name: 'Project',
        estimatedHours: projectEstimatedHours || 0,
        color: '#000000',
        client: '',
        clientId: '',
        groupId: 'group',
        rowId: 'row',
        userId: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await PhaseOrchestrator.createRecurringPhases(
        projectId,
        project,
        config,
        { refetchMilestones }
      );

      if (result.success && result.recurringMilestone) {
        setRecurringPhase(result.recurringMilestone);

        // No toast needed - the phases appearing is sufficient visual feedback

        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to create recurring template');
      }
    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'useRecurringPhases',
        action: 'createRecurringPhases',
        metadata: {
          projectId,
          hasProjectId: !!projectId,
          configType: config.recurringType
        }
      });
      
      console.error('Error creating recurring phases:', error);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create recurring phases",
        variant: "destructive",
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [projectId, projectStartDate, projectEndDate, projectContinuous, projectEstimatedHours, refetchMilestones, toast, isCreatingProject, localPhasesState]);

  // Delete recurring phases
  const deleteRecurringPhases = useCallback(async (
    isCreatingProject: boolean,
    localPhasesState?: {phases: LocalPhase[]; setPhases: (p: LocalPhase[]) => void }
  ) => {
    // Clear local storage first to prevent restoration
    if (projectId) {
      localStorage.removeItem(`recurring-milestone-${projectId}`);
    }

    // Instantly clear UI state
    setRecurringPhase(null);

    try {
      if (isCreatingProject && localPhasesState) {
        localPhasesState.setPhases([]);
      } else {
        const recurringMilestones = projectPhases.filter(p =>
          p.isRecurring || (p.name && /\s\d+$/.test(p.name) && p.startDate === undefined)
        );

        const template = recurringMilestones.find(p => p.isRecurring);
        if (template && template.id && !template.id.startsWith('temp-')) {
          // Delete template (cascade handles instances)
          const { error } = await supabase.from('phases').delete().eq('id', template.id);
          if (error) throw error;

          await refetchMilestones();

          toast({
            title: "Success",
            description: "Recurring phase deleted successfully",
          });
        } else {
          // Delete orphaned instances
          const orphanedIds = recurringMilestones
            .filter(phase => phase.id && !phase.id.startsWith('temp-'))
            .map(p => p.id!);

          if (orphanedIds.length > 0) {
            const { error } = await supabase.from('phases').delete().in('id', orphanedIds);
            if (error) throw error;

            await refetchMilestones();

            toast({
              title: "Success",
              description: `Deleted ${orphanedIds.length} orphaned phases`,
            });
          }
        }
      }
    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'useRecurringPhases',
        action: 'deleteRecurringPhases'
      });
      toast({
        title: "Error",
        description: "Failed to delete some phases. Please try again.",
        variant: "destructive",
      });
    }
  }, [projectId, projectPhases, refetchMilestones, toast]);

  return {
    recurringMilestone,
    setRecurringPhase,
    ensureRecurringPhasesAvailable,
    createRecurringPhases,
    deleteRecurringPhases
  };
}

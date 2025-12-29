import { useState, useEffect, useCallback } from 'react';
import { Milestone, Project } from '@/types/core';
import { ProjectMilestoneOrchestrator, detectRecurringPattern, UnifiedMilestoneService } from '@/services';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import type { LocalMilestone } from './useMilestoneOperations';

export interface RecurringMilestone {
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

export interface RecurringMilestoneConfig {
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

interface UseRecurringMilestonesConfig {
  projectId?: string;
  projectMilestones: (Milestone | LocalMilestone)[];
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous: boolean;
  projectEstimatedHours: number;
  isDeletingRecurringMilestone: boolean;
  refetchMilestones: () => Promise<void>;
  isCreatingProject?: boolean;
  localMilestonesState?: {
    milestones: LocalMilestone[];
    setMilestones: (milestones: LocalMilestone[]) => void;
  };
}

/**
 * Hook for managing recurring milestone patterns
 * Coordinates React state with ProjectMilestoneOrchestrator for recurring operations
 * Handles pattern detection, auto-generation, and deletion
 */
export function useRecurringMilestones(config: UseRecurringMilestonesConfig) {
  const {
    projectId,
    projectMilestones,
    projectStartDate,
    projectEndDate,
    projectContinuous,
    projectEstimatedHours,
    isDeletingRecurringMilestone,
    refetchMilestones,
    isCreatingProject,
    localMilestonesState
  } = config;

  const { toast } = useToast();
  const [recurringMilestone, setRecurringMilestone] = useState<RecurringMilestone | null>(null);

  // Detect recurring pattern from existing milestones
  useEffect(() => {
    // Check if any milestones have startDate (phases) - if so, don't detect recurring
    const hasPhases = projectMilestones.some(m => m.startDate !== undefined);
    if (recurringMilestone || !projectId || isDeletingRecurringMilestone || hasPhases) return;

    // NEW SYSTEM: First check for template milestone with isRecurring=true
    const templateMilestone = projectMilestones.find(m => m.isRecurring === true);
    if (templateMilestone && templateMilestone.recurringConfig) {
      const config = templateMilestone.recurringConfig;
      setRecurringMilestone({
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
  }, [projectMilestones, recurringMilestone, projectId, isDeletingRecurringMilestone]);

  // Simple placeholder - recurring templates expand at runtime, not stored
  const ensureRecurringMilestonesAvailable = useCallback(async (targetDate?: Date) => {
    // No-op: NEW SYSTEM uses single template that expands at runtime
    // The template milestone (is_recurring=true) is detected above and instances
    // are generated dynamically when needed by calculation services
    return Promise.resolve();
  }, []);

  // Create recurring milestones
  const createRecurringMilestones = useCallback(async (config: RecurringMilestoneConfig) => {
    // For new projects being created, store config to create later when project is saved
    if (!projectId) {
      // CRITICAL: Clear all local phases first (mutual exclusivity rule)
      if (isCreatingProject && localMilestonesState) {
        localMilestonesState.setMilestones([]);
      }
      
      // Create a local recurring milestone object for UI display
      const localRecurringMilestone: RecurringMilestone = {
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
      
      setRecurringMilestone(localRecurringMilestone);
      
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

      const result = await ProjectMilestoneOrchestrator.createRecurringMilestones(
        projectId,
        project,
        config,
        { refetchMilestones }
      );

      if (result.success && result.recurringMilestone) {
        setRecurringMilestone(result.recurringMilestone);

        toast({
          title: "Recurring template created",
          description: `Template will repeat ${result.estimatedTotalCount} times over project duration`,
        });

        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to create recurring template');
      }
    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'useRecurringMilestones',
        action: 'createRecurringMilestones'
      });
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create recurring milestones",
        variant: "destructive",
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [projectId, projectStartDate, projectEndDate, projectContinuous, projectEstimatedHours, refetchMilestones, toast, isCreatingProject, localMilestonesState]);

  // Delete recurring milestones
  const deleteRecurringMilestones = useCallback(async (
    isCreatingProject: boolean,
    localMilestonesState?: { milestones: LocalMilestone[]; setMilestones: (m: LocalMilestone[]) => void }
  ) => {
    // Clear local storage first to prevent restoration
    if (projectId) {
      localStorage.removeItem(`recurring-milestone-${projectId}`);
    }

    // Instantly clear UI state
    setRecurringMilestone(null);

    try {
      if (isCreatingProject && localMilestonesState) {
        localMilestonesState.setMilestones([]);
      } else {
        const recurringMilestones = projectMilestones.filter(m =>
          m.isRecurring || (m.name && /\s\d+$/.test(m.name) && m.startDate === undefined)
        );

        const template = recurringMilestones.find(m => m.isRecurring);
        if (template && template.id && !template.id.startsWith('temp-')) {
          // Delete template (cascade handles instances)
          const { error } = await supabase.from('phases').delete().eq('id', template.id);
          if (error) throw error;

          toast({
            title: "Success",
            description: "Recurring milestone deleted successfully",
          });
        } else {
          // Delete orphaned instances
          const orphanedIds = recurringMilestones
            .filter(milestone => milestone.id && !milestone.id.startsWith('temp-'))
            .map(m => m.id!);

          if (orphanedIds.length > 0) {
            const { error } = await supabase.from('phases').delete().in('id', orphanedIds);
            if (error) throw error;

            await refetchMilestones();

            toast({
              title: "Success",
              description: `Deleted ${orphanedIds.length} orphaned milestones`,
            });
          }
        }
      }
    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'useRecurringMilestones',
        action: 'deleteRecurringMilestones'
      });
      toast({
        title: "Error",
        description: "Failed to delete some milestones. Please try again.",
        variant: "destructive",
      });
    }
  }, [projectId, projectMilestones, refetchMilestones, toast]);

  return {
    recurringMilestone,
    setRecurringMilestone,
    ensureRecurringMilestonesAvailable,
    createRecurringMilestones,
    deleteRecurringMilestones
  };
}

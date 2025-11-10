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
    refetchMilestones
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

    // OLD SYSTEM: Fall back to pattern detection from numbered milestones
    const recurringPattern = projectMilestones.filter(m =>
      m.name && /\s\d+$/.test(m.name) && m.startDate === undefined
    );

    if (recurringPattern.length >= 1) {
      const sortedMilestones = recurringPattern.sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      let recurringType: 'daily' | 'weekly' | 'monthly' = 'weekly';
      let interval = 1;

      if (recurringPattern.length > 1) {
        const firstDate = new Date(sortedMilestones[0].dueDate);
        const secondDate = new Date(sortedMilestones[1].dueDate);
        const intervalResult = UnifiedMilestoneService.calculateMilestoneInterval(firstDate, secondDate);
        recurringType = intervalResult.type === 'custom' ? 'daily' : intervalResult.type;
        interval = intervalResult.interval;
      }

      const baseName = sortedMilestones[0].name.replace(/\s\d+$/, '') || 'Recurring Milestone';

      setRecurringMilestone({
        id: 'recurring-milestone',
        name: baseName,
        timeAllocation: sortedMilestones[0].timeAllocation,
        recurringType,
        recurringInterval: interval,
        projectId,
        isRecurring: true
      });
    }
  }, [projectMilestones, recurringMilestone, projectId, isDeletingRecurringMilestone]);

  // Load from local storage on mount
  useEffect(() => {
    if (projectId && !recurringMilestone && !isDeletingRecurringMilestone) {
      const stored = localStorage.getItem(`recurring-milestone-${projectId}`);
      if (stored) {
        try {
          const storedData = JSON.parse(stored);
          setRecurringMilestone(storedData);
        } catch (error) {
          ErrorHandlingService.handle(error, {
            source: 'useRecurringMilestones',
            action: 'loadFromStorage'
          });
          localStorage.removeItem(`recurring-milestone-${projectId}`);
        }
      }
    }
  }, [projectId, recurringMilestone, isDeletingRecurringMilestone]);

  // Auto-generate recurring milestones as needed
  const ensureRecurringMilestonesAvailable = useCallback(async (targetDate?: Date) => {
    if (!recurringMilestone || !projectId) return;

    const currentMilestones = projectMilestones.filter(m =>
      m.name && /\s\d+$/.test(m.name) && m.startDate === undefined
    );

    // Safety check
    if (currentMilestones.length >= 1000) {
      console.warn('Milestone limit reached (1000), skipping generation');
      return;
    }

    const projectDurationMs = projectContinuous ?
      365 * 24 * 60 * 60 * 1000 :
      new Date(projectEndDate).getTime() - new Date(projectStartDate).getTime();
    const projectDurationDays = Math.ceil(projectDurationMs / (24 * 60 * 60 * 1000));

    let estimatedTotalMilestones = 0;
    switch (recurringMilestone.recurringType) {
      case 'daily':
        estimatedTotalMilestones = Math.floor(projectDurationDays / recurringMilestone.recurringInterval);
        break;
      case 'weekly':
        estimatedTotalMilestones = Math.floor(projectDurationDays / (7 * recurringMilestone.recurringInterval));
        break;
      case 'monthly':
        estimatedTotalMilestones = Math.floor(projectDurationDays / (30 * recurringMilestone.recurringInterval));
        break;
    }

    estimatedTotalMilestones = Math.min(estimatedTotalMilestones, 500);

    const targetMilestoneCount = projectContinuous ?
      Math.min(26, estimatedTotalMilestones) :
      Math.min(estimatedTotalMilestones, 100);

    const needsMoreMilestones = currentMilestones.length < targetMilestoneCount;

    let needsCoverageToDate = false;
    if (targetDate && currentMilestones.length > 0) {
      const lastMilestone = currentMilestones.sort((a, b) =>
        new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
      )[0];
      needsCoverageToDate = new Date(lastMilestone.dueDate) < targetDate;
    }

    if (!needsMoreMilestones && !needsCoverageToDate) return;

    // Auto-generation is silent - no toasts
    try {
      const recurringConfig: RecurringMilestoneConfig = {
        name: recurringMilestone.name,
        timeAllocation: recurringMilestone.timeAllocation,
        recurringType: recurringMilestone.recurringType,
        recurringInterval: recurringMilestone.recurringInterval,
        weeklyDayOfWeek: recurringMilestone.weeklyDayOfWeek,
        monthlyPattern: recurringMilestone.monthlyPattern,
        monthlyDate: recurringMilestone.monthlyDate,
        monthlyWeekOfMonth: recurringMilestone.monthlyWeekOfMonth,
        monthlyDayOfWeek: recurringMilestone.monthlyDayOfWeek
      };

      // Would need to call generation service here - simplified for now
      // In full implementation, would use ProjectMilestoneOrchestrator
    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'useRecurringMilestones',
        action: 'ensureRecurringMilestonesAvailable'
      });
    }
  }, [recurringMilestone, projectId, projectMilestones, projectContinuous, projectStartDate, projectEndDate]);

  // Auto-trigger for continuous projects
  useEffect(() => {
    if (recurringMilestone && projectContinuous) {
      ensureRecurringMilestonesAvailable();
    }
  }, [recurringMilestone, projectContinuous, ensureRecurringMilestonesAvailable]);

  // Create recurring milestones
  const createRecurringMilestones = useCallback(async (config: RecurringMilestoneConfig) => {
    if (!projectId) return { success: false, error: 'No project ID' };

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
          title: "Recurring milestones created",
          description: `Generated ${result.generatedCount} of estimated ${result.estimatedTotalCount} milestones`,
        });

        if (projectContinuous) {
          await ensureRecurringMilestonesAvailable();
        }

        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to create recurring milestones');
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
  }, [projectId, projectStartDate, projectEndDate, projectContinuous, projectEstimatedHours, refetchMilestones, toast, ensureRecurringMilestonesAvailable]);

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
          const { error } = await supabase.from('milestones').delete().eq('id', template.id);
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
            const { error } = await supabase.from('milestones').delete().in('id', orphanedIds);
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

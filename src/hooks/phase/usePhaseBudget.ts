import { useMemo } from 'react';
import { Phase, Project } from '@/types/core';
import { ProjectOrchestrator, calculateRecurringTotalAllocation } from '@/services';
import type { LocalPhase } from './usePhaseOperations';

interface RecurringPhase {
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

interface UseMilestoneBudgetConfig {
  projectMilestones: (Milestone | LocalPhase)[];
  projectEstimatedHours: number;
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous: boolean;
  projectId?: string;
  recurringMilestone: RecurringPhase | null;
}

/**
 * Hook for calculating milestone budget analysis
 * Coordinates React state with existing budget calculation services
 * Returns budget metrics and validation status
 */
export function usePhaseBudget(config: UseMilestoneBudgetConfig) {
  const {
    projectMilestones,
    projectEstimatedHours,
    projectStartDate,
    projectEndDate,
    projectContinuous,
    projectId,
    recurringMilestone
  } = config;

  // Calculate total recurring allocation
  const totalRecurringAllocation = useMemo(() => {
    if (recurringMilestone) {
      return calculateRecurringTotalAllocation({
        config: {
          recurringType: recurringMilestone.recurringType,
          recurringInterval: recurringMilestone.recurringInterval,
          timeAllocation: recurringMilestone.timeAllocation
        },
        projectStartDate,
        projectEndDate,
        projectContinuous
      });
    }
    return 0;
  }, [recurringMilestone, projectStartDate, projectEndDate, projectContinuous]);

  // Calculate budget analysis (filters out templates and numbered instances)
  const budgetAnalysis = useMemo(() => {
    // When recurring milestone exists, budget validation doesn't apply
    // Recurring milestones operate independently of fixed project budgets
    if (recurringMilestone || totalRecurringAllocation > 0) {
      return {
        totalAllocated: totalRecurringAllocation,
        remainingBudget: 0,
        isOverBudget: false, // Never over budget with recurring
        utilizationPercent: 0
      };
    }

    const nonRecurringPhases = projectMilestones.filter(m => {
      // Exclude temporary/unsaved milestones
      if ('isNew' in m && (m as LocalPhase).isNew) return false;
      if (typeof m.id === 'string' && m.id.startsWith('temp-')) return false;
      // Exclude NEW template milestones
      if (m.isRecurring) return false;
      // Exclude OLD numbered instances (but not phases)
      if (m.name && /\s\d+$/.test(m.name) && m.startDate === undefined) return false;
      return true;
    });

    const totalAllocated = nonRecurringPhases.reduce((sum, m) => sum + m.timeAllocation, 0);
    const remainingBudget = projectEstimatedHours - totalAllocated;
    const isOverBudget = totalAllocated > projectEstimatedHours;

    return {
      totalAllocated,
      remainingBudget,
      isOverBudget,
      utilizationPercent: projectEstimatedHours > 0 ? (totalAllocated / projectEstimatedHours) * 100 : 0
    };
  }, [projectMilestones, projectEstimatedHours, totalRecurringAllocation, recurringMilestone]);

  // Enhanced project health analysis using domain entities
  const projectHealthAnalysis = useMemo(() => {
    const validMilestones = projectMilestones.filter(m => m.id) as Milestone[];
    const project: Project = {
      id: projectId || 'new',
      name: 'Current Project',
      client: '',
      clientId: '',
      startDate: projectStartDate,
      endDate: projectEndDate,
      estimatedHours: projectEstimatedHours,
      continuous: projectContinuous,
      color: '',
      groupId: '',
      rowId: '',
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return ProjectOrchestrator.analyzeProjectMilestones(project, validMilestones);
  }, [projectMilestones, projectEstimatedHours, projectStartDate, projectEndDate, projectContinuous, projectId]);

  return {
    totalRecurringAllocation,
    budgetAnalysis,
    projectHealthAnalysis,
    // Legacy compatibility
    totalTimeAllocation: budgetAnalysis.totalAllocated,
    suggestedBudgetFromMilestones: Math.max(projectEstimatedHours, budgetAnalysis.totalAllocated)
  };
}

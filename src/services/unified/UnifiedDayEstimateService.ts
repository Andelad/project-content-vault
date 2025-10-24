/**
 * Unified Day Estimate Service
 * 
 * SINGLE SOURCE OF TRUTH for timeline day-by-day calculations.
 * All timeline rendering should use this service.
 * 
 * @module UnifiedDayEstimateService
 */

import { Project, Milestone, DayEstimate, Settings, Holiday } from '@/types/core';
import * as DayEstimateCalcs from '@/services/calculations/projects/dayEstimateCalculations';
import { getDateKey } from '@/utils/dateFormatUtils';

export class UnifiedDayEstimateService {
  
  /**
   * Calculate day estimates for a single project
   * This is the PRIMARY method for timeline rendering
   */
  static calculateProjectDayEstimates(
    project: Project,
    milestones: Milestone[],
    settings: Settings,
    holidays: Holiday[],
    events: any[] = []
  ): DayEstimate[] {
    return DayEstimateCalcs.calculateProjectDayEstimates(
      project,
      milestones,
      settings,
      holidays,
      events
    );
  }

  /**
   * Calculate day estimates for multiple projects
   */
  static calculateMultiProjectDayEstimates(
    projects: Project[],
    milestonesMap: Map<string, Milestone[]>,
    settings: Settings,
    holidays: Holiday[]
  ): Map<string, DayEstimate[]> {
    const resultMap = new Map<string, DayEstimate[]>();

    projects.forEach(project => {
      const milestones = milestonesMap.get(project.id) || [];
      const estimates = this.calculateProjectDayEstimates(
        project,
        milestones,
        settings,
        holidays
      );
      resultMap.set(project.id, estimates);
    });

    return resultMap;
  }

  /**
   * Get day estimates for a specific date range
   */
  static getDayEstimatesInRange(
    allEstimates: DayEstimate[],
    startDate: Date,
    endDate: Date
  ): DayEstimate[] {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return allEstimates.filter(estimate => {
      const estDate = new Date(estimate.date);
      estDate.setHours(0, 0, 0, 0);
      return estDate >= start && estDate <= end;
    });
  }

  /**
   * Get day estimates for a specific date
   */
  static getDayEstimatesForDate(
    allEstimates: DayEstimate[],
    date: Date
  ): DayEstimate[] {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return allEstimates.filter(estimate => {
      const estDate = new Date(estimate.date);
      estDate.setHours(0, 0, 0, 0);
      return estDate.getTime() === targetDate.getTime();
    });
  }

  /**
   * Calculate total hours for a date
   */
  static calculateDateTotalHours(
    allEstimates: DayEstimate[],
    date: Date
  ): number {
    const dayEstimates = this.getDayEstimatesForDate(allEstimates, date);
    return DayEstimateCalcs.calculateEstimatesTotalHours(dayEstimates);
  }

  /**
   * Group estimates by date for visualization
   */
  static groupEstimatesByDate(
    estimates: DayEstimate[]
  ): Map<string, DayEstimate[]> {
    return DayEstimateCalcs.aggregateDayEstimatesByDate(estimates);
  }

  /**
   * Check if a date is a working day
   */
  static isWorkingDay(
    date: Date,
    settings: Settings,
    holidays: Holiday[],
    project?: Project
  ): boolean {
    return DayEstimateCalcs.isWorkingDayForEstimates(date, settings, holidays, project);
  }

  /**
   * Get all working days in a range
   */
  static getWorkingDaysInRange(
    startDate: Date,
    endDate: Date,
    settings: Settings,
    holidays: Holiday[],
    project?: Project
  ): Date[] {
    return DayEstimateCalcs.getWorkingDaysBetween(
      startDate,
      endDate,
      settings,
      holidays,
      project
    );
  }

  /**
   * Calculate milestone-specific day estimates (for detailed views)
   */
  static calculateMilestoneDayEstimates(
    milestone: Milestone,
    project: Project,
    settings: Settings,
    holidays: Holiday[]
  ): DayEstimate[] {
    if (milestone.isRecurring) {
      return DayEstimateCalcs.calculateRecurringMilestoneDayEstimates(
        milestone,
        project,
        settings,
        holidays
      );
    }
    return DayEstimateCalcs.calculateMilestoneDayEstimates(
      milestone,
      project,
      settings,
      holidays
    );
  }

  /**
   * Get daily project summaries for planner view
   * Returns projects with estimated hours per day (only for days WITHOUT events)
   * 
   * @param dates - Array of dates to get summaries for
   * @param projects - All projects
   * @param milestonesMap - Map of project ID to milestones
   * @param events - All calendar events
   * @param settings - User settings
   * @param holidays - Holiday definitions
   * @returns Map of date string to project summaries
   */
  static getDailyProjectSummaries(
    dates: Date[],
    projects: Project[],
    milestonesMap: Map<string, Milestone[]>,
    events: any[],
    settings: Settings,
    holidays: Holiday[]
  ): Map<string, Array<{ projectId: string; projectName: string; client: string | null; estimatedHours: number; color?: string; }>> {
    const summariesByDate = new Map<string, Array<{ projectId: string; projectName: string; client: string | null; estimatedHours: number; color?: string; }>>();

    dates.forEach(date => {
      // Use timezone-safe date key
      const dateKey = getDateKey(date);
      const projectSummaries: Array<{ projectId: string; projectName: string; client: string | null; estimatedHours: number; color?: string; }> = [];

      projects.forEach(project => {
        // Fetch and normalize milestones for this project to match TimelineBar logic
        const allMilestones = milestonesMap.get(project.id) || [];
        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);

        // Filter milestones within project bounds
        let projectMilestones = allMilestones.filter((m: any) => {
          const end = new Date(m.endDate || m.dueDate);
          return end >= projectStart && end <= projectEnd;
        });

        // HYBRID SYSTEM: If there's a template milestone (isRecurring=true),
        // exclude old numbered instances to prevent double-counting
        const hasTemplateMilestone = projectMilestones.some((m: any) => m.isRecurring === true);
        if (hasTemplateMilestone) {
          projectMilestones = projectMilestones.filter((m: any) => 
            m.isRecurring === true || (!m.isRecurring && (!m.name || !/\s\d+$/.test(m.name)))
          );
        }

        // Calculate day estimates for this project (this already excludes days with events)
        const dayEstimates = this.calculateProjectDayEstimates(
          project,
          projectMilestones,
          settings,
          holidays,
          events
        );

        // Get estimates for this specific date
        const estimatesForDate = this.getDayEstimatesForDate(dayEstimates, date);

        // Only include auto-estimate sources (events are already handled)
        const autoEstimates = estimatesForDate.filter(
          est => est.source === 'milestone-allocation' || est.source === 'project-auto-estimate'
        );

        if (autoEstimates.length > 0) {
          const totalHours = autoEstimates.reduce((sum, est) => sum + est.hours, 0);
          projectSummaries.push({
            projectId: project.id,
            projectName: project.name,
            client: project.client || null,
            estimatedHours: totalHours,
            color: project.color
          });
        }
      });

      if (projectSummaries.length > 0) {
        summariesByDate.set(dateKey, projectSummaries);
      }
    });

    return summariesByDate;
  }
}

export const unifiedDayEstimateService = UnifiedDayEstimateService;

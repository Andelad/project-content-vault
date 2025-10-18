/**
 * Unified Day Estimate Service
 * 
 * SINGLE SOURCE OF TRUTH for timeline day-by-day calculations.
 * All timeline rendering should use this service.
 * 
 * @module UnifiedDayEstimateService
 */

import { Project, Milestone, DayEstimate, Settings, Holiday } from '@/types/core';
import * as DayEstimateCalcs from '@/services/calculations/dayEstimateCalculations';

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
}

export const unifiedDayEstimateService = UnifiedDayEstimateService;

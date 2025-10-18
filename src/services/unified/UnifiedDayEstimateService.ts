/**
 * Unified Day Estimate Service
 * Business logic for day-level time distribution
 * 
 * @module UnifiedDayEstimateService
 */

import { Project, Milestone, CalendarEvent, DayEstimate, Settings, Holiday } from '@/types/core';
import { calculateProjectDayEstimates } from '../calculations/dayEstimateCalculations';

/**
 * Unified Day Estimate Service
 * Business logic wrapper for day estimates
 */
export class UnifiedDayEstimateService {
  /**
   * Get day estimates for a project
   */
  static getDayEstimates(
    project: Project,
    milestones: Milestone[],
    events: CalendarEvent[],
    settings: Settings,
    holidays: Holiday[]
  ): DayEstimate[] {
    return calculateProjectDayEstimates(project, milestones, events, settings, holidays);
  }
  
  /**
   * Get estimates for a specific date range (optimization)
   */
  static getDayEstimatesForRange(
    project: Project,
    milestones: Milestone[],
    startDate: Date,
    endDate: Date,
    events: CalendarEvent[],
    settings: Settings,
    holidays: Holiday[]
  ): DayEstimate[] {
    const allEstimates = this.getDayEstimates(project, milestones, events, settings, holidays);
    return allEstimates.filter(est => est.date >= startDate && est.date <= endDate);
  }
  
  /**
   * Validate milestone allocations don't exceed project budget
   */
  static validateMilestoneAllocations(
    milestones: Milestone[],
    projectEstimatedHours: number
  ): {
    isValid: boolean;
    totalAllocated: number;
    remaining: number;
    overageHours: number;
  } {
    const totalAllocated = milestones.reduce((sum, m) => sum + m.timeAllocationHours, 0);
    
    return {
      isValid: totalAllocated <= projectEstimatedHours,
      totalAllocated,
      remaining: projectEstimatedHours - totalAllocated,
      overageHours: Math.max(0, totalAllocated - projectEstimatedHours)
    };
  }
}

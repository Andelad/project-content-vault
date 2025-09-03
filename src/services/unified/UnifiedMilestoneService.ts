/**
 * Unified Milestone Service
 * 
 * Consolidates all milestone-related business calculations that are shared
 * across multiple features (projects, milestones, timeline, calendar).
 * 
 * ✅ Single source of truth for milestone calculations
 * ✅ Eliminates duplication across legacy services
 * ✅ Provides consistent business logic
 * ✅ Optimized for performance and caching
 */

import { Milestone } from '@/types/core';
import { 
  calculateTotalAllocation,
  calculateBudgetUtilization,
  calculateRemainingBudget,
  calculateOverageAmount,
  calculateAverageMilestoneAllocation,
  calculateAllocationDistribution,
  calculateAutoEstimateWorkingDays 
} from '@/services';
// TODO: Import UnifiedWorkingDayService when created
// import { UnifiedWorkingDayService } from './UnifiedWorkingDayService';

export interface MilestoneValidationResult {
  isValid: boolean;
  totalAllocated: number;
  utilization: number;
  remaining: number;
  overage?: number;
  recommendations: string[];
}

export interface MilestoneTimeDistributionEntry {
  date: Date;
  estimatedHours: number;
  milestone?: Milestone;
  dayIndex: number;
  isDeadlineDay: boolean;
}

export interface WorkingDayOptions {
  autoEstimateDays?: any;
  settings?: any;
  holidays?: any[];
}

/**
 * Unified Milestone Service
 * 
 * Consolidates all cross-feature milestone calculations
 */
export class UnifiedMilestoneService {
  
  /**
   * Validate milestone budget allocation (replaces duplicate functions)
   * Used by: Project management, milestone creation, budget analysis
   */
  static validateBudgetAllocation(
    milestones: Milestone[], 
    projectBudget: number,
    excludeMilestoneId?: string
  ): MilestoneValidationResult {
    // Filter out excluded milestone if specified
    const relevantMilestones = excludeMilestoneId 
      ? milestones.filter(m => m.id !== excludeMilestoneId)
      : milestones;
    
    // Use pure calculation functions
    const totalAllocated = calculateTotalAllocation(relevantMilestones);
    const utilization = calculateBudgetUtilization(totalAllocated, projectBudget);
    const remaining = calculateRemainingBudget(totalAllocated, projectBudget);
    const overage = calculateOverageAmount(totalAllocated, projectBudget);
    
    // Generate business logic recommendations
    const recommendations: string[] = [];
    const isValid = totalAllocated <= projectBudget;
    
    if (!isValid) {
      recommendations.push(`Budget exceeded by ${overage}h. Consider reducing milestone allocations.`);
    } else if (utilization > 90) {
      recommendations.push('Budget utilization high (>90%). Consider adding buffer time.');
    } else if (utilization < 50) {
      recommendations.push('Budget utilization low (<50%). Consider adding more milestones or detail.');
    }
    
    if (milestones.length > 0) {
      const avgAllocation = calculateAverageMilestoneAllocation(milestones);
      if (avgAllocation < 1) {
        recommendations.push('Very small milestone allocations detected. Consider consolidating.');
      } else if (avgAllocation > projectBudget * 0.5) {
        recommendations.push('Large milestone allocations detected. Consider breaking down.');
      }
    }
    
    return {
      isValid,
      totalAllocated,
      utilization,
      remaining,
      overage: !isValid ? overage : undefined,
      recommendations
    };
  }
  
  /**
   * Calculate milestone time distribution with working day filtering
   * Used by: Timeline rendering, project scheduling, milestone planning
   */
  static calculateTimeDistribution(
    milestones: Milestone[],
    projectStartDate: Date,
    projectEndDate: Date,
    options: WorkingDayOptions = {}
  ): MilestoneTimeDistributionEntry[] {
    if (milestones.length === 0) {
      return [];
    }

    // Sort milestones by due date
    const sortedMilestones = [...milestones].sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    const result: MilestoneTimeDistributionEntry[] = [];
    let currentDate = new Date(projectStartDate);
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedMilestones.length; i++) {
      const milestone = sortedMilestones[i];
      const milestoneDate = new Date(milestone.dueDate);
      milestoneDate.setHours(0, 0, 0, 0);

          // Calculate working days using unified service (when available)
    let workingDays: Date[];
    if (options.autoEstimateDays && options.settings && options.holidays) {
      // TODO: Use UnifiedWorkingDayService when created
      // workingDays = UnifiedWorkingDayService.calculateFilteredDays(
      //   currentDate,
      //   milestoneDate,
      //   options
      // );
      
      // Temporary fallback - use existing calculateAutoEstimateWorkingDays
      workingDays = calculateAutoEstimateWorkingDays(
        currentDate,
        milestoneDate,
        options.autoEstimateDays,
        options.settings,
        options.holidays.map(h => new Date(h.startDate || h))
      );
      } else {
        // Fallback to calendar days
        workingDays = [];
        const tempDate = new Date(currentDate);
        while (tempDate <= milestoneDate) {
          workingDays.push(new Date(tempDate));
          tempDate.setDate(tempDate.getDate() + 1);
        }
      }

      // Calculate hours per day
      const hoursPerDay = workingDays.length > 0 ? milestone.timeAllocation / workingDays.length : 0;

      // Add entries for each working day
      workingDays.forEach((dayDate, index) => {
        const isLastDay = index === workingDays.length - 1;
        
        result.push({
          date: new Date(dayDate),
          estimatedHours: hoursPerDay,
          milestone: isLastDay ? milestone : undefined,
          dayIndex: index,
          isDeadlineDay: isLastDay
        });
      });

      // Move to next milestone start date
      currentDate = new Date(milestoneDate.getTime() + (24 * 60 * 60 * 1000));
    }

    return result;
  }
  
  /**
   * Calculate milestone metrics for analytics and reporting
   * Used by: Dashboard, insights, project analysis
   */
  static calculateMilestoneMetrics(milestones: Milestone[], projectBudget: number) {
    const totalAllocated = calculateTotalAllocation(milestones);
    const distribution = calculateAllocationDistribution(milestones);
    const budgetAnalysis = this.validateBudgetAllocation(milestones, projectBudget);
    
    return {
      totalAllocated,
      distribution,
      budgetAnalysis,
      milestoneCount: milestones.length,
      averageAllocation: distribution.avg,
      allocationSpread: distribution.max - distribution.min,
      efficiency: totalAllocated > 0 ? (projectBudget / totalAllocated) : 0
    };
  }
  
  /**
   * Get estimated hours for a specific date
   * Used by: Calendar rendering, daily planning, time allocation
   */
  static getEstimatedHoursForDate(
    date: Date,
    milestones: Milestone[],
    projectStartDate: Date,
    projectEndDate: Date,
    options: WorkingDayOptions = {}
  ): number {
    const distribution = this.calculateTimeDistribution(
      milestones, 
      projectStartDate, 
      projectEndDate, 
      options
    );
    
    const dateKey = date.toDateString();
    const entry = distribution.find(d => d.date.toDateString() === dateKey);
    
    return entry ? entry.estimatedHours : 0;
  }
}

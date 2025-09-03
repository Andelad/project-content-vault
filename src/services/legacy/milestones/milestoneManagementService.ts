/**
 * Milestone import { MilestoneEntity } from '@/services';anagement Service
 * 
 * Legacy interface that delegates to the new domain-driven architecture.
 * Maintains backward compatibility while using the improved separation of concerns.
 * 
 * New architecture components:
 * - Domain: MilestoneEntity (pure business rules)
 * - Business: MilestoneOrchestrator (workflow coordination)
 * - Calculations: milestoneCalculations (pure math functions)
 * - Validation: MilestoneValidator (complex validation scenarios)
 * - Data: MilestoneRepository (data access abstraction)
 * 
 * @deprecated Consider using MilestoneOrchestrator and domain entities directly
 */

import { Milestone, Project } from '@/types/core';
import { MilestoneEntity } from '../../core/domain/MilestoneEntity';
import { MilestoneOrchestrator } from '../../orchestrators/MilestoneOrchestrator';
import { MilestoneValidator, ValidationContext } from '../../validators/MilestoneValidator';
import * as milestoneCalcs from '../../core/calculations/milestoneCalculations';

// Types for milestone operations
export interface MilestoneValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
}

export interface MilestoneDateRange {
  minDate: Date;
  maxDate: Date;
  isCurrentDateValid: boolean;
  reason?: string;
}

export interface MilestoneBudgetAnalysis {
  totalRegularAllocation: number;
  totalRecurringAllocation: number;
  totalAllocation: number;
  isOverBudget: boolean;
  budgetUtilization: number;
  suggestedBudget: number;
  remainingBudget: number;
}

export interface RecurringMilestoneConfig {
  name: string;
  timeAllocation: number;
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  startDate?: Date;
}

export interface RecurringMilestonePreview {
  totalCount: number;
  totalAllocation: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  sampleDates: Date[];
}

export interface GeneratedMilestone {
  id: string;
  name: string;
  dueDate: Date;
  timeAllocation: number;
  projectId: string;
  order: number;
  isRecurring: boolean;
}

export interface MilestonePositioningParams {
  projectStartDate: Date;
  projectEndDate: Date;
  existingMilestones: (Milestone | { id?: string; dueDate: Date })[];
  currentMilestone?: { id?: string; dueDate: Date };
}

export interface MilestoneCalendarConfig {
  defaultMonth: Date;
  disabledDates: Date[];
  highlightedDates: { date: Date; type: 'existing' | 'suggested' | 'invalid' }[];
}

/**
 * Milestone Management Service
 * Handles all milestone-related calculations and validations
 * 
 * @deprecated This service is being migrated to use domain-driven architecture.
 * New code should use MilestoneOrchestrator and domain entities directly.
 */
export class MilestoneManagementService {

  /**
   * Calculate valid date range for milestone positioning
   * @deprecated Use MilestoneEntity.validateMilestoneDate instead
   */
  static calculateMilestoneDateRange(params: MilestonePositioningParams): MilestoneDateRange {
    // Delegate to domain entity for business rule validation
    const validation = MilestoneEntity.validateMilestoneDate(
      new Date(), // placeholder date for range calculation
      params.projectStartDate,
      params.projectEndDate,
      params.existingMilestones as Milestone[],
      params.currentMilestone?.id
    );

    // Calculate safe positioning range
    const minDate = new Date(params.projectStartDate);
    minDate.setDate(minDate.getDate() + 1); // Day after project start
    
    const maxDate = new Date(params.projectEndDate);
    maxDate.setDate(maxDate.getDate() - 1); // Day before project end

    // Use milestone calculations for positioning logic
    const sortedMilestones = milestoneCalcs.sortMilestonesByDate(
      params.existingMilestones.filter(m => 
        !params.currentMilestone || m.id !== params.currentMilestone.id
      ) as Milestone[]
    );

    // Find safe date range based on existing milestones
    let actualMinDate = minDate;
    let actualMaxDate = maxDate;

    if (sortedMilestones.length > 0 && params.currentMilestone) {
      const currentDate = params.currentMilestone.dueDate;
      
      // Find appropriate gap for current milestone
      const gapInfo = milestoneCalcs.findMilestoneGap(sortedMilestones, currentDate);
      if (gapInfo) {
        actualMinDate = gapInfo.startDate;
        actualMaxDate = gapInfo.endDate;
      }
    }

    return {
      minDate: actualMinDate,
      maxDate: actualMaxDate,
      isCurrentDateValid: params.currentMilestone ? 
        params.currentMilestone.dueDate >= actualMinDate && 
        params.currentMilestone.dueDate <= actualMaxDate : true,
      reason: validation.errors.length > 0 ? validation.errors.join(', ') : undefined
    };
  }

  /**
   * Calculate appropriate default date for new milestone
   * @deprecated Use MilestoneOrchestrator.suggestMilestoneDate instead
   */
  static calculateDefaultMilestoneDate(params: MilestonePositioningParams): Date {
    const { projectStartDate, projectEndDate, existingMilestones } = params;
    
    // Start with the day after project start
    let defaultDate = new Date(projectStartDate);
    defaultDate.setDate(defaultDate.getDate() + 1);
    
    // If there are existing milestones, place this one after the last one
    if (existingMilestones.length > 0) {
      const sortedMilestones = [...existingMilestones]
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      const lastMilestone = sortedMilestones[sortedMilestones.length - 1];
      const dayAfterLast = new Date(lastMilestone.dueDate);
      dayAfterLast.setDate(dayAfterLast.getDate() + 1);
      
      // Use the later of: day after project start, or day after last milestone
      if (dayAfterLast > defaultDate) {
        defaultDate = dayAfterLast;
      }
    }
    
    // Ensure it's not beyond project end date
    const projectEnd = new Date(projectEndDate);
    projectEnd.setDate(projectEnd.getDate() - 1); // Day before project end
    if (defaultDate > projectEnd) {
      defaultDate = projectEnd;
    }
    
    return defaultDate;
  }

  /**
   * Generate calendar configuration for milestone date picker
   */
  static generateMilestoneCalendarConfig(params: MilestonePositioningParams): MilestoneCalendarConfig {
    const dateRange = this.calculateMilestoneDateRange(params);
    const { existingMilestones, currentMilestone } = params;
    
    // Determine default month to display
    let defaultMonth = dateRange.minDate;
    if (currentMilestone) {
      if (dateRange.isCurrentDateValid) {
        defaultMonth = currentMilestone.dueDate;
      } else if (currentMilestone.dueDate < dateRange.minDate) {
        defaultMonth = dateRange.minDate;
      } else if (currentMilestone.dueDate > dateRange.maxDate) {
        defaultMonth = dateRange.maxDate;
      }
    }

    // Generate disabled dates (outside valid range)
    const disabledDates: Date[] = [];
    const projectStart = new Date(params.projectStartDate);
    const projectEnd = new Date(params.projectEndDate);
    
    // Add project boundary dates
    disabledDates.push(projectStart, projectEnd);

    // Generate highlighted dates
    const highlightedDates = existingMilestones
      .filter(m => !currentMilestone || m.id !== currentMilestone.id)
      .map(m => ({
        date: m.dueDate,
        type: 'existing' as const
      }));

    return {
      defaultMonth,
      disabledDates,
      highlightedDates
    };
  }

  /**
   * Analyze milestone budget allocation
   * @deprecated Use ProjectEntity.analyzeBudget instead
   */
  static analyzeMilestoneBudget(
    milestones: (Milestone | { timeAllocation: number })[],
    projectEstimatedHours: number,
    recurringAllocation: number = 0
  ): MilestoneBudgetAnalysis {
    // Delegate to pure calculation functions
    const totalRegularAllocation = milestones.reduce((sum, m) => sum + m.timeAllocation, 0);
    
    const totalRecurringAllocation = recurringAllocation;
    const totalAllocation = totalRegularAllocation + totalRecurringAllocation;
    
    // Use milestone calculations for budget analysis
    const budgetUtilization = milestoneCalcs.calculateBudgetUtilization(
      totalAllocation,
      projectEstimatedHours
    );
    
    return {
      totalRegularAllocation,
      totalRecurringAllocation,
      totalAllocation,
      isOverBudget: budgetUtilization > 100,
      budgetUtilization: budgetUtilization / 100,
      suggestedBudget: budgetUtilization > 100 ? 
        Math.ceil(totalAllocation * 1.2) : projectEstimatedHours,
      remainingBudget: Math.max(0, projectEstimatedHours - totalAllocation)
    };
  }

  /**
   * Generate recurring milestones based on configuration
   * @deprecated Use MilestoneOrchestrator.createRecurringMilestones instead
   */
  static generateRecurringMilestones(
    config: RecurringMilestoneConfig,
    projectStartDate: Date,
    projectEndDate: Date,
    projectContinuous: boolean = false,
    projectId: string = 'temp'
  ): GeneratedMilestone[] {
    const milestones: GeneratedMilestone[] = [];
    const startDate = config.startDate || projectStartDate;
    const currentDate = new Date(startDate);
    let order = 0;

    // Generate milestones within the project timeframe
    while ((!projectContinuous && currentDate <= projectEndDate) || (projectContinuous && order < 100)) {
      milestones.push({
        id: `recurring-${order}`,
        name: `${config.name} ${order + 1}`,
        dueDate: new Date(currentDate),
        timeAllocation: config.timeAllocation,
        projectId,
        order,
        isRecurring: true
      });
      
      // Calculate next occurrence
      switch (config.recurringType) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + config.recurringInterval);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * config.recurringInterval));
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + config.recurringInterval);
          break;
      }
      
      order++;
      
      // Safety check to prevent infinite loops
      if (order > 100) break;
    }
    
    return milestones;
  }

  /**
   * Preview recurring milestone configuration
   */
  static previewRecurringMilestones(
    config: RecurringMilestoneConfig,
    projectStartDate: Date,
    projectEndDate: Date,
    projectContinuous: boolean = false
  ): RecurringMilestonePreview {
    const generated = this.generateRecurringMilestones(
      config, 
      projectStartDate, 
      projectEndDate, 
      projectContinuous
    );

    const totalCount = generated.length;
    const totalAllocation = totalCount * config.timeAllocation;
    const firstOccurrence = generated[0]?.dueDate || projectStartDate;
    const lastOccurrence = generated[generated.length - 1]?.dueDate || projectEndDate;
    
    // Get sample dates (first 5)
    const sampleDates = generated.slice(0, 5).map(m => m.dueDate);

    return {
      totalCount,
      totalAllocation,
      firstOccurrence,
      lastOccurrence,
      sampleDates
    };
  }

  /**
   * Detect recurring pattern from existing milestones
   */
  static detectRecurringPattern(milestones: (Milestone | { name: string; dueDate: Date; timeAllocation: number })[]): RecurringMilestoneConfig | null {
    // Look for milestones that end with space and number
    const recurringCandidates = milestones.filter(m => 
      m.name && /\s\d+$/.test(m.name)
    );

    if (recurringCandidates.length < 2) {
      return null; // Need at least 2 to detect pattern
    }

    // Sort by date
    const sorted = recurringCandidates.sort((a, b) => 
      a.dueDate.getTime() - b.dueDate.getTime()
    );

    // Calculate interval between first two milestones
    const firstDate = new Date(sorted[0].dueDate);
    const secondDate = new Date(sorted[1].dueDate);
    const daysDifference = Math.round(
      (secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let recurringType: 'daily' | 'weekly' | 'monthly' = 'weekly';
    let interval = 1;

    if (daysDifference === 1) {
      recurringType = 'daily';
      interval = 1;
    } else if (daysDifference === 7) {
      recurringType = 'weekly';
      interval = 1;
    } else if (daysDifference >= 28 && daysDifference <= 31) {
      recurringType = 'monthly';
      interval = 1;
    } else if (daysDifference % 7 === 0) {
      recurringType = 'weekly';
      interval = daysDifference / 7;
    } else {
      // Custom interval - default to weekly
      recurringType = 'weekly';
      interval = Math.round(daysDifference / 7);
    }

    // Extract base name (remove the number at the end)
    const baseName = sorted[0].name.replace(/\s\d+$/, '') || 'Recurring Milestone';

    return {
      name: baseName,
      timeAllocation: sorted[0].timeAllocation,
      recurringType,
      recurringInterval: interval
    };
  }

  /**
   * Validate milestone configuration
   */
  static validateMilestone(
    milestone: { name: string; dueDate: Date; timeAllocation: number },
    params: MilestonePositioningParams
  ): MilestoneValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Validate name
    if (!milestone.name || milestone.name.trim().length === 0) {
      issues.push('Milestone name is required');
    } else if (milestone.name.trim().length < 2) {
      warnings.push('Milestone name is very short');
    }

    // Validate time allocation
    if (milestone.timeAllocation <= 0) {
      issues.push('Time allocation must be greater than 0');
    } else if (milestone.timeAllocation > 40) {
      warnings.push('Time allocation is quite large (over 40 hours)');
    }

    // Validate date
    const dateRange = this.calculateMilestoneDateRange({
      ...params,
      currentMilestone: milestone
    });

    if (!dateRange.isCurrentDateValid) {
      issues.push(dateRange.reason || 'Invalid milestone date');
    }

    // Check for date conflicts
    const conflictingMilestones = params.existingMilestones.filter(m =>
      m.dueDate.toDateString() === milestone.dueDate.toDateString()
    );

    if (conflictingMilestones.length > 0) {
      warnings.push('Another milestone is scheduled for the same date');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Calculate optimal milestone distribution
   */
  static calculateOptimalMilestoneDistribution(
    projectStartDate: Date,
    projectEndDate: Date,
    totalBudget: number,
    milestoneCount: number = 3
  ): { dueDate: Date; suggestedAllocation: number }[] {
    const projectDurationMs = projectEndDate.getTime() - projectStartDate.getTime();
    const intervalMs = projectDurationMs / (milestoneCount + 1);
    const allocationPerMilestone = Math.round((totalBudget / milestoneCount) * 10) / 10;

    const suggestions = [];
    for (let i = 1; i <= milestoneCount; i++) {
      const milestoneDate = new Date(projectStartDate.getTime() + (intervalMs * i));
      suggestions.push({
        dueDate: milestoneDate,
        suggestedAllocation: allocationPerMilestone
      });
    }

    return suggestions;
  }

  /**
   * Calculate milestone completion metrics
   */
  static calculateMilestoneCompletionMetrics(
    milestones: (Milestone & { isCompleted?: boolean })[],
    currentDate: Date = new Date()
  ): {
    totalMilestones: number;
    completedMilestones: number;
    overdueMilestones: number;
    upcomingMilestones: number;
    completionRate: number;
  } {
    const total = milestones.length;
    const completed = milestones.filter(m => m.isCompleted).length;
    const overdue = milestones.filter(m => 
      !m.isCompleted && new Date(m.dueDate) < currentDate
    ).length;
    const upcoming = milestones.filter(m => 
      !m.isCompleted && new Date(m.dueDate) >= currentDate
    ).length;

    return {
      totalMilestones: total,
      completedMilestones: completed,
      overdueMilestones: overdue,
      upcomingMilestones: upcoming,
      completionRate: total > 0 ? (completed / total) * 100 : 0
    };
  }

  /**
   * Format milestone summary for display
   */
  static formatMilestoneSummary(
    analysis: MilestoneBudgetAnalysis,
    projectContinuous: boolean = false
  ): {
    allocationText: string;
    statusText: string;
    statusType: 'success' | 'warning' | 'error' | 'info';
  } {
    const { totalAllocation, isOverBudget, budgetUtilization } = analysis;
    
    let statusType: 'success' | 'warning' | 'error' | 'info' = 'info';
    let statusText = '';

    if (projectContinuous) {
      statusType = 'info';
      statusText = 'Continuous project - no budget limit';
    } else if (isOverBudget) {
      statusType = 'warning';
      statusText = 'Milestone allocations exceed project budget';
    } else if (budgetUtilization > 0.9) {
      statusType = 'success';
      statusText = 'Good budget utilization';
    } else if (budgetUtilization < 0.5) {
      statusType = 'info';
      statusText = 'Significant budget remaining';
    } else {
      statusType = 'success';
      statusText = 'Budget allocation looks good';
    }

    const allocationText = projectContinuous ? 
      `${totalAllocation}h allocated` :
      `${totalAllocation}h allocated`;

    return {
      allocationText,
      statusText,
      statusType
    };
  }

  /**
   * Generate ordinal number for recurring milestone display
   */
  static generateOrdinalNumber(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    
    if (remainder >= 11 && remainder <= 13) {
      return num + 'th';
    }
    
    const lastDigit = num % 10;
    const suffix = suffixes[lastDigit] || suffixes[0];
    
    return num + suffix;
  }
}

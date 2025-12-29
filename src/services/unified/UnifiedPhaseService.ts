/**
 * Unified Milestone Service
 * 
 * Consolidates all milestone-related business calculations that are shared
 * across multiple features (projects, phases, timeline, calendar).
 * 
 * ✅ Single source of truth for milestone calculations
 * ✅ Eliminates duplication across legacy services
 * ✅ Provides consistent business logic
 * ✅ Optimized for performance and caching
 */

import { Phase, Settings, Holiday, Project } from '@/types/core';
import { normalizeToMidnight, addDaysToDate } from '../calculations/general/dateCalculations';

import { 
  calculateTotalAllocation,
  calculateBudgetUtilization,
  calculateRemainingBudget,
  calculateOverageAmount,
  calculateAverageMilestoneAllocation,
  calculateAllocationDistribution,
  calculateAutoEstimateWorkingDays 
} from '@/services';
import { PhaseRules } from '@/domain/rules/PhaseRules';
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
  autoEstimateDays?: Project['autoEstimateDays'];
  settings?: Settings;
  holidays?: Holiday[];
}

/**
 * Unified Milestone Service
 * 
 * Consolidates all cross-feature milestone calculations
 */
export class UnifiedPhaseService {
  
  /**
   * Validate milestone budget allocation (replaces duplicate functions)
   * Used by: Project management, milestone creation, budget analysis
   */
  static validateBudgetAllocation(
    phases: Phase[], 
    projectBudget: number,
    excludeMilestoneId?: string
  ): MilestoneValidationResult {
    // Filter out excluded milestone if specified
    const relevantPhases = excludeMilestoneId 
      ? milestones.filter(p => m.id !== excludeMilestoneId)
      : milestones;
    
    // Use pure calculation functions
    const totalAllocated = calculateTotalAllocation(relevantPhases);
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
      const avgAllocation = calculateAverageMilestoneAllocation(phases);
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
    phases: Phase[],
    projectStartDate: Date,
    projectEndDate: Date,
    options: WorkingDayOptions = {}
  ): MilestoneTimeDistributionEntry[] {
    if (milestones.length === 0) {
      return [];
    }

    // Expand recurring phases into their occurrences
    const expandedMilestones: Phase[] = [];
    milestones.forEach(m => {
      if (m.isRecurring && m.recurringConfig) {
        // Generate occurrence dates for recurring milestone
        const occurrences = this.generateRecurringOccurrences(
          m,
          projectStartDate,
          projectEndDate,
          false // projectContinuous - we'll use projectEndDate as limit
        );

        // Create a milestone entry for each occurrence
        occurrences.forEach(date => {
          expandedMilestones.push({
            ...p,
            dueDate: date,
            endDate: date
          });
        });
      } else {
        // Regular milestone, include as-is
        expandedMilestones.push(m);
      }
    });

    // Sort milestones by due date
    const sortedPhases = [...expandedMilestones].sort((a, b) => {
      const dateA = a.endDate || a.dueDate;
      const dateB = b.endDate || b.dueDate;
      return dateA.getTime() - dateB.getTime();
    });

    const result: MilestoneTimeDistributionEntry[] = [];
    let currentDate = new Date(projectStartDate);
    currentDate = normalizeToMidnight(currentDate);

    for (let i = 0; i < sortedPhases.length; i++) {
      const phase = sortedPhases[i];
      const milestoneDate = normalizeToMidnight(milestone.endDate || milestone.dueDate);

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
        options.holidays.map(h => new Date(h.startDate))
      );
      } else {
        // Fallback to calendar days
        workingDays = [];
        let tempDate = new Date(currentDate);
        while (tempDate <= milestoneDate) {
          workingDays.push(new Date(tempDate));
          tempDate = addDaysToDate(tempDate, 1);
        }
      }

      // Calculate hours per day
      const timeAllocation = milestone.timeAllocationHours ?? milestone.timeAllocation;
      const hoursPerDay = workingDays.length > 0 ? timeAllocation / workingDays.length : 0;

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
  static calculateMilestoneMetrics(phases: Phase[], projectBudget: number) {
    const totalAllocated = calculateTotalAllocation(phases);
    const distribution = calculateAllocationDistribution(phases);
    const budgetAnalysis = this.validateBudgetAllocation(phases, projectBudget);
    
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
    phases: Phase[],
    projectStartDate: Date,
    projectEndDate: Date,
    options: WorkingDayOptions = {}
  ): number {
    const distribution = this.calculateTimeDistribution(
      phases, 
      projectStartDate, 
      projectEndDate, 
      options
    );
    
    const dateKey = date.toDateString();
    const entry = distribution.find(d => d.date.toDateString() === dateKey);
    
    return entry ? entry.estimatedHours : 0;
  }

  /**
   * Calculate valid date range for milestone positioning
   * Used by: Phase date picker, milestone validation
   * Migrated from legacy MilestoneManagementService
   */
  static calculateMilestoneDateRange(params: {
    projectStartDate: Date;
    projectEndDate: Date;
    existingPhases: (Milestone | { id?: string; dueDate: Date })[];
    currentMilestone?: { id?: string; dueDate: Date };
  }): {
    minDate: Date;
    maxDate: Date;
    isCurrentDateValid: boolean;
    reason?: string;
  } {
    // Calculate safe positioning range
    const minDate = addDaysToDate(new Date(params.projectStartDate), 1); // Day after project start
    
    const maxDate = addDaysToDate(new Date(params.projectEndDate), -1); // Day before project end

    // Find safe date range based on existing milestones
    let actualMinDate = minDate;
    let actualMaxDate = maxDate;

    if (params.existingPhases.length > 0 && params.currentMilestone) {
      const currentDate = params.currentMilestone.dueDate;
      const sortedPhases = params.existingPhases
        .filter(p => !params.currentMilestone || m.id !== params.currentMilestone.id)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      
      // Find appropriate gap for current milestone
      for (let i = 0; i < sortedPhases.length + 1; i++) {
        const prevMilestone = i > 0 ? sortedPhases[i - 1] : null;
        const nextMilestone = i < sortedPhases.length ? sortedPhases[i] : null;
        
        const gapStart = prevMilestone ? new Date(prevMilestone.dueDate.getTime() + 24 * 60 * 60 * 1000) : minDate;
        const gapEnd = nextMilestone ? new Date(nextMilestone.dueDate.getTime() - 24 * 60 * 60 * 1000) : maxDate;
        
        if (currentDate >= gapStart && currentDate <= gapEnd) {
          actualMinDate = gapStart;
          actualMaxDate = gapEnd;
          break;
        }
      }
    }

    // Validate current milestone date if provided using domain rules
    let isCurrentDateValid = true;
    let reason: string | undefined;
    
    if (params.currentMilestone) {
      const validation = PhaseRules.validateMilestoneDateWithinProject(
        params.currentMilestone.dueDate,
        params.projectStartDate,
        params.projectEndDate
      );
      
      isCurrentDateValid = validation.isValid && 
        params.currentMilestone.dueDate >= actualMinDate && 
        params.currentMilestone.dueDate <= actualMaxDate;
      
      if (!validation.isValid) {
        reason = validation.errors.join(', ');
      }
    }

    return {
      minDate: actualMinDate,
      maxDate: actualMaxDate,
      isCurrentDateValid,
      reason
    };
  }

  /**
   * Calculate appropriate default date for new milestone
   * Used by: Phase creation, milestone suggestions
   * Migrated from legacy MilestoneManagementService
   */
  static calculateDefaultMilestoneDate(params: {
    projectStartDate: Date;
    projectEndDate: Date;
    existingPhases: (Milestone | { dueDate: Date })[];
  }): Date {
    const { projectStartDate, projectEndDate, existingPhases } = params;
    
    // Start with the day after project start
    let defaultDate = new Date(projectStartDate);
    defaultDate = addDaysToDate(defaultDate, 1);
    
    // If there are existing phases, place this one after the last one
    if (existingPhases.length > 0) {
      const sortedPhases = [...existingPhases]
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      const lastMilestone = sortedPhases[sortedPhases.length - 1];
      const dayAfterLast = addDaysToDate(new Date(lastMilestone.dueDate), 1);
      
      // Use the later of: day after project start, or day after last milestone
      if (dayAfterLast > defaultDate) {
        defaultDate = dayAfterLast;
      }
    }
    
    // Ensure it's not beyond project end date
    const projectEnd = addDaysToDate(new Date(projectEndDate), -1); // Day before project end
    if (defaultDate > projectEnd) {
      defaultDate = projectEnd;
    }
    
    return defaultDate;
  }

  /**
   * Generate recurring milestone occurrence dates within project timeframe
   * Used by: Time distribution calculations, milestone expansion
   */
  static generateRecurringOccurrences(
    milestone: Milestone,
    projectStartDate: Date,
    projectEndDate: Date,
    projectContinuous: boolean
  ): Date[] {
    if (!milestone.isRecurring || !milestone.recurringConfig) {
      return [];
    }

    const config = milestone.recurringConfig;
    const occurrences: Date[] = [];
    
    // Start from project start date
    let current = new Date(projectStartDate);
    
    // For weekly recurrence, find the first occurrence of the target day
    if (config.type === 'weekly' && config.weeklyDayOfWeek !== undefined) {
      const targetDay = config.weeklyDayOfWeek;
      const projectStartDay = current.getDay();
      const daysUntilFirst = targetDay >= projectStartDay
        ? targetDay - projectStartDay
        : 7 - projectStartDay + targetDay;
      current = addDaysToDate(current, daysUntilFirst);
    }
    
    // For monthly recurrence with specific date, find first occurrence
    if (config.type === 'monthly' && config.monthlyPattern === 'date' && config.monthlyDate) {
      const targetDate = config.monthlyDate;
      if (current.getDate() > targetDate) {
        // Next month
        current.setMonth(current.getMonth() + 1);
      }
      current.setDate(targetDate);
    }
    
    // Generate occurrences within project bounds
    const maxOccurrences = 100; // Prevent infinite loops
    const endLimit = projectContinuous 
      ? new Date(projectStartDate.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year for continuous
      : projectEndDate;
    
    let count = 0;
    while (current <= endLimit && count < maxOccurrences) {
      // Only add if within project bounds
      if (current >= projectStartDate && current <= endLimit) {
        occurrences.push(new Date(current));
      }
      
      // Calculate next occurrence
      switch (config.type) {
        case 'daily':
          current = addDaysToDate(current, config.interval);
          break;
        case 'weekly':
          current.setDate(current.getDate() + (7 * config.interval));
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + config.interval);
          break;
      }
      
      count++;
    }
    
    return occurrences;
  }

  /**
   * Calculate recurring interval between two milestone dates
   * Used for detecting recurring patterns in milestone sequences
   * @param firstDate First milestone date
   * @param secondDate Second milestone date
   * @returns Object with interval type and count
   */
  static calculateMilestoneInterval(
    firstDate: Date,
    secondDate: Date
  ): { type: 'daily' | 'weekly' | 'monthly' | 'custom'; interval: number } {
    const daysDifference = Math.round(
      (secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysDifference === 1) {
      return { type: 'daily', interval: 1 };
    } else if (daysDifference === 7) {
      return { type: 'weekly', interval: 1 };
    } else if (daysDifference >= 28 && daysDifference <= 31) {
      return { type: 'monthly', interval: 1 };
    } else if (daysDifference % 7 === 0) {
      return { type: 'weekly', interval: daysDifference / 7 };
    } else {
      return { type: 'custom', interval: daysDifference };
    }
  }
}

// ============================================================================
// MILESTONE ENTITY BUSINESS LOGIC (Migrated from core/domain)
// ============================================================================

export interface MilestoneBudgetValidation {
  isValid: boolean;
  totalAllocated: number;
  budgetUtilization: number;
  overageAmount: number;
  formattedTotal: string;
}

export interface MilestoneTimeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MilestoneDateValidation {
  isValid: boolean;
  isWithinProject: boolean;
  conflictsWithExisting: boolean;
  errors: string[];
}

/**
 * Milestone Domain Rules - Migrated from MilestoneEntity
 */
export class UnifiedMilestoneEntity {
  /**
   * Domain Rule: Time allocation must be non-negative
   */
  static validateTimeAllocation(hours: number): boolean {
    return hours >= 0;
  }

  /**
   * Domain Rule: Phase due date must be within project bounds
   */
  static isDateWithinProject(
    milestoneDate: Date, 
    projectStart: Date, 
    projectEnd: Date
  ): boolean {
    return milestoneDate >= projectStart && milestoneDate <= projectEnd;
  }

  /**
   * Domain Rule: Calculate total budget utilization across milestones
   */
  static calculateBudgetUtilization(
    phases: Phase[], 
    projectBudget: number
  ): number {
    const totalAllocated = milestones.reduce(
      (sum, milestone) => sum + (milestone.timeAllocationHours ?? milestone.timeAllocation ?? 0), 
      0
    );
    return projectBudget > 0 ? totalAllocated / projectBudget : 0;
  }

  /**
   * Domain Rule: Check if adding a milestone would exceed project budget
   */
  static wouldExceedBudget(
    existingPhases: Phase[],
    additionalHours: number,
    projectBudget: number
  ): MilestoneBudgetValidation {
    const currentTotal = existingPhases.reduce(
      (sum, m) => sum + (m.timeAllocation || 0), 
      0
    );
    const newTotal = currentTotal + additionalHours;
    const isValid = newTotal <= projectBudget;
    
    return {
      isValid,
      totalAllocated: newTotal,
      budgetUtilization: projectBudget > 0 ? newTotal / projectBudget : 0,
      overageAmount: Math.max(0, newTotal - projectBudget),
      formattedTotal: `${newTotal}h`
    };
  }

  /**
   * Domain Rule: Check if updating a specific milestone would exceed budget
   */
  static wouldUpdateExceedBudget(
    phases: Phase[],
    milestoneId: string,
    newTimeAllocation: number,
    projectBudget: number
  ): MilestoneBudgetValidation {
    // Calculate total excluding the milestone being updated
    const totalExcludingCurrent = milestones
      .filter(p => m.id !== milestoneId)
      .reduce((sum, m) => sum + (m.timeAllocation || 0), 0);
    
    const newTotal = totalExcludingCurrent + newTimeAllocation;
    const isValid = newTotal <= projectBudget;
    
    return {
      isValid,
      totalAllocated: newTotal,
      budgetUtilization: projectBudget > 0 ? newTotal / projectBudget : 0,
      overageAmount: Math.max(0, newTotal - projectBudget),
      formattedTotal: `${newTotal}h`
    };
  }

  /**
   * Domain Rule: Validate milestone time allocation constraints
   */
  static validateMilestoneTime(
    timeAllocation: number,
    projectBudget: number
  ): MilestoneTimeValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.validateTimeAllocation(timeAllocation)) {
      errors.push('Time allocation cannot be negative');
    }

    if (timeAllocation > projectBudget) {
      errors.push('Time allocation exceeds total project budget');
    }

    if (timeAllocation > projectBudget * 0.8) {
      warnings.push('Time allocation is more than 80% of project budget');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Domain Rule: Check if milestone date conflicts with existing milestones
   */
  static hasDateConflict(
    proposedDate: Date,
    existingPhases: Phase[],
    excludeMilestoneId?: string
  ): boolean {
    return existingPhases
      .filter(p => !excludeMilestoneId || m.id !== excludeMilestoneId)
      .some(p => m.dueDate.getTime() === proposedDate.getTime());
  }

  /**
   * Domain Rule: Validate milestone date constraints
   */
  static validateMilestoneDate(
    proposedDate: Date,
    projectStart: Date,
    projectEnd: Date,
    existingPhases: Phase[],
    excludeMilestoneId?: string
  ): MilestoneDateValidation {
    const errors: string[] = [];
    
    const isWithinProject = this.isDateWithinProject(proposedDate, projectStart, projectEnd);
    if (!isWithinProject) {
      errors.push('Milestone date must be within project timeframe');
    }

    const conflictsWithExisting = this.hasDateConflict(
      proposedDate, 
      existingPhases, 
      excludeMilestoneId
    );
    if (conflictsWithExisting) {
      errors.push('Another milestone already exists on this date');
    }

    return {
      isValid: errors.length === 0,
      isWithinProject,
      conflictsWithExisting,
      errors
    };
  }

  /**
   * Domain Rule: Format milestone budget display
   */
  static formatBudget(hours: number): string {
    if (hours === 0) return '0h';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours % 1 === 0) return `${hours}h`;
    
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return minutes === 0 ? `${wholeHours}h` : `${wholeHours}h ${minutes}m`;
  }

  /**
   * Domain Rule: Check if milestone is recurring type (by name pattern)
   * Recurring milestones follow the pattern "Name N" where N is a number
   */
  static isRecurringPhase(milestone: Milestone): boolean {
    return milestone.name ? /\s\d+$/.test(milestone.name) : false;
  }

  /**
   * Domain Rule: Check if milestone is regular (non-recurring) type
   */
  static isRegularMilestone(milestone: Milestone): boolean {
    return !this.isRecurringPhase(milestone);
  }
}

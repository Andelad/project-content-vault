/**
 * Milestone Domain Entity
 * 
 * Contains pure business rules about milestones - the fundamental "laws of physics"
 * for milestone behavior that are always true regardless of implementation.
 * 
 * ✅ Pure functions only - no side effects, no external dependencies
 * ✅ Testable without mocks
 * ✅ Universal business rules
 */

import { Milestone } from '@/types/core';

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

export class MilestoneEntity {
  /**
   * Domain Rule: Time allocation must be non-negative
   */
  static validateTimeAllocation(hours: number): boolean {
    return hours >= 0;
  }

  /**
   * Domain Rule: Milestone due date must be within project bounds
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
    milestones: Milestone[], 
    projectBudget: number
  ): number {
    const totalAllocated = milestones.reduce(
      (sum, milestone) => sum + (milestone.timeAllocation || 0), 
      0
    );
    return projectBudget > 0 ? totalAllocated / projectBudget : 0;
  }

  /**
   * Domain Rule: Check if adding a milestone would exceed project budget
   */
  static wouldExceedBudget(
    existingMilestones: Milestone[],
    additionalHours: number,
    projectBudget: number
  ): MilestoneBudgetValidation {
    const currentTotal = existingMilestones.reduce(
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
    milestones: Milestone[],
    milestoneId: string,
    newTimeAllocation: number,
    projectBudget: number
  ): MilestoneBudgetValidation {
    // Calculate total excluding the milestone being updated
    const totalExcludingCurrent = milestones
      .filter(m => m.id !== milestoneId)
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
    existingMilestones: Milestone[],
    excludeMilestoneId?: string
  ): boolean {
    return existingMilestones
      .filter(m => !excludeMilestoneId || m.id !== excludeMilestoneId)
      .some(m => m.dueDate.getTime() === proposedDate.getTime());
  }

  /**
   * Domain Rule: Validate milestone date constraints
   */
  static validateMilestoneDate(
    proposedDate: Date,
    projectStart: Date,
    projectEnd: Date,
    existingMilestones: Milestone[],
    excludeMilestoneId?: string
  ): MilestoneDateValidation {
    const errors: string[] = [];
    
    const isWithinProject = this.isDateWithinProject(proposedDate, projectStart, projectEnd);
    if (!isWithinProject) {
      errors.push('Milestone date must be within project timeframe');
    }

    const conflictsWithExisting = this.hasDateConflict(
      proposedDate, 
      existingMilestones, 
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
  static isRecurringMilestone(milestone: Milestone): boolean {
    return milestone.name ? /\s\d+$/.test(milestone.name) : false;
  }

  /**
   * Domain Rule: Check if milestone is regular (non-recurring) type
   */
  static isRegularMilestone(milestone: Milestone): boolean {
    return !this.isRecurringMilestone(milestone);
  }
}

/**
 * Milestone Business Rules - DEPRECATED
 * 
 * ⚠️ DEPRECATION NOTICE (December 2025):
 * This file is deprecated. All milestone/phase business logic has been consolidated into PhaseRules.
 * 
 * This wrapper delegates all calls to PhaseRules for backward compatibility.
 * Please update your imports to use PhaseRules instead:
 * 
 * @example
 * ```ts
 * // Old:
 * import { MilestoneRules } from './MilestoneRules';
 * 
 * // New:
 * import { PhaseRules } from './PhaseRules';
 * ```
 * 
 * Migration Path:
 * 1. Update imports from MilestoneRules to PhaseRules
 * 2. Update method calls (all methods have same names)
 * 3. This wrapper will be removed in a future release
 * 
 * @deprecated Use PhaseRules instead
 * @see PhaseRules for current implementation
 * @see docs/operations/MILESTONE_TO_PHASE_MIGRATION.md
 */

import { PhaseRules } from './PhaseRules';
import type { Milestone, Project } from '@/types/core';

export type {
  MilestoneValidationResult,
  MilestoneDateValidation,
  MilestoneTimeValidation,
  MilestoneBudgetCheck,
  RecurringMilestoneRuleConfig
} from './PhaseRules';

/**
 * @deprecated Use PhaseRules instead
 */
export class MilestoneRules {
  
  /**
   * @deprecated Use PhaseRules.validateTimeAllocation instead
   */
  static validateTimeAllocation(timeAllocation: number): boolean {
    return PhaseRules.validateTimeAllocation(timeAllocation);
  }

  /**
   * @deprecated Use PhaseRules.validateMilestoneDateWithinProject instead
   */
  static validateMilestoneDateWithinProject(
    milestoneEndDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
    continuous: boolean = false
  ) {
    return PhaseRules.validateMilestoneDateWithinProject(
      milestoneEndDate,
      projectStartDate,
      projectEndDate,
      continuous
    );
  }

  /**
   * @deprecated Use PhaseRules.validateMilestoneDateRange instead
   */
  static validateMilestoneDateRange(
    startDate: Date | undefined,
    endDate: Date
  ) {
    return PhaseRules.validateMilestoneDateRange(startDate, endDate);
  }

  /**
   * @deprecated Use PhaseRules.validateRecurringMilestone instead
   */
  static validateRecurringMilestone(
    isRecurring: boolean,
    recurringConfig: any,
    timeAllocation: number
  ) {
    return PhaseRules.validateRecurringMilestone(
      isRecurring,
      recurringConfig,
      timeAllocation
    );
  }

  /**
   * @deprecated Use PhaseRules.calculateTotalAllocation instead
   */
  static calculateTotalAllocation(milestones: Milestone[]): number {
    return PhaseRules.calculateTotalAllocation(milestones);
  }

  /**
   * @deprecated Use PhaseRules.checkBudgetConstraint instead
   */
  static checkBudgetConstraint(
    milestones: Milestone[],
    projectBudget: number,
    excludeMilestoneId?: string
  ) {
    return PhaseRules.checkBudgetConstraint(
      milestones,
      projectBudget,
      excludeMilestoneId
    );
  }

  /**
   * @deprecated Use PhaseRules.canAccommodateAdditionalMilestone instead
   */
  static canAccommodateAdditionalMilestone(
    milestones: Milestone[],
    projectBudget: number,
    additionalHours: number
  ): boolean {
    return PhaseRules.canAccommodateAdditionalMilestone(
      milestones,
      projectBudget,
      additionalHours
    );
  }

  /**
   * @deprecated Use PhaseRules.validateMilestoneTime instead
   */
  static validateMilestoneTime(
    timeAllocation: number,
    projectBudget: number
  ) {
    return PhaseRules.validateMilestoneTime(timeAllocation, projectBudget);
  }

  /**
   * @deprecated Use PhaseRules.validateMilestone instead
   */
  static validateMilestone(
    milestone: Milestone,
    project: Project,
    existingMilestones: Milestone[] = []
  ) {
    return PhaseRules.validateMilestone(milestone, project, existingMilestones);
  }

  /**
   * @deprecated Use PhaseRules.calculateBudgetUtilization instead
   */
  static calculateBudgetUtilization(
    milestones: Milestone[],
    projectBudget: number
  ): number {
    return PhaseRules.calculateBudgetUtilization(milestones, projectBudget);
  }

  /**
   * @deprecated Use PhaseRules.calculateRemainingBudget instead
   */
  static calculateRemainingBudget(
    milestones: Milestone[],
    projectBudget: number
  ): number {
    return PhaseRules.calculateRemainingBudget(milestones, projectBudget);
  }

  /**
   * @deprecated Use PhaseRules.calculateBudgetOverage instead
   */
  static calculateBudgetOverage(
    milestones: Milestone[],
    projectBudget: number
  ): number {
    return PhaseRules.calculateBudgetOverage(milestones, projectBudget);
  }

  /**
   * @deprecated Use PhaseRules.calculateAverageMilestoneAllocation instead
   */
  static calculateAverageMilestoneAllocation(milestones: Milestone[]): number {
    return PhaseRules.calculateAverageMilestoneAllocation(milestones);
  }

  /**
   * @deprecated Use PhaseRules.generateRecommendations instead
   */
  static generateRecommendations(
    milestones: Milestone[],
    projectBudget: number
  ): string[] {
    return PhaseRules.generateRecommendations(milestones, projectBudget);
  }

  /**
   * @deprecated Use PhaseRules.sortMilestonesByDate instead
   */
  static sortMilestonesByDate(milestones: Milestone[]): Milestone[] {
    return PhaseRules.sortMilestonesByDate(milestones);
  }

  /**
   * @deprecated Use PhaseRules.validateMilestonePosition instead
   */
  static validateMilestonePosition(
    milestoneDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
    otherMilestoneDates: Date[],
    originalDate?: Date
  ) {
    return PhaseRules.validateMilestonePosition(
      milestoneDate,
      projectStartDate,
      projectEndDate,
      otherMilestoneDates,
      originalDate
    );
  }

  /**
   * @deprecated Use PhaseRules.isRecurringMilestone instead
   */
  static isRecurringMilestone(milestone: Milestone): boolean {
    return PhaseRules.isRecurringMilestone(milestone);
  }

  /**
   * @deprecated Use PhaseRules.validatePhaseEndDateNotInPast instead
   */
  static validatePhaseEndDateNotInPast(
    phase: Milestone,
    today: Date = new Date()
  ) {
    return PhaseRules.validatePhaseEndDateNotInPast(phase, today);
  }

  /**
   * @deprecated Use PhaseRules.calculateMinimumPhaseEndDate instead
   */
  static calculateMinimumPhaseEndDate(
    phase: Milestone,
    today: Date = new Date()
  ): Date {
    return PhaseRules.calculateMinimumPhaseEndDate(phase, today);
  }

  /**
   * @deprecated Use PhaseRules.validatePhaseSpacing instead
   */
  static validatePhaseSpacing(
    phases: Milestone[]
  ) {
    return PhaseRules.validatePhaseSpacing(phases);
  }

  /**
   * @deprecated Use PhaseRules.cascadePhaseAdjustments instead
   */
  static cascadePhaseAdjustments(
    phases: Milestone[],
    adjustedPhaseId: string,
    newEndDate: Date
  ): Milestone[] {
    return PhaseRules.cascadePhaseAdjustments(phases, adjustedPhaseId, newEndDate);
  }
}

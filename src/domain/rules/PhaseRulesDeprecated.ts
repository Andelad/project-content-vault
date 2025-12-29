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
 * import { PhaseRules } from './PhaseRules';
 * 
 * // New:
 * import { PhaseRules } from './PhaseRules';
 * ```
 * 
 * Migration Path:
 * 1. Update imports from PhaseRules to PhaseRules
 * 2. Update method calls (all methods have same names)
 * 3. This wrapper will be removed in a future release
 * 
 * @deprecated Use PhaseRules instead
 * @see PhaseRules for current implementation
 * @see docs/operations/MILESTONE_TO_PHASE_MIGRATION.md
 */

import { PhaseRules } from './PhaseRules';
import type { Phase, Project } from '@/types/core';

export type {
  MilestoneValidationResult,
  MilestoneDateValidation,
  MilestoneTimeValidation,
  MilestoneBudgetCheck,
  RecurringPhaseRuleConfig
} from './PhaseRules';

/**
 * @deprecated Use PhaseRules instead
 */
export class PhaseRules {
  
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
   * @deprecated Use PhaseRules.validateRecurringPhase instead
   */
  static validateRecurringPhase(
    isRecurring: boolean,
    recurringConfig: any,
    timeAllocation: number
  ) {
    return PhaseRules.validateRecurringPhase(
      isRecurring,
      recurringConfig,
      timeAllocation
    );
  }

  /**
   * @deprecated Use PhaseRules.calculateTotalAllocation instead
   */
  static calculateTotalAllocation(milestones: Phase[]): number {
    return PhaseRules.calculateTotalAllocation(milestones);
  }

  /**
   * @deprecated Use PhaseRules.checkBudgetConstraint instead
   */
  static checkBudgetConstraint(
    milestones: Phase[],
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
    milestones: Phase[],
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
    milestone: Phase,
    project: Project,
    existingMilestones: Phase[] = []
  ) {
    return PhaseRules.validateMilestone(milestone, project, existingMilestones);
  }

  /**
   * @deprecated Use PhaseRules.calculateBudgetUtilization instead
   */
  static calculateBudgetUtilization(
    milestones: Phase[],
    projectBudget: number
  ): number {
    return PhaseRules.calculateBudgetUtilization(milestones, projectBudget);
  }

  /**
   * @deprecated Use PhaseRules.calculateRemainingBudget instead
   */
  static calculateRemainingBudget(
    milestones: Phase[],
    projectBudget: number
  ): number {
    return PhaseRules.calculateRemainingBudget(milestones, projectBudget);
  }

  /**
   * @deprecated Use PhaseRules.calculateBudgetOverage instead
   */
  static calculateBudgetOverage(
    milestones: Phase[],
    projectBudget: number
  ): number {
    return PhaseRules.calculateBudgetOverage(milestones, projectBudget);
  }

  /**
   * @deprecated Use PhaseRules.calculateAverageMilestoneAllocation instead
   */
  static calculateAverageMilestoneAllocation(milestones: Phase[]): number {
    return PhaseRules.calculateAverageMilestoneAllocation(milestones);
  }

  /**
   * @deprecated Use PhaseRules.generateRecommendations instead
   */
  static generateRecommendations(
    milestones: Phase[],
    projectBudget: number
  ): string[] {
    return PhaseRules.generateRecommendations(milestones, projectBudget);
  }

  /**
   * @deprecated Use PhaseRules.sortMilestonesByDate instead
   */
  static sortMilestonesByDate(milestones: Phase[]): Phase[] {
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
   * @deprecated Use PhaseRules.isRecurringPhase instead
   */
  static isRecurringPhase(milestone: Phase): boolean {
    return PhaseRules.isRecurringPhase(milestone);
  }

  /**
   * @deprecated Use PhaseRules.validatePhaseEndDateNotInPast instead
   */
  static validatePhaseEndDateNotInPast(
    phase: Phase,
    today: Date = new Date()
  ) {
    return PhaseRules.validatePhaseEndDateNotInPast(phase, today);
  }

  /**
   * @deprecated Use PhaseRules.calculateMinimumPhaseEndDate instead
   */
  static calculateMinimumPhaseEndDate(
    phase: Phase,
    today: Date = new Date()
  ): Date {
    return PhaseRules.calculateMinimumPhaseEndDate(phase, today);
  }

  /**
   * @deprecated Use PhaseRules.validatePhaseSpacing instead
   */
  static validatePhaseSpacing(
    phases: Phase[]
  ) {
    return PhaseRules.validatePhaseSpacing(phases);
  }

  /**
   * @deprecated Use PhaseRules.cascadePhaseAdjustments instead
   */
  static cascadePhaseAdjustments(
    phases: Phase[],
    adjustedPhaseId: string,
    newEndDate: Date
  ): Phase[] {
    return PhaseRules.cascadePhaseAdjustments(phases, adjustedPhaseId, newEndDate);
  }
}

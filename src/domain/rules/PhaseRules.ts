/**
 * Phase Business Rules
 * 
 * Single source of truth for phase-related business logic.
 * 
 * Key Domain Concepts:
 * - Phase: Has both startDate and endDate (represents a time period)
 * - Milestone: Has only endDate/dueDate (represents a deadline)
 * 
 * Budget Model (Mutually Exclusive):
 * 1. Fixed Budget (Default): Project has total hours budget (e.g., 28h)
 *    - Can be single phase (implicit) or split into multiple phases
 *    - Budget validation applies: sum of phases ≤ project budget
 * 
 * 2. Recurring Template: Project has recurring pattern (e.g., 8h/week)
 *    - REPLACES the fixed budget entirely (budget becomes N/A)
 *    - No budget validation - operates independently of project hours
 *    - Cannot coexist with split phases
 * 
 * This is the domain layer - pure business logic with no external dependencies.
 * Services and components should delegate to these rules.
 * 
 * Created: 2025-11-10
 * Part of: Milestone-to-Phase Migration
 * 
 * @see docs/MILESTONE_TO_PHASE_MIGRATION_ASSESSMENT.md
 */

import type { Milestone } from '@/types/core';

/**
 * A Phase is a Milestone with a defined start date
 * This creates a time period rather than just a deadline
 */
export type Phase = Milestone & { startDate: Date };

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard: Check if a milestone is actually a phase
 * 
 * A phase has both startDate and endDate, representing a time period.
 * A pure milestone only has a deadline (endDate/dueDate).
 * 
 * @param milestone - The milestone to check
 * @returns True if the milestone has a startDate (is a phase)
 * 
 * @example
 * ```ts
 * const items = [phase1, milestone1, phase2];
 * const phases = items.filter(isPhase); // Type-safe Phase[]
 * ```
 */
export function isPhase(milestone: Milestone): milestone is Phase {
  return milestone.startDate !== undefined;
}

/**
 * Type guard: Check if a milestone is a pure milestone (not a phase)
 * 
 * @param milestone - The milestone to check
 * @returns True if the milestone does NOT have a startDate
 * 
 * @example
 * ```ts
 * const items = [phase1, milestone1, phase2];
 * const milestones = items.filter(isMilestone); // Pure milestones only
 * ```
 */
export function isMilestone(milestone: Milestone): boolean {
  return milestone.startDate === undefined;
}

// ============================================================================
// FILTERING RULES
// ============================================================================

/**
 * Extract all phases from a mixed array of milestones
 * 
 * Filters for items that have startDate defined and returns them
 * as type-safe Phase[] array.
 * 
 * @param milestones - Array of milestones (may include phases)
 * @returns Array of only phases
 * 
 * @example
 * ```ts
 * const projectItems = project.milestones;
 * const phases = getPhases(projectItems);
 * // phases is Phase[] - TypeScript knows they have startDate
 * ```
 */
export function getPhases(milestones: Milestone[]): Phase[] {
  return milestones.filter(isPhase);
}

/**
 * Extract all pure milestones (non-phases) from a mixed array
 * 
 * Filters for items that do NOT have startDate defined.
 * 
 * @param milestones - Array of milestones (may include phases)
 * @returns Array of only pure milestones (no startDate)
 * 
 * @example
 * ```ts
 * const projectItems = project.milestones;
 * const pureMilestones = getMilestones(projectItems);
 * // These are deadline-only milestones
 * ```
 */
export function getMilestones(milestones: Milestone[]): Milestone[] {
  return milestones.filter(isMilestone);
}

// ============================================================================
// SORTING RULES
// ============================================================================

/**
 * Sort phases by end date (ascending)
 * 
 * @param phases - Array of phases to sort
 * @returns Sorted array (earliest end date first)
 */
export function sortPhasesByEndDate(phases: Phase[]): Phase[] {
  return [...phases].sort((a, b) => {
    const aDate = new Date(a.endDate).getTime();
    const bDate = new Date(b.endDate).getTime();
    return aDate - bDate;
  });
}

/**
 * Sort phases by start date (ascending)
 * 
 * @param phases - Array of phases to sort
 * @returns Sorted array (earliest start date first)
 */
export function sortPhasesByStartDate(phases: Phase[]): Phase[] {
  return [...phases].sort((a, b) => {
    const aDate = new Date(a.startDate).getTime();
    const bDate = new Date(b.startDate).getTime();
    return aDate - bDate;
  });
}

// ============================================================================
// COMBINED OPERATIONS
// ============================================================================

/**
 * Get phases sorted by end date from a mixed milestone array
 * 
 * Combines filtering and sorting in one convenient function.
 * This is the most common operation needed in components.
 * 
 * @param milestones - Array of milestones (may include phases)
 * @returns Sorted array of phases only
 * 
 * @extracted-from ProjectBar.tsx line 755 (inline filter + sort)
 * 
 * @example
 * ```ts
 * // Instead of:
 * const phases = milestones.filter(m => m.endDate !== undefined)
 *   .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());
 * 
 * // Use:
 * const phases = getPhasesSortedByEndDate(milestones);
 * ```
 */
export function getPhasesSortedByEndDate(milestones: Milestone[]): Phase[] {
  return sortPhasesByEndDate(getPhases(milestones));
}

/**
 * Phase Business Rules Class
 * 
 * Contains validation and business rules for phases.
 * See docs/PHASE_DOMAIN_LOGIC.md for complete phase model documentation.
 * 
 * Key Rules:
 * 1. Default Phase: Every project is implicitly one phase (project duration + full budget)
 * 2. Split Phases: Explicit phases divide the project timeline sequentially
 * 3. Recurring Template: Single template that repeats (REPLACES fixed budget)
 * 4. Mutual Exclusivity: Projects can't have BOTH split phases AND recurring template
 * 
 * Budget Logic:
 * - Fixed Budget Mode: Budget validation applies (phases must sum to ≤ project budget)
 * - Recurring Mode: Budget validation DISABLED (project budget becomes N/A)
 */
export class PhaseRules {
  
  /**
   * RULE: Projects cannot have both split phases and recurring template
   * 
   * Split phases and recurring templates are mutually exclusive ways to structure project time.
   * Having both would create ambiguous capacity calculations.
   * 
   * @param milestones - All milestones/phases for a project
   * @returns Object indicating if project has splits, recurring, or conflict
   * 
   * @see docs/PHASE_DOMAIN_LOGIC.md - Rule 4: Mutual Exclusivity
   */
  static checkPhaseRecurringExclusivity(milestones: Milestone[]): {
    hasSplitPhases: boolean;
    hasRecurringTemplate: boolean;
    isValid: boolean;
    error?: string;
  } {
    const splitPhases = milestones.filter(m => m.startDate !== undefined);
    const recurringTemplate = milestones.find(m => m.isRecurring === true);
    
    const hasSplitPhases = splitPhases.length > 0;
    const hasRecurringTemplate = !!recurringTemplate;
    
    if (hasSplitPhases && hasRecurringTemplate) {
      return {
        hasSplitPhases,
        hasRecurringTemplate,
        isValid: false,
        error: 'Project cannot have both split phases and recurring template. These are mutually exclusive.'
      };
    }
    
    return {
      hasSplitPhases,
      hasRecurringTemplate,
      isValid: true
    };
  }
  
  /**
   * RULE: Split phases must be sequential (no overlaps)
   * 
   * Phases are ordered by start date and cannot overlap.
   * Gaps between phases are allowed (representing planned pauses).
   * First phase must start at project start, last phase must end at project end.
   * 
   * @param phases - Array of phases (sorted by start date)
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @returns Validation result with errors (overlaps) and warnings (gaps)
   */
  static validatePhasesContinuity(
    phases: Phase[],
    projectStartDate: Date,
    projectEndDate: Date
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (phases.length === 0) {
      return { isValid: true, errors, warnings };
    }
    
    // Sort by start date
    const sorted = sortPhasesByStartDate(phases);
    
    // First phase should start at project start
    const firstPhaseStart = new Date(sorted[0].startDate).getTime();
    const projectStart = new Date(projectStartDate).getTime();
    if (firstPhaseStart !== projectStart) {
      errors.push(`First phase should start at project start date`);
    }
    
    // Last phase should end at project end
    const lastPhaseEnd = new Date(sorted[sorted.length - 1].endDate).getTime();
    const projectEnd = new Date(projectEndDate).getTime();
    if (lastPhaseEnd !== projectEnd) {
      errors.push(`Last phase should end at project end date`);
    }
    
    // Check for overlaps and gaps between phases
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = new Date(sorted[i].endDate).getTime();
      const nextStart = new Date(sorted[i + 1].startDate).getTime();
      
      if (currentEnd >= nextStart) {
        // Overlap or same-day is an ERROR - phases must be sequential
        errors.push(
          `Overlap between "${sorted[i].name}" and "${sorted[i + 1].name}" - phases must be on different days`
        );
      } else if (currentEnd < nextStart) {
        // Gap is a WARNING (allowed, but informational)
        const gapDays = Math.round((nextStart - currentEnd) / (1000 * 60 * 60 * 24));
        warnings.push(
          `${gapDays}-day gap between "${sorted[i].name}" and "${sorted[i + 1].name}" (pause time with no estimate)`
        );
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * RULE: Phase budget allocations should not exceed project budget
   * 
   * Sum of all phase time allocations should be ≤ project's estimated hours.
   * This is a warning, not a hard error, as budget can be adjusted.
   * 
   * @param phases - Array of phases
   * @param projectEstimatedHours - Total project budget
   * @returns Budget check result
   */
  static validatePhaseBudgets(
    phases: Phase[],
    projectEstimatedHours: number
  ): {
    isValid: boolean;
    totalAllocated: number;
    remaining: number;
    overage: number;
    utilizationPercentage: number;
  } {
    const totalAllocated = phases.reduce((sum, phase) => {
      return sum + (phase.timeAllocationHours ?? phase.timeAllocation ?? 0);
    }, 0);
    
    const remaining = projectEstimatedHours - totalAllocated;
    const overage = totalAllocated > projectEstimatedHours ? totalAllocated - projectEstimatedHours : 0;
    const utilizationPercentage = projectEstimatedHours > 0 
      ? (totalAllocated / projectEstimatedHours) * 100 
      : 0;
    
    return {
      isValid: totalAllocated <= projectEstimatedHours,
      totalAllocated,
      remaining,
      overage,
      utilizationPercentage
    };
  }

  /**
   * RULE: Calculate dates for adding a new phase
   * 
   * When adding a new phase, shrink the last phase to make room.
   * 
   * New phase gets:
   * - 1 day if last phase spans <= 21 days
   * - 6 days if last phase spans > 21 days
   * 
   * @param existingPhases - Current phases
   * @param projectEndDate - Project end date
   * @returns Dates for new phase and updated last phase end date
   */
  static calculateNewPhaseDates(
    existingPhases: Phase[],
    projectEndDate: Date
  ): {
    newPhaseStart: Date;
    newPhaseEnd: Date;
    lastPhaseNewEnd: Date;
  } {
    if (existingPhases.length === 0) {
      throw new Error('Cannot add phase: no existing phases');
    }

    // Get last phase
    const sortedPhases = [...existingPhases].sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    const lastPhase = sortedPhases[sortedPhases.length - 1];

    // How many days does last phase span?
    const lastPhaseStart = new Date(lastPhase.startDate).getTime();
    const lastPhaseEnd = new Date(lastPhase.endDate || lastPhase.dueDate).getTime();
    const lastPhaseDays = Math.ceil((lastPhaseEnd - lastPhaseStart) / (24 * 60 * 60 * 1000));

    // New phase duration: 1 day or 6 days
    const newPhaseDays = lastPhaseDays <= 21 ? 1 : 6;

    // Work backwards from project end
    const newPhaseEnd = new Date(projectEndDate);
    const newPhaseStart = new Date(projectEndDate.getTime() - (newPhaseDays * 24 * 60 * 60 * 1000));
    // Last phase should end the day BEFORE new phase starts (no overlap)
    const lastPhaseNewEnd = new Date(newPhaseStart.getTime() - (24 * 60 * 60 * 1000));

    return {
      newPhaseStart,
      newPhaseEnd,
      lastPhaseNewEnd
    };
  }

  /**
   * Repair overlapping phases by adjusting dates to be sequential
   * 
   * When phases share the same end/start date, this fixes them by:
   * - Keeping the first phase's end date
   * - Moving subsequent phases to start the day after the previous phase ends
   * 
   * @param phases - Array of phases with potential overlaps
   * @returns Array of updated phases with fixes applied
   * 
   * @example
   * Input:  Phase 1 (Nov 1 → Nov 15), Phase 2 (Nov 15 → Nov 30)
   * Output: Phase 1 (Nov 1 → Nov 15), Phase 2 (Nov 16 → Nov 30)
   */
  static repairOverlappingPhases(phases: Phase[]): Array<{ phaseId: string; updates: { startDate?: Date; endDate?: Date } }> {
    if (phases.length === 0) {
      return [];
    }

    const sorted = sortPhasesByStartDate(phases);
    const repairs: Array<{ phaseId: string; updates: { startDate?: Date; endDate?: Date } }> = [];

    // Check each adjacent pair
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentPhase = sorted[i];
      const nextPhase = sorted[i + 1];
      
      const currentEnd = new Date(currentPhase.endDate).getTime();
      const nextStart = new Date(nextPhase.startDate).getTime();
      
      // If phases overlap or share same day, fix the next phase to start day after current ends
      if (currentEnd >= nextStart) {
        const fixedStartDate = new Date(currentEnd + (24 * 60 * 60 * 1000));
        repairs.push({
          phaseId: nextPhase.id,
          updates: {
            startDate: fixedStartDate
          }
        });
        
        // Update sorted array for subsequent iterations
        sorted[i + 1] = { ...nextPhase, startDate: fixedStartDate };
      }
    }

    return repairs;
  }
}

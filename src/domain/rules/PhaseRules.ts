/**
 * Phase Business Rules
 * 
 * Single source of truth for phase-related business logic.
 * 
 * Key Domain Concepts:
 * - Phase: Has both startDate and endDate (represents a time period)
 * - Milestone: Has only endDate/dueDate (represents a deadline)
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
 * Will contain validation and business rules for phases as they are extracted
 * from components and MilestoneRules.
 * 
 * TODO: Extract phase-specific methods from MilestoneRules:
 * - validatePhaseEndDateNotInPast
 * - calculateMinimumPhaseEndDate
 * - validatePhaseSpacing
 * - cascadePhaseAdjustments
 */
export class PhaseRules {
  // Phase validation and business rules will be added here
  // as they are extracted from MilestoneRules and components
}

/**
 * Phase Hierarchy & Sequencing Rules
 * 
 * Handles phase ordering, continuity, and structural rules:
 * - Sequential phase ordering (no overlaps)
 * - Continuity validation (coverage of project timeline)
 * - Phase splitting calculations
 * - Overlap detection and repair
 * - Cascading date adjustments
 * - Mutual exclusivity (split phases vs recurring templates)
 * 
 * Part of three-layer architecture:
 * - domain/rules/phases/PhaseValidation.ts (validation rules)
 * - domain/rules/phases/PhaseCalculations.ts (budget calculations)
 * - domain/rules/phases/PhaseHierarchy.ts (THIS FILE - sequencing & continuity)
 * 
 * Created: 2026-01-07 (split from PhaseRules.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 * @see docs/PHASE_DOMAIN_LOGIC.md
 */

import type { PhaseDTO } from '@/types/core';
import { normalizeToMidnight, addDaysToDate } from '@/utils/dateCalculations';

// ============================================================================
// HELPER FUNCTIONS (for internal use)
// ============================================================================

/**
 * Sort phases by start date (ascending)
 * 
 * @param phases - Array of phases to sort
 * @returns Sorted array (earliest start date first)
 */
function sortPhasesByStartDate(phases: PhaseDTO[]): PhaseDTO[] {
  return [...phases].sort((a, b) => {
    const aDate = new Date(a.startDate).getTime();
    const bDate = new Date(b.startDate).getTime();
    return aDate - bDate;
  });
}

// ============================================================================
// PHASE HIERARCHY RULES
// ============================================================================

/**
 * Phase Hierarchy Rules
 * 
 * Manages structural relationships between phases:
 * - Sequential ordering
 * - Continuity across project timeline
 * - Split phase calculations
 * - Overlap resolution
 */
export class PhaseHierarchyRules {
  
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
  static checkPhaseRecurringExclusivity(phases: PhaseDTO[]): {
    hasSplitPhases: boolean;
    hasRecurringTemplate: boolean;
    isValid: boolean;
    error?: string;
  } {
    // Split phases are regular phases with startDate (exclude recurring templates)
    const splitPhases = phases.filter(p => p.startDate !== undefined && p.isRecurring !== true);
    const recurringTemplate = phases.find(p => p.isRecurring === true);
    
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
   * RULE: Calculate initial phase split for a project
   * 
   * When splitting a project estimate into phases, divide project timeline at midpoint
   * and allocate budget evenly. Phase 2 starts the day after Phase 1 ends (no overlap).
   * 
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param totalBudget - Total project budget in hours
   * @returns Two phase configurations ready for creation
   */
  static calculatePhaseSplit(
    projectStartDate: Date,
    projectEndDate: Date,
    totalBudget: number
  ): {
    phase1: { name: string; startDate: Date; endDate: Date; timeAllocation: number };
    phase2: { name: string; startDate: Date; endDate: Date; timeAllocation: number };
  } {
    const projectDuration = projectEndDate.getTime() - projectStartDate.getTime();
    const midpointTime = projectStartDate.getTime() + (projectDuration / 2);
    const midpointDate = new Date(midpointTime);
    const halfBudget = totalBudget / 2;

    // Phase 1 ends on midpoint, Phase 2 starts the day AFTER (no overlap)
    const phase1EndDate = midpointDate;
    const phase2StartDate = new Date(midpointDate.getTime() + (24 * 60 * 60 * 1000));

    return {
      phase1: {
        name: 'Phase 1',
        startDate: projectStartDate,
        endDate: phase1EndDate,
        timeAllocation: halfBudget
      },
      phase2: {
        name: 'Phase 2',
        startDate: phase2StartDate,
        endDate: projectEndDate,
        timeAllocation: halfBudget
      }
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
    phases: PhaseDTO[],
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
    existingPhases: PhaseDTO[],
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
  static repairOverlappingPhases(phases: PhaseDTO[]): Array<{ phaseId: string; updates: { startDate?: Date; endDate?: Date } }> {
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
  
  /**
   * Cascade phase date adjustments when one phase moves forward
   * 
   * When a phase's end date moves forward and comes within 1 day of the next
   * phase's start date, the next phase must also move forward to maintain
   * the required spacing.
   * 
   * @param phases - Array of phases
   * @param adjustedPhaseId - ID of the phase that was adjusted
   * @param newEndDate - New end date for the adjusted phase
   * @returns Updated array of phases with cascaded adjustments
   */
  static cascadePhaseAdjustments(
    phases: PhaseDTO[],
    adjustedPhaseId: string,
    newEndDate: Date
  ): PhaseDTO[] {
    // Sort phases by end date
    const sortedPhases = [...phases].sort((a, b) => {
      const aEnd = new Date(a.endDate || a.dueDate).getTime();
      const bEnd = new Date(b.endDate || b.dueDate).getTime();
      return aEnd - bEnd;
    });
    
    // Find the adjusted phase index
    const adjustedIndex = sortedPhases.findIndex(p => p.id === adjustedPhaseId);
    if (adjustedIndex === -1 || adjustedIndex === sortedPhases.length - 1) {
      // No cascading needed if not found or if it's the last phase
      return phases;
    }
    
    const result = [...sortedPhases];
    let previousEnd = normalizeToMidnight(new Date(newEndDate));
    
    // Cascade forward from the adjusted phase
    for (let i = adjustedIndex + 1; i < result.length; i++) {
      const phase = result[i];
      const phaseStart = normalizeToMidnight(new Date(phase.startDate || previousEnd));
      
      // Check if we need to move this phase forward
      const minStart = addDaysToDate(previousEnd, 1);
      
      if (phaseStart < minStart) {
        // Calculate how many days to shift
        const daysToShift = Math.ceil((minStart.getTime() - phaseStart.getTime()) / (1000 * 60 * 60 * 24));
        
        // Shift both start and end dates
        const newStart = addDaysToDate(phaseStart, daysToShift);
        const currentEnd = new Date(phase.endDate || phase.dueDate);
        const newEnd = addDaysToDate(currentEnd, daysToShift);
        
        result[i] = {
          ...phase,
          startDate: newStart,
          endDate: newEnd,
          dueDate: newEnd // Keep dueDate in sync
        };
        
        previousEnd = newEnd;
      } else {
        // No more cascading needed
        break;
      }
    }
    
    return result;
  }

  /**
   * Sort milestones by date (natural ordering)
   * Milestones are naturally ordered by endDate - no manual ordering needed
   * 
   * @param milestones - Array of milestones
   * @returns Sorted milestones
   */
  static sortMilestonesByDate(phases: PhaseDTO[]): PhaseDTO[] {
    return phases.sort((a, b) => {
      const dateA = a.endDate || a.dueDate;
      const dateB = b.endDate || b.dueDate;
      return dateA.getTime() - dateB.getTime();
    });
  }
}

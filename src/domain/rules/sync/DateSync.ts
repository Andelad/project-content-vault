/**
 * Date Synchronization Rules
 * 
 * Cross-cutting business logic for synchronizing dates across entities.
 * 
 * Purpose:
 * - Phase dates must be within project dates
 * - Project dates derive from phase dates (when phases exist)
 * - Single source of truth for phase/project date interactions
 * 
 * This handles the bi-directional relationship:
 * - Phases constrained by project dates
 * - Project dates updated to span all phases
 * 
 * Note: Math is inline (no MathUtils extraction)
 */

import type { Project, PhaseDTO } from '@/types/core';

export interface DateSyncResult {
  success: boolean;
  updatedProject?: Partial<Project>;
  notifications?: string[];
  errors?: string[];
  warnings?: string[];
}

export class DateSync {
  /**
   * Synchronize project dates to span all phases
   * 
   * RULE: Project dates should encompass all phase dates
   * Formula: 
   * - project.startDate = MIN(phase.startDate)
   * - project.endDate = MAX(phase.endDate)
   * 
   * @param project - Current project
   * @param phases - All project phases
   * @returns Sync result with updated project dates if needed
   */
  static synchronizeProjectWithPhases(
    project: Project,
    phases: PhaseDTO[]
  ): DateSyncResult {
    if (phases.length === 0) {
      return { success: true };
    }

    // Calculate earliest phase start (inline date math)
    const earliestPhaseStart = phases.reduce((earliest, phase) => {
      if (!phase.startDate) return earliest;
      const phaseStart = new Date(phase.startDate);
      return !earliest || phaseStart < earliest ? phaseStart : earliest;
    }, null as Date | null);

    // Calculate latest phase end (inline date math)
    const latestPhaseEnd = phases.reduce((latest, phase) => {
      const phaseEnd = new Date(phase.endDate || phase.dueDate);
      return !latest || phaseEnd > latest ? phaseEnd : latest;
    }, null as Date | null);

    const notifications: string[] = [];
    let needsUpdate = false;

    const updatedProject: Partial<Project> = {};

    // Check if project start needs adjustment
    if (earliestPhaseStart) {
      const currentProjectStart = new Date(project.startDate);
      if (earliestPhaseStart < currentProjectStart) {
        updatedProject.startDate = earliestPhaseStart;
        needsUpdate = true;
        notifications.push(
          `Project start date adjusted to ${earliestPhaseStart.toLocaleDateString()} to encompass earliest phase`
        );
      }
    }

    // Check if project end needs adjustment
    if (latestPhaseEnd) {
      const currentProjectEnd = new Date(project.endDate);
      if (latestPhaseEnd > currentProjectEnd) {
        updatedProject.endDate = latestPhaseEnd;
        needsUpdate = true;
        notifications.push(
          `Project end date adjusted to ${latestPhaseEnd.toLocaleDateString()} to encompass latest phase`
        );
      }
    }

    return {
      success: true,
      updatedProject: needsUpdate ? updatedProject : undefined,
      notifications: notifications.length > 0 ? notifications : undefined
    };
  }

  /**
   * Validate that phases fall within project dates
   * 
   * RULE: Phase dates must be within project date range
   * Formula: project.startDate ≤ phase dates ≤ project.endDate
   * 
   * @param phases - Phases to validate
   * @param project - Parent project
   * @returns Validation result with errors
   */
  static validatePhasesWithinProject(
    phases: PhaseDTO[],
    project: Project
  ): DateSyncResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);

    for (const phase of phases) {
      // Check start date
      if (phase.startDate) {
        const phaseStart = new Date(phase.startDate);
        if (phaseStart < projectStart) {
          errors.push(
            `Phase "${phase.name}" starts (${phaseStart.toLocaleDateString()}) before project start (${projectStart.toLocaleDateString()})`
          );
        }
        if (phaseStart > projectEnd) {
          errors.push(
            `Phase "${phase.name}" starts (${phaseStart.toLocaleDateString()}) after project end (${projectEnd.toLocaleDateString()})`
          );
        }
      }

      // Check end date
      const phaseEnd = new Date(phase.endDate || phase.dueDate);
      if (phaseEnd < projectStart) {
        errors.push(
          `Phase "${phase.name}" ends (${phaseEnd.toLocaleDateString()}) before project start (${projectStart.toLocaleDateString()})`
        );
      }
      if (phaseEnd > projectEnd) {
        errors.push(
          `Phase "${phase.name}" ends (${phaseEnd.toLocaleDateString()}) after project end (${projectEnd.toLocaleDateString()})`
        );
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Calculate project duration from phase coverage
   * 
   * Returns the total span of days covered by phases.
   * Inline date math - no utilities.
   * 
   * @param phases - Project phases
   * @returns Duration in days, or null if no phases
   */
  static calculatePhaseCoverageDays(phases: PhaseDTO[]): number | null {
    if (phases.length === 0) return null;

    const earliestStart = phases.reduce((earliest, phase) => {
      if (!phase.startDate) return earliest;
      const phaseStart = new Date(phase.startDate);
      return !earliest || phaseStart < earliest ? phaseStart : earliest;
    }, null as Date | null);

    const latestEnd = phases.reduce((latest, phase) => {
      const phaseEnd = new Date(phase.endDate || phase.dueDate);
      return !latest || phaseEnd > latest ? phaseEnd : latest;
    }, null as Date | null);

    if (!earliestStart || !latestEnd) return null;

    // Inline date math: difference in milliseconds → days
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffMs = latestEnd.getTime() - earliestStart.getTime();
    return Math.ceil(diffMs / msPerDay);
  }
}

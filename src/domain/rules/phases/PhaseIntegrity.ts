/**
 * Phase Integrity Rules
 * 
 * KEYWORDS: phase validation, foreign key, referential integrity, phase-project relationship
 * 
 * Validates referential integrity for phases:
 * - Phase → Project foreign key validation
 * - Phase dates within project date range
 * - Phase budget allocation within project budget
 * - Orphaned phase detection (phase references non-existent project)
 * 
 * Part of entity-specific integrity rules:
 * - domain/rules/phases/PhaseIntegrity.ts (THIS FILE)
 * - domain/rules/projects/ProjectIntegrity.ts (project foreign keys)
 * - domain/rules/clients/ClientIntegrity.ts (client validation)
 * - domain/rules/groups/GroupIntegrity.ts (group validation)
 * 
 * Created: 2026-01-08 (extracted from integrity/EntityIntegrity.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { Project, PhaseDTO } from '@/shared/types/core';
import { PhaseRules } from './PhaseRules';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface IntegrityValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// PHASE INTEGRITY RULES
// ============================================================================

/**
 * Phase Integrity Rules
 * 
 * Validates that phases reference their projects correctly and maintain
 * referential integrity.
 */
export class PhaseIntegrity {
  
  // ==========================================================================
  // PHASE → PROJECT FOREIGN KEY VALIDATION
  // ==========================================================================
  
  /**
   * Validate that a phase belongs to its project and meets all constraints
   * 
   * Checks:
   * - Foreign key: phase.projectId exists in projects
   * - Date constraint: phase dates within project dates
   * - Budget constraint: phase allocation within project budget
   * 
   * @param phase - The phase to validate
   * @param project - The parent project
   * @returns Validation result
   */
  static validatePhaseBelongsToProject(
    phase: PhaseDTO,
    project: Project
  ): IntegrityValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check foreign key constraint
    if (phase.projectId !== project.id) {
      errors.push('Phase does not belong to this project (foreign key mismatch)');
      return { isValid: false, errors, warnings };
    }

    // Validate phase dates are within project range
    const phaseEndDate = phase.endDate || phase.dueDate;
    const dateValidation = PhaseRules.validatePhaseDateWithinProject(
      phaseEndDate,
      project.startDate,
      project.endDate,
      project.continuous
    );
    errors.push(...dateValidation.errors);

    // If phase has start date, validate it too
    if (phase.startDate) {
      if (phase.startDate < project.startDate) {
        errors.push('Phase start date cannot be before project start date');
      }
      if (!project.continuous && phase.startDate > project.endDate) {
        errors.push('Phase start date cannot be after project end date');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate phase budget allocation within project constraints
   * 
   * Checks that the sum of all phase allocations doesn't exceed project budget.
   * 
   * @param phases - All project phases
   * @param project - The parent project
   * @returns Validation result
   */
  static validateProjectPhaseBudget(
    phases: PhaseDTO[],
    project: Project
  ): IntegrityValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const budgetCheck = PhaseRules.checkBudgetConstraint(
      phases,
      project.estimatedHours
    );

    if (!budgetCheck.isValid) {
      errors.push(
        `Phase allocations (${budgetCheck.totalAllocated}h) exceed ` +
        `project budget (${budgetCheck.projectBudget}h) by ${budgetCheck.overage}h`
      );
    }

    if (budgetCheck.utilizationPercentage > 90 && budgetCheck.utilizationPercentage <= 100) {
      warnings.push(`Budget utilization is ${budgetCheck.utilizationPercentage.toFixed(1)}% - consider buffer time`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate all phases for a project (comprehensive check)
   * 
   * Combines:
   * - Foreign key validation for each phase
   * - Date constraint validation
   * - Budget constraint validation
   * 
   * @param project - The project
   * @param phases - All project phases
   * @returns Validation result
   */
  static validateProjectPhases(
    project: Project,
    phases: PhaseDTO[]
  ): IntegrityValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate each phase individually
    phases.forEach((phase, index) => {
      const validation = this.validatePhaseBelongsToProject(phase, project);
      if (!validation.isValid) {
        errors.push(`Phase ${index + 1} (${phase.name}): ${validation.errors.join(', ')}`);
      }
      warnings.push(...validation.warnings);
    });

    // Validate budget constraint
    const budgetValidation = this.validateProjectPhaseBudget(phases, project);
    errors.push(...budgetValidation.errors);
    warnings.push(...budgetValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // ORPHAN DETECTION
  // ==========================================================================
  
  /**
   * Find orphaned phases (project doesn't exist)
   * 
   * Orphaned phases have a projectId that doesn't exist in the projects table.
   * This violates referential integrity.
   * 
   * @param phases - All phases
   * @param projects - All projects
   * @returns List of orphaned phase IDs
   */
  static findOrphanedPhases(
    phases: PhaseDTO[],
    projects: Project[]
  ): string[] {
    const projectIds = new Set(projects.map(p => p.id));
    return phases
      .filter(phase => !projectIds.has(phase.projectId))
      .map(phase => phase.id);
  }
}

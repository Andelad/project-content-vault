/**
 * Entity Integrity Rules
 * 
 * Validates referential integrity across entities:
 * - Foreign key validation (Phase → Project, Project → Client, etc.)
 * - Orphan detection (entities with missing parents)
 * - Cross-entity constraint validation (dates, budgets)
 * 
 * This ensures the database maintains consistent relationships between entities.
 * 
 * Part of three-layer architecture:
 * - domain/rules/integrity/EntityIntegrity.ts (THIS FILE - referential integrity)
 * - domain/rules/cascade/DeletionImpact.ts (cascade analysis)
 * 
 * Created: 2026-01-07 (split from RelationshipRules.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { Project, PhaseDTO, Group, Row, Client, Label } from '@/types/core';
import { PhaseRules } from '../phases/PhaseRules';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface IntegrityValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SystemIntegrityCheck {
  isValid: boolean;
  errors: string[];
  orphanedEntities: string[];
  mismatchedEntities: string[];
}

// ============================================================================
// ENTITY INTEGRITY RULES
// ============================================================================

/**
 * Entity Integrity Rules
 * 
 * Validates that entities reference each other correctly and maintain
 * referential integrity across the system.
 */
export class EntityIntegrity {
  
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
    const dateValidation = PhaseRules.validateMilestoneDateWithinProject(
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
  // PROJECT → CLIENT/GROUP FOREIGN KEY VALIDATION
  // ==========================================================================
  
  /**
   * Validate project foreign key references
   * 
   * Checks:
   * - If clientId specified, client must exist
   * - If groupId specified, group must exist
   * 
   * @param project - The project to validate
   * @param client - The client it should belong to (undefined if no client)
   * @param group - The group it optionally belongs to (undefined if no group)
   * @returns Validation result
   */
  static validateProjectReferences(
    project: Project,
    client: Client | undefined,
    group: Group | undefined
  ): IntegrityValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if client exists and matches (OPTIONAL foreign key)
    if (project.clientId) {
      if (!client) {
        errors.push(`Project client (${project.clientId}) does not exist`);
      } else if (project.clientId !== client.id) {
        errors.push(`Project clientId mismatch: expected ${client.id}, got ${project.clientId}`);
      }
    }

    // Check if group exists and matches (OPTIONAL foreign key)
    if (project.groupId) {
      if (!group) {
        errors.push(`Project group (${project.groupId}) does not exist`);
      } else if (project.groupId !== group.id) {
        errors.push(`Project groupId mismatch: expected ${group.id}, got ${project.groupId}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * @deprecated Rows are being phased out in favor of direct group-project relationships
   * 
   * Validate row foreign key reference
   * 
   * @param row - The row to validate
   * @param group - The group it should belong to
   * @returns Validation result
   */
  static validateRowBelongsToGroup(
    row: Row,
    group: Group
  ): IntegrityValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (row.groupId !== group.id) {
      errors.push(`Row ${row.name} does not belong to group ${group.name}`);
    }

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

  /**
   * Find orphaned projects (client/group doesn't exist if specified)
   * 
   * Orphaned projects have a clientId or groupId that doesn't exist.
   * This violates referential integrity.
   * 
   * @param projects - All projects
   * @param clients - All clients
   * @param groups - All groups
   * @returns List of orphaned project IDs
   */
  static findOrphanedProjects(
    projects: Project[],
    clients: Client[],
    groups: Group[]
  ): string[] {
    const clientIds = new Set(clients.map(c => c.id));
    const groupIds = new Set(groups.map(g => g.id));
    
    return projects
      .filter(p => 
        (p.clientId && !clientIds.has(p.clientId)) || // Client specified but doesn't exist
        (p.groupId && !groupIds.has(p.groupId)) // Optional group specified but doesn't exist
      )
      .map(p => p.id);
  }

  /**
   * Find orphaned rows (group doesn't exist)
   * 
   * @deprecated Rows are being phased out
   * 
   * @param rows - All rows
   * @param groups - All groups
   * @returns List of orphaned row IDs
   */
  static findOrphanedRows(
    rows: Row[],
    groups: Group[]
  ): string[] {
    const groupIds = new Set(groups.map(g => g.id));
    return rows
      .filter(r => !groupIds.has(r.groupId))
      .map(r => r.id);
  }

  // ==========================================================================
  // SYSTEM-WIDE INTEGRITY CHECK
  // ==========================================================================
  
  /**
   * Comprehensive system integrity check
   * 
   * Validates all foreign key relationships and constraints across the entire system:
   * - Finds all orphaned entities (broken foreign keys)
   * - Validates budget constraints for all projects
   * - Returns detailed report of issues
   * 
   * @param context - System validation context
   * @returns System integrity check result
   */
  static validateSystemIntegrity(context: {
    projects: Project[];
    phases: PhaseDTO[];
    clients: Client[];
    groups: Group[];
    labels?: Label[];
  }): SystemIntegrityCheck {
    const errors: string[] = [];
    const orphanedEntities: string[] = [];
    const mismatchedEntities: string[] = [];

    // Find orphaned entities (broken foreign keys)
    const orphanedPhases = this.findOrphanedPhases(
      context.phases,
      context.projects
    );
    const orphanedProjects = this.findOrphanedProjects(
      context.projects,
      context.clients,
      context.groups
    );

    if (orphanedPhases.length > 0) {
      errors.push(`Found ${orphanedPhases.length} orphaned phase(s)`);
      orphanedEntities.push(...orphanedPhases.map(id => `phase:${id}`));
    }

    if (orphanedProjects.length > 0) {
      errors.push(`Found ${orphanedProjects.length} orphaned project(s)`);
      orphanedEntities.push(...orphanedProjects.map(id => `project:${id}`));
    }

    // Check project-phase budget constraints
    context.projects.forEach(project => {
      const projectPhases = context.phases.filter(
        phase => phase.projectId === project.id
      );
      
      const budgetValidation = this.validateProjectPhaseBudget(
        projectPhases,
        project
      );
      
      if (!budgetValidation.isValid) {
        errors.push(`Project ${project.name}: ${budgetValidation.errors.join(', ')}`);
        mismatchedEntities.push(`project:${project.id}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      orphanedEntities,
      mismatchedEntities
    };
  }
}

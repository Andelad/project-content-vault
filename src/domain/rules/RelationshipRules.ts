/**
 * Relationship Business Rules
 * 
 * Single source of truth for cross-entity relationships and constraints.
 * Defines how entities relate to each other and enforces relationship integrity.
 * 
 * This is the domain layer - pure business logic with no external dependencies.
 * 
 * @see docs/core/Business Logic.md for complete relationship documentation
 */

import type { Project, PhaseDTO, Group, Row, Client, Label } from '@/types/core';
import { ProjectRules } from './ProjectRules';
import { PhaseRules } from './PhaseRules';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RelationshipValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HierarchyValidation {
  isValid: boolean;
  errors: string[];
  orphanedEntities: string[];
  mismatchedEntities: string[];
}

// ============================================================================
// RELATIONSHIP BUSINESS RULES
// ============================================================================

/**
 * Relationship Business Rules
 * 
 * Centralized location for all cross-entity relationship logic.
 * These rules enforce referential integrity and business constraints between entities.
 */
export class RelationshipRules {
  
  // ==========================================================================
  // PROJECT → MILESTONE RELATIONSHIP
  // ==========================================================================
  
  /**
   * RELATIONSHIP 1: Phase dates must be within project range
   * 
   * Business Logic Reference: Rule 2
   * Formula: project.startDate ≤ phase.endDate ≤ project.endDate
   * 
   * @param milestone - The milestone to validate
   * @param project - The parent project
   * @returns Validation result
   */
  static validateMilestoneBelongsToProject(
    phase: PhaseDTO,
    project: Project
  ): RelationshipValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check project ID matches
    if (phase.projectId !== project.id) {
      errors.push('Milestone does not belong to this project');
      return { isValid: false, errors, warnings };
    }

    // Validate milestone dates are within project range
    const milestoneEndDate = phase.endDate || phase.dueDate;
    const dateValidation = PhaseRules.validateMilestoneDateWithinProject(
      milestoneEndDate,
      project.startDate,
      project.endDate,
      project.continuous
    );
    errors.push(...dateValidation.errors);

    // If milestone has start date, validate it too
    if (phase.startDate) {
      if (phase.startDate < project.startDate) {
        errors.push('Milestone start date cannot be before project start date');
      }
      if (!project.continuous && phase.startDate > project.endDate) {
        errors.push('Milestone start date cannot be after project end date');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * RELATIONSHIP 2: Phase allocation must fit within project budget
   * 
   * Business Logic Reference: Rule 1
   * Formula: SUM(phase.timeAllocationHours) ≤ project.estimatedHours
   * 
   * @param milestones - All project milestones
   * @param project - The parent project
   * @returns Validation result
   */
  static validateProjectMilestoneBudget(
    phases: PhaseDTO[],
    project: Project
  ): RelationshipValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const budgetCheck = PhaseRules.checkBudgetConstraint(
      phases,
      project.estimatedHours
    );

    if (!budgetCheck.isValid) {
      errors.push(
        `Milestone allocations (${budgetCheck.totalAllocated}h) exceed ` +
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
   * Validate all milestones belong to and fit within project constraints
   * 
   * Comprehensive check combining:
   * - All milestones reference correct project ID
   * - All milestone dates within project range
   * - Total allocation within project budget
   * 
   * @param project - The project
   * @param milestones - All project milestones
   * @returns Validation result
   */
  static validateProjectMilestones(
    project: Project,
    phases: PhaseDTO[]
  ): RelationshipValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate each milestone individually
    phases.forEach((phase, index) => {
      const validation = this.validateMilestoneBelongsToProject(phase, project);
      if (!validation.isValid) {
        errors.push(`Milestone ${index + 1} (${phase.name}): ${validation.errors.join(', ')}`);
      }
      warnings.push(...validation.warnings);
    });

    // Validate budget constraint
    const budgetValidation = this.validateProjectMilestoneBudget(phases, project);
    errors.push(...budgetValidation.errors);
    warnings.push(...budgetValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // PROJECT → ROW → GROUP HIERARCHY
  // ==========================================================================
  
  /**
   * RELATIONSHIP 3: Project must belong to valid Client (if specified), and optionally to Group
   * 
   * Business Logic Reference: Entity Relationships (Client → Project optional, Group → Project optional)
   * 
   * @param project - The project to validate
   * @param client - The client it should belong to (undefined if no client)
   * @param group - The group it optionally belongs to
   * @returns Validation result
   */
  static validateProjectRelationships(
    project: Project,
    client: Client | undefined,
    group: Group | undefined
  ): RelationshipValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if client exists and matches (OPTIONAL)
    if (project.clientId) {
      if (!client) {
        errors.push(`Project client (${project.clientId}) does not exist`);
      } else if (project.clientId !== client.id) {
        errors.push(`Project clientId mismatch: expected ${client.id}, got ${project.clientId}`);
      }
    }

    // Check if group exists and matches (OPTIONAL)
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
   * RELATIONSHIP: Row belongs to Group (legacy validation)
   * 
   * @param row - The row to validate
   * @param group - The group it should belong to
   * @returns Validation result
   */
  static validateRowBelongsToGroup(
    row: Row,
    group: Group
  ): RelationshipValidation {
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
  // ORPHAN & INTEGRITY CHECKS
  // ==========================================================================
  
  /**
   * Check for orphaned milestones (project doesn't exist)
   * 
   * @param milestones - All milestones
   * @param projects - All projects
   * @returns List of orphaned milestone IDs
   */
  static findOrphanedMilestones(
    phases: PhaseDTO[],
    projects: Project[]
  ): string[] {
    const projectIds = new Set(projects.map(p => p.id));
    return phases
      .filter(phase => !projectIds.has(phase.projectId))
      .map(phase => phase.id);
  }

  /**
   * Check for orphaned projects (client doesn't exist if specified, or optional group doesn't exist)
   * 
   * @param projects - All projects
   * @param clients - All clients
   * @param groups - All groups (optional check)
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
   * Check for orphaned rows (group doesn't exist)
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

  /**
   * Comprehensive system integrity check
   * 
   * Validates all relationships across the entire system
   * 
   * @param context - System validation context
   * @returns Hierarchy validation result
   */
  static validateSystemIntegrity(context: {
    projects: Project[];
    phases: PhaseDTO[];
    clients: Client[];
    groups: Group[];
    labels?: Label[];
  }): HierarchyValidation {
    const errors: string[] = [];
    const orphanedEntities: string[] = [];
    const mismatchedEntities: string[] = [];

    // Find orphaned entities
    const orphanedMilestones = this.findOrphanedMilestones(
      context.phases,
      context.projects
    );
    const orphanedProjects = this.findOrphanedProjects(
      context.projects,
      context.clients,
      context.groups
    );

    if (orphanedMilestones.length > 0) {
      errors.push(`Found ${orphanedMilestones.length} orphaned milestone(s)`);
      orphanedEntities.push(...orphanedMilestones.map(id => `milestone:${id}`));
    }

    if (orphanedProjects.length > 0) {
      errors.push(`Found ${orphanedProjects.length} orphaned project(s)`);
      orphanedEntities.push(...orphanedProjects.map(id => `project:${id}`));
    }

    // Check project-milestone budget constraints
    context.projects.forEach(project => {
      const projectPhases = context.phases.filter(
        phase => phase.projectId === project.id
      );
      
      const budgetValidation = this.validateProjectMilestoneBudget(
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

  // ==========================================================================
  // CASCADE RULES
  // ==========================================================================
  
  /**
   * Check what would be affected by deleting a project
   * 
   * Business Logic Reference: Cascade Behavior
   * Deleting a project cascades to all its milestones
   * 
   * @param projectId - Project to delete
   * @param milestones - All milestones
   * @returns List of milestone IDs that would be deleted
   */
  static getProjectDeletionImpact(
    projectId: string,
    phases: PhaseDTO[]
  ): string[] {
    return phases
      .filter(phase => phase.projectId === projectId)
      .map(phase => phase.id);
  }

  /**
   * Check what would be affected by deleting a client
   * 
   * Business Logic Reference: Cascade Behavior
   * Deleting a client cascades to all its projects and their milestones
   * 
   * @param clientId - Client to delete
   * @param projects - All projects
   * @param milestones - All milestones
   * @returns Impact summary
   */
  static getClientDeletionImpact(
    clientId: string,
    projects: Project[],
    phases: PhaseDTO[]
  ): {
    projectIds: string[];
    milestoneIds: string[];
  } {
    const affectedProjects = projects.filter(p => p.clientId === clientId);
    const projectIds = affectedProjects.map(p => p.id);
    const milestoneIds = phases
      .filter(phase => projectIds.includes(phase.projectId))
      .map(phase => phase.id);

    return { projectIds, milestoneIds };
  }

  /**
   * Check what would be affected by deleting a group
   * 
   * Business Logic Reference: Cascade Behavior
   * Deleting a group cascades to all its projects and their milestones
   * 
   * @param groupId - Group to delete
   * @param projects - All projects
   * @param milestones - All milestones
   * @returns Impact summary
   */
  static getGroupDeletionImpact(
    groupId: string,
    projects: Project[],
    phases: PhaseDTO[]
  ): {
    projectIds: string[];
    milestoneIds: string[];
  } {
    const affectedProjects = projects.filter(p => p.groupId === groupId);
    const projectIds = affectedProjects.map(p => p.id);
    const milestoneIds = phases
      .filter(phase => projectIds.includes(phase.projectId))
      .map(phase => phase.id);

    return { projectIds, milestoneIds };
  }
}

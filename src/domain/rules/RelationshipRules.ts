/**
 * Relationship Business Rules
 * 
 * Single source of truth for cross-entity relationships and constraints.
 * Defines how entities relate to each other and enforces relationship integrity.
 * 
 * This is the domain layer - pure business logic with no external dependencies.
 * 
 * @see docs/BUSINESS_LOGIC_REFERENCE.md for complete relationship documentation
 */

import type { Project, Milestone, Group, Row } from '@/types/core';
import { ProjectRules } from './ProjectRules';
import { MilestoneRules } from './MilestoneRules';

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
   * RELATIONSHIP 1: Milestone dates must be within project range
   * 
   * Business Logic Reference: Rule 2
   * Formula: project.startDate ≤ milestone.endDate ≤ project.endDate
   * 
   * @param milestone - The milestone to validate
   * @param project - The parent project
   * @returns Validation result
   */
  static validateMilestoneBelongsToProject(
    milestone: Milestone,
    project: Project
  ): RelationshipValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check project ID matches
    if (milestone.projectId !== project.id) {
      errors.push('Milestone does not belong to this project');
      return { isValid: false, errors, warnings };
    }

    // Validate milestone dates are within project range
    const milestoneEndDate = milestone.endDate || milestone.dueDate;
    const dateValidation = MilestoneRules.validateMilestoneDateWithinProject(
      milestoneEndDate,
      project.startDate,
      project.endDate,
      project.continuous
    );
    errors.push(...dateValidation.errors);

    // If milestone has start date, validate it too
    if (milestone.startDate) {
      if (milestone.startDate < project.startDate) {
        errors.push('Milestone start date cannot be before project start date');
      }
      if (!project.continuous && milestone.startDate > project.endDate) {
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
   * RELATIONSHIP 2: Milestone allocation must fit within project budget
   * 
   * Business Logic Reference: Rule 1
   * Formula: SUM(milestone.timeAllocationHours) ≤ project.estimatedHours
   * 
   * @param milestones - All project milestones
   * @param project - The parent project
   * @returns Validation result
   */
  static validateProjectMilestoneBudget(
    milestones: Milestone[],
    project: Project
  ): RelationshipValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const budgetCheck = MilestoneRules.checkBudgetConstraint(
      milestones,
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
    milestones: Milestone[]
  ): RelationshipValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate each milestone individually
    milestones.forEach((milestone, index) => {
      const validation = this.validateMilestoneBelongsToProject(milestone, project);
      if (!validation.isValid) {
        errors.push(`Milestone ${index + 1} (${milestone.name}): ${validation.errors.join(', ')}`);
      }
      warnings.push(...validation.warnings);
    });

    // Validate budget constraint
    const budgetValidation = this.validateProjectMilestoneBudget(milestones, project);
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
   * RELATIONSHIP 3: Project must belong to valid Row and Group
   * 
   * Business Logic Reference: Entity Relationships (Group → Row → Project)
   * 
   * @param project - The project to validate
   * @param row - The row it should belong to
   * @param group - The group it should belong to
   * @returns Validation result
   */
  static validateProjectHierarchy(
    project: Project,
    row: Row | undefined,
    group: Group | undefined
  ): RelationshipValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if row exists and matches
    if (!row) {
      errors.push(`Project row (${project.rowId}) does not exist`);
    } else if (project.rowId !== row.id) {
      errors.push(`Project rowId mismatch: expected ${row.id}, got ${project.rowId}`);
    }

    // Check if group exists and matches
    if (!group) {
      errors.push(`Project group (${project.groupId}) does not exist`);
    } else if (project.groupId !== group.id) {
      errors.push(`Project groupId mismatch: expected ${group.id}, got ${project.groupId}`);
    }

    // Check if row belongs to the correct group
    if (row && group && row.groupId !== group.id) {
      errors.push(
        `Row ${row.id} does not belong to group ${group.id} ` +
        `(row belongs to ${row.groupId})`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate row belongs to group
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
    milestones: Milestone[],
    projects: Project[]
  ): string[] {
    const projectIds = new Set(projects.map(p => p.id));
    return milestones
      .filter(m => !projectIds.has(m.projectId))
      .map(m => m.id);
  }

  /**
   * Check for orphaned projects (row or group doesn't exist)
   * 
   * @param projects - All projects
   * @param rows - All rows
   * @param groups - All groups
   * @returns List of orphaned project IDs
   */
  static findOrphanedProjects(
    projects: Project[],
    rows: Row[],
    groups: Group[]
  ): string[] {
    const rowIds = new Set(rows.map(r => r.id));
    const groupIds = new Set(groups.map(g => g.id));
    
    return projects
      .filter(p => !rowIds.has(p.rowId) || !groupIds.has(p.groupId))
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
    milestones: Milestone[];
    rows: Row[];
    groups: Group[];
  }): HierarchyValidation {
    const errors: string[] = [];
    const orphanedEntities: string[] = [];
    const mismatchedEntities: string[] = [];

    // Find orphaned entities
    const orphanedMilestones = this.findOrphanedMilestones(
      context.milestones,
      context.projects
    );
    const orphanedProjects = this.findOrphanedProjects(
      context.projects,
      context.rows,
      context.groups
    );
    const orphanedRows = this.findOrphanedRows(
      context.rows,
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

    if (orphanedRows.length > 0) {
      errors.push(`Found ${orphanedRows.length} orphaned row(s)`);
      orphanedEntities.push(...orphanedRows.map(id => `row:${id}`));
    }

    // Check project-milestone budget constraints
    context.projects.forEach(project => {
      const projectMilestones = context.milestones.filter(
        m => m.projectId === project.id
      );
      
      const budgetValidation = this.validateProjectMilestoneBudget(
        projectMilestones,
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
    milestones: Milestone[]
  ): string[] {
    return milestones
      .filter(m => m.projectId === projectId)
      .map(m => m.id);
  }

  /**
   * Check what would be affected by deleting a row
   * 
   * Business Logic Reference: Cascade Behavior
   * Deleting a row cascades to all its projects and their milestones
   * 
   * @param rowId - Row to delete
   * @param projects - All projects
   * @param milestones - All milestones
   * @returns Impact summary
   */
  static getRowDeletionImpact(
    rowId: string,
    projects: Project[],
    milestones: Milestone[]
  ): {
    projectIds: string[];
    milestoneIds: string[];
  } {
    const affectedProjects = projects.filter(p => p.rowId === rowId);
    const projectIds = affectedProjects.map(p => p.id);
    const milestoneIds = milestones
      .filter(m => projectIds.includes(m.projectId))
      .map(m => m.id);

    return { projectIds, milestoneIds };
  }

  /**
   * Check what would be affected by deleting a group
   * 
   * Business Logic Reference: Cascade Behavior
   * Deleting a group cascades to all rows, projects, and milestones
   * 
   * @param groupId - Group to delete
   * @param rows - All rows
   * @param projects - All projects
   * @param milestones - All milestones
   * @returns Impact summary
   */
  static getGroupDeletionImpact(
    groupId: string,
    rows: Row[],
    projects: Project[],
    milestones: Milestone[]
  ): {
    rowIds: string[];
    projectIds: string[];
    milestoneIds: string[];
  } {
    const affectedRows = rows.filter(r => r.groupId === groupId);
    const rowIds = affectedRows.map(r => r.id);
    const affectedProjects = projects.filter(p => p.groupId === groupId);
    const projectIds = affectedProjects.map(p => p.id);
    const milestoneIds = milestones
      .filter(m => projectIds.includes(m.projectId))
      .map(m => m.id);

    return { rowIds, projectIds, milestoneIds };
  }
}

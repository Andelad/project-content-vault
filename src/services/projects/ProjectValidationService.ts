/**
 * Project Validation Service
 * Handles project data validation, integrity checks, and auto-correction logic
 */

import { Project, Group, Row } from '../../types';

export interface OrphanedProject {
  id: string;
  name: string;
  rowId?: string;
  groupId?: string;
}

export interface MismatchedProject extends OrphanedProject {
  expectedRowId?: string;
  expectedGroupId?: string;
}

export interface ValidationResult {
  orphanedProjects: OrphanedProject[];
  mismatchedProjects: MismatchedProject[];
  totalIssues: number;
  isValid: boolean;
}

/**
 * Service for validating and auto-correcting project data integrity
 */
export class ProjectValidationService {
  /**
   * Validates project relationships and identifies integrity issues
   */
  static validateProjectRelationships(
    projects: Project[],
    groups: Group[],
    rows: Row[]
  ): ValidationResult {
    const orphanedProjects = this.findOrphanedProjects(projects);
    const mismatchedProjects = this.findMismatchedProjects(projects, rows);

    return {
      orphanedProjects,
      mismatchedProjects,
      totalIssues: orphanedProjects.length + mismatchedProjects.length,
      isValid: orphanedProjects.length === 0 && mismatchedProjects.length === 0
    };
  }

  /**
   * Finds projects that are missing required rowId or groupId
   */
  static findOrphanedProjects(projects: Project[]): OrphanedProject[] {
    return projects
      .filter(p => !p.rowId || !p.groupId)
      .map(p => ({
        id: p.id,
        name: p.name,
        rowId: p.rowId,
        groupId: p.groupId
      }));
  }

  /**
   * Finds projects that have rowId/groupId but don't match existing rows
   */
  static findMismatchedProjects(projects: Project[], rows: Row[]): MismatchedProject[] {
    return projects
      .filter(p => {
        if (!p.rowId || !p.groupId) return false;
        const matchingRow = rows.find(r => r.id === p.rowId && r.groupId === p.groupId);
        return !matchingRow;
      })
      .map(p => ({
        id: p.id,
        name: p.name,
        rowId: p.rowId,
        groupId: p.groupId
      }));
  }

  /**
   * Auto-fixes orphaned projects by assigning them to appropriate groups and rows
   */
  static autoFixOrphanedProjects(
    projects: Project[],
    groups: Group[],
    rows: Row[],
    updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void
  ): { fixed: number; skipped: number } {
    const orphanedProjects = this.findOrphanedProjects(projects);

    if (orphanedProjects.length === 0 || groups.length === 0 || rows.length === 0) {
      return { fixed: 0, skipped: orphanedProjects.length };
    }

    let fixed = 0;
    let skipped = 0;

    orphanedProjects.forEach(project => {
      const result = this.fixSingleOrphanedProject(project, groups, rows, updateProject);
      if (result.fixed) {
        fixed++;
      } else {
        skipped++;
      }
    });
    return { fixed, skipped };
  }

  /**
   * Fixes a single orphaned project
   */
  private static fixSingleOrphanedProject(
    project: OrphanedProject,
    groups: Group[],
    rows: Row[],
    updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void
  ): { fixed: boolean; reason?: string } {
    try {
      // If project has no groupId, assign to first available group
      const targetGroupId = project.groupId || groups[0].id;

      // Find first row in this group
      const groupRows = rows.filter(r => r.groupId === targetGroupId);
      const targetRowId = project.rowId || (groupRows.length > 0 ? groupRows[0].id : null);

      if (!targetRowId) {
        console.warn(`⚠️ Cannot fix project ${project.name}: no available rows in group ${targetGroupId}`);
        return { fixed: false, reason: 'No available rows in target group' };
      }

      if (targetRowId && (!project.rowId || !project.groupId)) {
        updateProject(project.id, {
          groupId: targetGroupId,
          rowId: targetRowId
        }, { silent: true });

        return { fixed: true };
      }

      return { fixed: false, reason: 'Project already has valid assignments' };
    } catch (error) {
      console.error(`❌ Error fixing project ${project.name}:`, error);
      return { fixed: false, reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Logs validation results for debugging
   */
  static logValidationResults(result: ValidationResult): void {
    if (result.orphanedProjects.length > 0) {
      console.warn('🧒 ORPHANED PROJECTS (missing rowId or groupId):',
        result.orphanedProjects.map(p => ({
          id: p.id,
          name: p.name,
          rowId: p.rowId,
          groupId: p.groupId
        }))
      );
    }

    if (result.mismatchedProjects.length > 0) {
      console.warn('🚨 MISMATCHED PROJECTS (invalid rowId/groupId):',
        result.mismatchedProjects.map(p => ({
          id: p.id,
          name: p.name,
          rowId: p.rowId,
          groupId: p.groupId
        }))
      );
    }

    if (result.isValid) {
      // All projects have valid relationships
    } else {
      console.warn(`⚠️ Found ${result.totalIssues} project relationship issues`);
    }
  }

  /**
   * Comprehensive validation and auto-fix process
   */
  static validateAndAutoFix(
    projects: Project[],
    groups: Group[],
    rows: Row[],
    updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void,
    options: { logResults?: boolean } = {}
  ): ValidationResult & { fixes: { fixed: number; skipped: number } } {
    const validation = this.validateProjectRelationships(projects, groups, rows);

    if (options.logResults !== false) {
      this.logValidationResults(validation);
    }

    const fixes = this.autoFixOrphanedProjects(projects, groups, rows, updateProject);

    return {
      ...validation,
      fixes
    };
  }
}

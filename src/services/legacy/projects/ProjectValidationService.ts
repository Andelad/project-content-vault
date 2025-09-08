/**
 * @deprecated Legacy ProjectValidationService
 * 
 * This service has been migrated to the unified architecture.
 * All functionality is now available through:
 * - ProjectValidator (validators/ProjectValidator.ts)
 * 
 * This wrapper maintains backward compatibility but should be replaced
 * with direct calls to the new service.
 * 
 * Migration completed: Added relationship validation methods to existing ProjectValidator
 * Breaking changes: None - all methods maintain the same signatures
 */

import { ProjectValidator } from '../../validators/ProjectValidator.js';
import type { Project, Group, Row } from '../../../types/core.js';

console.warn('⚠️  ProjectValidationService is deprecated. Use ProjectValidator instead.');

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

export class ProjectValidationService {
  /**
   * @deprecated Use ProjectValidator.validateProjectRelationships()
   */
  static validateProjectRelationships(
    projects: Project[],
    groups: Group[],
    rows: Row[]
  ): ValidationResult {
    console.warn('⚠️  ProjectValidationService.validateProjectRelationships() is deprecated. Use ProjectValidator.validateProjectRelationships() instead.');
    return ProjectValidator.validateProjectRelationships(projects, groups, rows);
  }

  /**
   * @deprecated Use ProjectValidator.findOrphanedProjects()
   */
  static findOrphanedProjects(projects: Project[]): OrphanedProject[] {
    console.warn('⚠️  ProjectValidationService.findOrphanedProjects() is deprecated. Use ProjectValidator.findOrphanedProjects() instead.');
    return ProjectValidator.findOrphanedProjects(projects);
  }

  /**
   * @deprecated Use ProjectValidator.findMismatchedProjects()
   */
  static findMismatchedProjects(projects: Project[], rows: Row[]): MismatchedProject[] {
    console.warn('⚠️  ProjectValidationService.findMismatchedProjects() is deprecated. Use ProjectValidator.findMismatchedProjects() instead.');
    return ProjectValidator.findMismatchedProjects(projects, rows);
  }

  /**
   * @deprecated Use ProjectValidator.autoFixOrphanedProjects()
   */
  static autoFixOrphanedProjects(
    projects: Project[],
    groups: Group[],
    rows: Row[],
    updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void
  ): { fixed: number; skipped: number } {
    console.warn('⚠️  ProjectValidationService.autoFixOrphanedProjects() is deprecated. Use ProjectValidator.autoFixOrphanedProjects() instead.');
    return ProjectValidator.autoFixOrphanedProjects(projects, groups, rows, updateProject);
  }

  /**
   * @deprecated Use ProjectValidator.logValidationResults()
   */
  static logValidationResults(result: ValidationResult): void {
    console.warn('⚠️  ProjectValidationService.logValidationResults() is deprecated. Use ProjectValidator.logValidationResults() instead.');
    return ProjectValidator.logValidationResults(result);
  }

  /**
   * @deprecated Use ProjectValidator.validateAndAutoFix()
   */
  static validateAndAutoFix(
    projects: Project[],
    groups: Group[],
    rows: Row[],
    updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void,
    options: { logResults?: boolean } = {}
  ): ValidationResult & { fixes: { fixed: number; skipped: number } } {
    console.warn('⚠️  ProjectValidationService.validateAndAutoFix() is deprecated. Use ProjectValidator.validateAndAutoFix() instead.');
    return ProjectValidator.validateAndAutoFix(projects, groups, rows, updateProject, options);
  }
}

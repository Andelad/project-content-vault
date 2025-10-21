/**
 * Project Data Integrity Utilities
 * 
 * Lightweight utilities for validating and auto-fixing project relationships
 * with groups and rows. Extracted from ProjectValidator to keep only what's used.
 */

import type { Project, Group, Row } from '@/types/core';

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
 * Validates project relationships and identifies integrity issues
 */
export function validateProjectRelationships(
  projects: Project[],
  groups: Group[],
  rows: Row[]
): ValidationResult {
  const orphanedProjects = findOrphanedProjects(projects);
  const mismatchedProjects = findMismatchedProjects(projects, rows);

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
export function findOrphanedProjects(projects: Project[]): OrphanedProject[] {
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
export function findMismatchedProjects(projects: Project[], rows: Row[]): MismatchedProject[] {
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
export function autoFixOrphanedProjects(
  projects: Project[],
  groups: Group[],
  rows: Row[],
  updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void
): { fixed: number; skipped: number } {
  const orphanedProjects = findOrphanedProjects(projects);
  
  if (orphanedProjects.length === 0) {
    return { fixed: 0, skipped: 0 };
  }

  let fixed = 0;
  let skipped = 0;

  orphanedProjects.forEach(orphanedProject => {
    // Find first available group and row
    const targetGroup = groups[0];
    if (!targetGroup) {
      skipped++;
      console.warn(`⚠️ Cannot fix orphaned project "${orphanedProject.name}" - no groups available`);
      return;
    }

    const targetRow = rows.find(r => r.groupId === targetGroup.id);
    if (!targetRow) {
      skipped++;
      console.warn(`⚠️ Cannot fix orphaned project "${orphanedProject.name}" - no rows in group "${targetGroup.name}"`);
      return;
    }

    // Auto-fix by assigning to first available group/row
    updateProject(orphanedProject.id, {
      groupId: targetGroup.id,
      rowId: targetRow.id
    }, { silent: true });

    fixed++;
    console.log(`✅ Auto-fixed orphaned project "${orphanedProject.name}" → ${targetGroup.name} / ${targetRow.name}`);
  });

  return { fixed, skipped };
}

/**
 * Logs validation results to console
 */
export function logValidationResults(result: ValidationResult): void {
  if (result.isValid) {
    return; // Silent when no issues
  }

  if (result.orphanedProjects.length > 0) {
    console.warn(`⚠️ Found ${result.orphanedProjects.length} orphaned projects (missing groupId or rowId):`, 
      result.orphanedProjects.map(p => p.name));
  }

  if (result.mismatchedProjects.length > 0) {
    console.warn(`⚠️ Found ${result.mismatchedProjects.length} mismatched projects (groupId/rowId don't match existing rows):`, 
      result.mismatchedProjects.map(p => p.name));
  }
}

/**
 * Comprehensive validation and auto-fix process
 */
export function validateAndAutoFix(
  projects: Project[],
  groups: Group[],
  rows: Row[],
  updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void,
  options: { logResults?: boolean } = {}
): ValidationResult & { fixes: { fixed: number; skipped: number } } {
  const validation = validateProjectRelationships(projects, groups, rows);

  if (options.logResults !== false) {
    logValidationResults(validation);
  }

  const fixes = autoFixOrphanedProjects(projects, groups, rows, updateProject);

  return {
    ...validation,
    fixes
  };
}

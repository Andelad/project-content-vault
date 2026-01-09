/**
 * Project Integrity Rules
 * 
 * KEYWORDS: project validation, foreign key, client reference, group reference, orphan detection
 * 
 * Validates referential integrity for projects:
 * - Project → Client foreign key (optional)
 * - Project → Group foreign key (optional)
 * - Orphaned project detection (references non-existent client/group)
 * 
 * Part of entity-specific integrity rules:
 * - domain/rules/projects/ProjectIntegrity.ts (THIS FILE)
 * - domain/rules/phases/PhaseIntegrity.ts (phase-project relationships)
 * - domain/rules/clients/ClientIntegrity.ts (client validation)
 * - domain/rules/groups/GroupIntegrity.ts (group validation)
 * 
 * Created: 2026-01-08 (extracted from integrity/EntityIntegrity.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { Project, Client, Group, Row } from '@/shared/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface IntegrityValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// PROJECT INTEGRITY RULES
// ============================================================================

/**
 * Project Integrity Rules
 * 
 * Validates that projects reference clients/groups correctly and maintain
 * referential integrity.
 */
export class ProjectIntegrity {
  
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
}

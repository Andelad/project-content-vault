/**
 * System Integrity Rules
 * 
 * KEYWORDS: system validation, referential integrity, orphan detection, cross-entity validation
 * 
 * Provides system-wide integrity checks by composing entity-specific integrity rules.
 * 
 * This is the main entry point for validating the entire system's referential integrity.
 * It delegates to entity-specific integrity modules for detailed validation.
 * 
 * Architecture:
 * - SystemIntegrity (THIS FILE) - Orchestrates entity-specific integrity checks
 * - PhaseIntegrity - Phase → Project validation
 * - ProjectIntegrity - Project → Client/Group validation
 * 
 * Created: 2026-01-08 (replaces integrity/EntityIntegrity.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { Project, PhaseDTO, Client, Group, Label } from '@/shared/types/core';
import { PhaseIntegrity } from './phases/PhaseIntegrity';
import { ProjectIntegrity } from './projects/ProjectIntegrity';

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
// SYSTEM INTEGRITY RULES
// ============================================================================

/**
 * System Integrity Rules
 * 
 * Validates referential integrity across the entire system by composing
 * entity-specific integrity checks.
 */
export class SystemIntegrity {
  
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
    const orphanedPhases = PhaseIntegrity.findOrphanedPhases(
      context.phases,
      context.projects
    );
    const orphanedProjects = ProjectIntegrity.findOrphanedProjects(
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
      
      const budgetValidation = PhaseIntegrity.validateProjectPhaseBudget(
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

// Re-export entity-specific integrity classes for convenience
export { PhaseIntegrity } from './phases/PhaseIntegrity';
export { ProjectIntegrity } from './projects/ProjectIntegrity';

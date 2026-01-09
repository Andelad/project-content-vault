/**
 * Project Deletion Impact Analysis
 * 
 * KEYWORDS: delete project, cascade deletion, impact preview, phase deletion
 * 
 * Analyzes cascade effects when deleting a project:
 * - Lists all phases that will be deleted
 * - Provides deletion preview before confirmation
 * 
 * CASCADE RULE: Deleting a project cascades to all its phases
 * 
 * Part of entity-specific deletion impact rules:
 * - domain/rules/projects/ProjectDeletionImpact.ts (THIS FILE)
 * - domain/rules/clients/ClientDeletionImpact.ts (client cascade)
 * - domain/rules/groups/GroupDeletionImpact.ts (group cascade)
 * 
 * Created: 2026-01-08 (extracted from cascade/DeletionImpact.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { PhaseDTO } from '@/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProjectDeletionImpactResult {
  phaseIds: string[];
  phaseCount: number;
}

// ============================================================================
// PROJECT DELETION IMPACT
// ============================================================================

/**
 * Project Deletion Impact Analysis
 * 
 * Calculates what will be deleted when deleting a project.
 * Uses database cascade rules to determine affected entities.
 */
export class ProjectDeletionImpact {
  
  /**
   * Analyze impact of deleting a project
   * 
   * CASCADE RULE: Deleting a project cascades to all its phases
   * 
   * @param projectId - Project to delete
   * @param phases - All phases
   * @returns List of phase IDs that would be deleted
   */
  static analyzeProjectDeletion(
    projectId: string,
    phases: PhaseDTO[]
  ): ProjectDeletionImpactResult {
    const affectedPhases = phases.filter(phase => phase.projectId === projectId);
    
    return {
      phaseIds: affectedPhases.map(p => p.id),
      phaseCount: affectedPhases.length
    };
  }

  /**
   * Get phase IDs that would be deleted with project
   * 
   * @param projectId - Project to delete
   * @param phases - All phases
   * @returns List of phase IDs
   */
  static getProjectPhaseIds(
    projectId: string,
    phases: PhaseDTO[]
  ): string[] {
    return phases
      .filter(phase => phase.projectId === projectId)
      .map(phase => phase.id);
  }

  /**
   * Check if deletion would affect any entities
   * 
   * @param impact - Deletion impact
   * @returns True if deletion has cascade effects
   */
  static hasCascadeEffects(
    impact: ProjectDeletionImpactResult
  ): boolean {
    return impact.phaseCount > 0;
  }

  /**
   * Format deletion impact as user-friendly message
   * 
   * @param impact - Deletion impact
   * @returns Human-readable summary
   */
  static formatImpactMessage(
    impact: ProjectDeletionImpactResult
  ): string {
    if (impact.phaseCount === 0) {
      return 'No phases will be deleted.';
    }
    return `${impact.phaseCount} phase(s) will be deleted.`;
  }
}

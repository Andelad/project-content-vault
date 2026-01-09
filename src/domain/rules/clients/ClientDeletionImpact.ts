/**
 * Client Deletion Impact Analysis
 * 
 * KEYWORDS: delete client, cascade deletion, impact preview, project deletion, phase deletion
 * 
 * Analyzes cascade effects when deleting a client:
 * - Lists all projects that will be deleted
 * - Lists all phases that will be deleted (cascaded from projects)
 * - Provides deletion preview before confirmation
 * 
 * CASCADE RULE: Deleting a client cascades to:
 * 1. All projects with this clientId
 * 2. All phases belonging to those projects
 * 
 * Part of entity-specific deletion impact rules:
 * - domain/rules/clients/ClientDeletionImpact.ts (THIS FILE)
 * - domain/rules/projects/ProjectDeletionImpact.ts (project cascade)
 * - domain/rules/groups/GroupDeletionImpact.ts (group cascade)
 * 
 * Created: 2026-01-08 (extracted from cascade/DeletionImpact.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { Project, PhaseDTO } from '@/shared/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ClientDeletionImpactResult {
  projectIds: string[];
  projectCount: number;
  phaseIds: string[];
  phaseCount: number;
}

// ============================================================================
// CLIENT DELETION IMPACT
// ============================================================================

/**
 * Client Deletion Impact Analysis
 * 
 * Calculates what will be deleted when deleting a client.
 * Uses database cascade rules to determine affected entities.
 */
export class ClientDeletionImpact {
  
  /**
   * Analyze impact of deleting a client
   * 
   * CASCADE RULE: Deleting a client cascades to:
   * 1. All projects with this clientId
   * 2. All phases belonging to those projects
   * 
   * @param clientId - Client to delete
   * @param projects - All projects
   * @param phases - All phases
   * @returns Detailed impact summary
   */
  static analyzeClientDeletion(
    clientId: string,
    projects: Project[],
    phases: PhaseDTO[]
  ): ClientDeletionImpactResult {
    // Find affected projects
    const affectedProjects = projects.filter(p => p.clientId === clientId);
    const projectIds = affectedProjects.map(p => p.id);
    
    // Find affected phases (cascade from projects)
    const affectedPhases = phases.filter(phase => 
      projectIds.includes(phase.projectId)
    );
    
    return {
      projectIds,
      projectCount: affectedProjects.length,
      phaseIds: affectedPhases.map(p => p.id),
      phaseCount: affectedPhases.length
    };
  }

  /**
   * Get IDs of entities affected by client deletion
   * 
   * @param clientId - Client to delete
   * @param projects - All projects
   * @param phases - All phases
   * @returns Object with projectIds and phaseIds arrays
   */
  static getClientAffectedIds(
    clientId: string,
    projects: Project[],
    phases: PhaseDTO[]
  ): {
    projectIds: string[];
    phaseIds: string[];
  } {
    const affectedProjects = projects.filter(p => p.clientId === clientId);
    const projectIds = affectedProjects.map(p => p.id);
    const phaseIds = phases
      .filter(phase => projectIds.includes(phase.projectId))
      .map(phase => phase.id);

    return { projectIds, phaseIds };
  }

  /**
   * Get total count of entities affected by deletion
   * 
   * @param impact - Deletion impact
   * @returns Total count of affected entities
   */
  static getTotalAffectedCount(
    impact: ClientDeletionImpactResult
  ): number {
    return impact.projectCount + impact.phaseCount;
  }

  /**
   * Check if deletion would affect any entities
   * 
   * @param impact - Deletion impact
   * @returns True if deletion has cascade effects
   */
  static hasCascadeEffects(
    impact: ClientDeletionImpactResult
  ): boolean {
    return impact.projectCount > 0 || impact.phaseCount > 0;
  }

  /**
   * Format deletion impact as user-friendly message
   * 
   * @param impact - Deletion impact
   * @returns Human-readable summary
   */
  static formatImpactMessage(
    impact: ClientDeletionImpactResult
  ): string {
    const parts: string[] = [];
    
    if (impact.projectCount > 0) {
      parts.push(`${impact.projectCount} project(s)`);
    }
    if (impact.phaseCount > 0) {
      parts.push(`${impact.phaseCount} phase(s)`);
    }
    
    if (parts.length === 0) {
      return 'No entities will be deleted.';
    }
    
    return `${parts.join(' and ')} will be deleted.`;
  }
}

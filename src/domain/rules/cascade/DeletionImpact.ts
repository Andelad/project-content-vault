/**
 * Deletion Impact Analysis
 * 
 * Analyzes cascade effects of deletion operations:
 * - What entities will be deleted if I delete X?
 * - How many dependent entities are affected?
 * - Impact preview before committing deletion
 * 
 * This helps users understand consequences before deleting entities.
 * 
 * Part of three-layer architecture:
 * - domain/rules/integrity/EntityIntegrity.ts (referential integrity)
 * - domain/rules/cascade/DeletionImpact.ts (THIS FILE - cascade analysis)
 * 
 * Created: 2026-01-07 (split from RelationshipRules.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { Project, PhaseDTO, Group, Client } from '@/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProjectDeletionImpact {
  phaseIds: string[];
  phaseCount: number;
}

export interface ClientDeletionImpact {
  projectIds: string[];
  projectCount: number;
  phaseIds: string[];
  phaseCount: number;
}

export interface GroupDeletionImpact {
  projectIds: string[];
  projectCount: number;
  phaseIds: string[];
  phaseCount: number;
}

// ============================================================================
// DELETION CASCADE ANALYSIS
// ============================================================================

/**
 * Deletion Impact Analysis
 * 
 * Calculates what will be deleted when deleting an entity.
 * Uses database cascade rules to determine affected entities.
 */
export class DeletionImpact {
  
  // ==========================================================================
  // PROJECT DELETION
  // ==========================================================================
  
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
  ): ProjectDeletionImpact {
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

  // ==========================================================================
  // CLIENT DELETION
  // ==========================================================================
  
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
  ): ClientDeletionImpact {
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

  // ==========================================================================
  // GROUP DELETION
  // ==========================================================================
  
  /**
   * Analyze impact of deleting a group
   * 
   * CASCADE RULE: Deleting a group cascades to:
   * 1. All projects with this groupId
   * 2. All phases belonging to those projects
   * 
   * Note: Groups are optional on projects, so only projects
   * that explicitly have this groupId are affected.
   * 
   * @param groupId - Group to delete
   * @param projects - All projects
   * @param phases - All phases
   * @returns Detailed impact summary
   */
  static analyzeGroupDeletion(
    groupId: string,
    projects: Project[],
    phases: PhaseDTO[]
  ): GroupDeletionImpact {
    // Find affected projects
    const affectedProjects = projects.filter(p => p.groupId === groupId);
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
   * Get IDs of entities affected by group deletion
   * 
   * @param groupId - Group to delete
   * @param projects - All projects
   * @param phases - All phases
   * @returns Object with projectIds and phaseIds arrays
   */
  static getGroupAffectedIds(
    groupId: string,
    projects: Project[],
    phases: PhaseDTO[]
  ): {
    projectIds: string[];
    phaseIds: string[];
  } {
    const affectedProjects = projects.filter(p => p.groupId === groupId);
    const projectIds = affectedProjects.map(p => p.id);
    const phaseIds = phases
      .filter(phase => projectIds.includes(phase.projectId))
      .map(phase => phase.id);

    return { projectIds, phaseIds };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Get total count of entities affected by deletion
   * 
   * @param impact - Deletion impact (client or group)
   * @returns Total count of affected entities
   */
  static getTotalAffectedCount(
    impact: ClientDeletionImpact | GroupDeletionImpact
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
    impact: ClientDeletionImpact | GroupDeletionImpact | ProjectDeletionImpact
  ): boolean {
    if ('projectCount' in impact && 'phaseCount' in impact) {
      return impact.projectCount > 0 || impact.phaseCount > 0;
    }
    return impact.phaseCount > 0;
  }

  /**
   * Format deletion impact as user-friendly message
   * 
   * @param entityType - Type of entity being deleted
   * @param impact - Deletion impact
   * @returns Human-readable summary
   */
  static formatImpactMessage(
    entityType: 'project' | 'client' | 'group',
    impact: ClientDeletionImpact | GroupDeletionImpact | ProjectDeletionImpact
  ): string {
    if (entityType === 'project') {
      const projectImpact = impact as ProjectDeletionImpact;
      if (projectImpact.phaseCount === 0) {
        return 'No phases will be deleted.';
      }
      return `${projectImpact.phaseCount} phase(s) will be deleted.`;
    }
    
    if (entityType === 'client' || entityType === 'group') {
      const fullImpact = impact as ClientDeletionImpact | GroupDeletionImpact;
      const parts: string[] = [];
      
      if (fullImpact.projectCount > 0) {
        parts.push(`${fullImpact.projectCount} project(s)`);
      }
      if (fullImpact.phaseCount > 0) {
        parts.push(`${fullImpact.phaseCount} phase(s)`);
      }
      
      if (parts.length === 0) {
        return 'No entities will be deleted.';
      }
      
      return `${parts.join(' and ')} will be deleted.`;
    }
    
    return '';
  }
}

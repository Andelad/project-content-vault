/**
 * Group Orchestrator
 * 
 * Extracts complex group management workflows from UI components and coordinates
 * with domain services for group lifecycle management.
 * 
 * ✅ Orchestrates group CRUD operations
 * ✅ Validates group business rules
 * ✅ Coordinates group-project relationships
 * ✅ Handles group state management
 */

import { Group } from '@/types/core';

export interface GroupCreationRequest {
  name: string;
  description?: string;
  color: string;
}

export interface GroupUpdateRequest {
  id: string;
  name?: string;
  description?: string;
  color?: string;
}

export interface GroupOperationResult {
  success: boolean;
  group?: Group;
  errors?: string[];
  warnings?: string[];
}

export interface GroupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Group Orchestrator
 * Handles group business workflows and coordination
 */
export class GroupOrchestrator {

  /**
   * Validate group creation
   */
  static validateGroupCreation(request: GroupCreationRequest): GroupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Business rule: Validate name requirements
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Group name is required');
    }

    if (request.name && request.name.trim().length > 100) {
      errors.push('Group name cannot exceed 100 characters');
    }

    // Business rule: Validate color format
    if (!request.color) {
      errors.push('Group color is required');
    } else if (!/^#[0-9A-F]{6}$/i.test(request.color)) {
      errors.push('Group color must be a valid hex color');
    }

    // Business rule: Validate description length
    if (request.description && request.description.length > 500) {
      warnings.push('Group description is very long (>500 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate group updates
   */
  static validateGroupUpdate(
    request: GroupUpdateRequest,
    currentGroup: Group
  ): GroupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate ID
    if (!request.id || request.id.trim().length === 0) {
      errors.push('Group ID is required for updates');
    }

    // Validate name if provided
    if (request.name !== undefined) {
      if (!request.name || request.name.trim().length === 0) {
        errors.push('Group name cannot be empty');
      } else if (request.name.trim().length > 100) {
        errors.push('Group name cannot exceed 100 characters');
      }
    }

    // Validate color if provided
    if (request.color !== undefined) {
      if (!request.color) {
        errors.push('Group color cannot be empty');
      } else if (!/^#[0-9A-F]{6}$/i.test(request.color)) {
        errors.push('Group color must be a valid hex color');
      }
    }

    // Validate description if provided
    if (request.description !== undefined && request.description && request.description.length > 500) {
      warnings.push('Group description is very long (>500 characters)');
    }

    // Business rule: Prevent modification of system groups
    if (currentGroup.id === 'work-group' || currentGroup.id === 'home-group') {
      if (request.name && request.name !== currentGroup.name) {
        warnings.push('Modifying system group names may affect default workflows');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Prepare group for creation (business logic preparation)
   */
  static prepareGroupForCreation(request: GroupCreationRequest): GroupCreationRequest {
    return {
      name: request.name.trim(),
      description: request.description?.trim() || '',
      color: request.color.toUpperCase()
    };
  }

  /**
   * Prepare group for update (business logic preparation)
   */
  static prepareGroupForUpdate(request: GroupUpdateRequest): GroupUpdateRequest {
    const prepared: GroupUpdateRequest = {
      id: request.id
    };

    if (request.name !== undefined) {
      prepared.name = request.name.trim();
    }

    if (request.description !== undefined) {
      prepared.description = request.description.trim();
    }

    if (request.color !== undefined) {
      prepared.color = request.color.toUpperCase();
    }

    return prepared;
  }

  /**
   * Execute complete group creation workflow
   * EXTRACTED from ProjectsView handleSaveGroup complex logic
   * 
   * Handles:
   * - Validation and preparation
   * - Group creation via context
   * - Error handling and coordination
   */
  static async executeGroupCreationWorkflow(
    request: GroupCreationRequest,
    context: {
      addGroup: (data: any) => Promise<Group>;
    }
  ): Promise<GroupOperationResult> {
    try {
      // Step 1: Validate inputs
      const validation = this.validateGroupCreation(request);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Step 2: Prepare group data following AI Development Rules
      const preparedGroup = this.prepareGroupForCreation(request);

      // Step 3: Create group via context (delegates to existing group creation logic)
      const createdGroup = await context.addGroup(preparedGroup);

      if (!createdGroup) {
        return {
          success: false,
          errors: ['Group creation failed - no group returned']
        };
      }

      return {
        success: true,
        group: createdGroup,
        warnings: validation.warnings
      };

    } catch (error) {
      console.error('Group creation workflow error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Group creation failed']
      };
    }
  }

  /**
   * Execute complete group update workflow
   * EXTRACTED from ProjectsView handleSaveGroup complex logic
   * 
   * Handles:
   * - Validation and preparation
   * - Group update via context
   * - Error handling and coordination
   */
  static async executeGroupUpdateWorkflow(
    request: GroupUpdateRequest,
    currentGroup: Group,
    context: {
      updateGroup: (id: string, data: any) => Promise<Group>;
    }
  ): Promise<GroupOperationResult> {
    try {
      // Step 1: Validate inputs
      const validation = this.validateGroupUpdate(request, currentGroup);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Step 2: Prepare group data following AI Development Rules
      const preparedUpdate = this.prepareGroupForUpdate(request);

      // Step 3: Update group via context (delegates to existing group update logic)
      const updatedGroup = await context.updateGroup(preparedUpdate.id, {
        ...(preparedUpdate.name !== undefined && { name: preparedUpdate.name }),
        ...(preparedUpdate.description !== undefined && { description: preparedUpdate.description }),
        ...(preparedUpdate.color !== undefined && { color: preparedUpdate.color })
      });

      if (!updatedGroup) {
        return {
          success: false,
          errors: ['Group update failed - no group returned']
        };
      }

      return {
        success: true,
        group: updatedGroup,
        warnings: validation.warnings
      };

    } catch (error) {
      console.error('Group update workflow error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Group update failed']
      };
    }
  }

  /**
   * Calculate group statistics for dashboard/insights
   */
  static calculateGroupStatistics(
    group: Group,
    projects: any[] = []
  ): {
    projectCount: number;
    totalEstimatedHours: number;
    activeProjectCount: number;
    completedProjectCount: number;
  } {
    const groupProjects = projects.filter(p => p.groupId === group.id);
    const now = new Date();

    const activeProjects = groupProjects.filter(p => {
      const endDate = new Date(p.endDate);
      return endDate >= now;
    });

    const completedProjects = groupProjects.filter(p => {
      const endDate = new Date(p.endDate);
      return endDate < now;
    });

    const totalEstimatedHours = groupProjects.reduce((sum, p) => sum + (p.estimatedHours || 0), 0);

    return {
      projectCount: groupProjects.length,
      totalEstimatedHours,
      activeProjectCount: activeProjects.length,
      completedProjectCount: completedProjects.length
    };
  }

  /**
   * Validate if group can be deleted
   */
  static validateGroupDeletion(
    group: Group,
    projects: any[] = []
  ): GroupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Business rule: Cannot delete system groups
    if (group.id === 'work-group' || group.id === 'home-group') {
      errors.push('System groups cannot be deleted');
    }

    // Business rule: Warn about projects in group
    const groupProjects = projects.filter(p => p.groupId === group.id);
    if (groupProjects.length > 0) {
      warnings.push(`Deleting this group will affect ${groupProjects.length} project(s). They will need to be reassigned to another group.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

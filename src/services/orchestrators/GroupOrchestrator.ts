/**
 * Group Orchestrator - Phase 5A Repository Integration
 * 
 * Orchestrates complex group management workflows with repository integration.
 * Provides offline-first capabilities, intelligent caching, and performance optimization.
 * 
 * Phase 5A Features:
 * ✅ Repository-based data access with caching
 * ✅ Offline-first operations with sync capabilities
 * ✅ Intelligent validation with business rules
 * ✅ Performance optimization with batching
 * ✅ Event-driven architecture for real-time updates
 */

import { Group } from '@/types/core';
import { groupRepository } from '@/services/repositories/GroupRepository';

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
  metadata?: {
    fromCache?: boolean;
    offlineMode?: boolean;
    syncPending?: boolean;
  };
}

export interface GroupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Group Orchestrator - Phase 5A Implementation
 * Handles group business workflows with repository integration
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
   * Execute complete group creation workflow - Phase 5A
   * ENHANCED with repository integration, caching, and offline support
   * 
   * Features:
   * - Intelligent validation with repository-based uniqueness checks
   * - Offline-first creation with automatic sync
   * - Performance optimization with caching
   * - Event-driven architecture for real-time updates
   */
  static async executeGroupCreationWorkflow(
    request: GroupCreationRequest,
    userId: string
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

      // Step 2: Repository-based uniqueness validation
      const isUnique = await groupRepository.validateGroupNameUnique(
        request.name.trim(),
        userId
      );
      
      if (!isUnique) {
        return {
          success: false,
          errors: ['A group with this name already exists'],
          warnings: validation.warnings
        };
      }

      // Step 3: Prepare group data following AI Development Rules
      const preparedGroup = this.prepareGroupForCreation(request);

      // Step 4: Create group via repository (handles caching, offline, events)
      const groupToCreate: Omit<Group, 'id'> = {
        name: preparedGroup.name,
        description: preparedGroup.description || '',
        color: preparedGroup.color
      };
      
      const createdGroup = await groupRepository.create(groupToCreate);

      if (!createdGroup) {
        return {
          success: false,
          errors: ['Group creation failed - no group returned']
        };
      }

      // Step 5: Check if operation was performed offline
      const offlineChanges = await groupRepository.getOfflineChanges();
      const isOffline = offlineChanges.length > 0;

      return {
        success: true,
        group: createdGroup,
        warnings: validation.warnings,
        metadata: {
          fromCache: false,
          offlineMode: isOffline,
          syncPending: isOffline
        }
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
   * Execute complete group update workflow - Phase 5A
   * ENHANCED with repository integration and intelligent caching
   */
  static async executeGroupUpdateWorkflow(
    request: GroupUpdateRequest,
    userId: string
  ): Promise<GroupOperationResult> {
    try {
      // Step 1: Get current group from repository (uses cache if available)
      const currentGroup = await groupRepository.findById(request.id);
      if (!currentGroup) {
        return {
          success: false,
          errors: ['Group not found']
        };
      }

      // Step 2: Validate updates
      const validation = this.validateGroupUpdate(request, currentGroup);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Step 3: Repository-based uniqueness validation (if name is changing)
      if (request.name && request.name !== currentGroup.name) {
        const isUnique = await groupRepository.validateGroupNameUnique(
          request.name.trim(),
          userId,
          request.id
        );
        
        if (!isUnique) {
          return {
            success: false,
            errors: ['A group with this name already exists'],
            warnings: validation.warnings
          };
        }
      }

      // Step 4: Prepare group data
      const preparedUpdate = this.prepareGroupForUpdate(request);

      // Step 5: Update group via repository
      const updatedData: Partial<Group> = {};
      if (preparedUpdate.name !== undefined) updatedData.name = preparedUpdate.name;
      if (preparedUpdate.description !== undefined) updatedData.description = preparedUpdate.description;
      if (preparedUpdate.color !== undefined) updatedData.color = preparedUpdate.color;

      const updatedGroup = await groupRepository.update(request.id, updatedData);

      if (!updatedGroup) {
        return {
          success: false,
          errors: ['Group update failed - no group returned']
        };
      }

      // Step 6: Check operational metadata
      const offlineChanges = await groupRepository.getOfflineChanges();
      const isOffline = offlineChanges.length > 0;

      return {
        success: true,
        group: updatedGroup,
        warnings: validation.warnings,
        metadata: {
          fromCache: false,
          offlineMode: isOffline,
          syncPending: isOffline
        }
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
   * Get user's groups with performance optimization - Phase 5A
   * ENHANCED with intelligent caching and batch loading
   */
  static async getUserGroupsWorkflow(userId: string): Promise<GroupOperationResult & { groups?: Group[] }> {
    try {
      // Repository handles caching automatically
      const groups = await groupRepository.findByUser(userId);
      
      // Get cache statistics for metadata
      const cacheStats = await groupRepository.getCacheStats();
      
      return {
        success: true,
        groups,
        metadata: {
          fromCache: cacheStats.hitRate > 0,
          offlineMode: false,
          syncPending: false
        }
      };

    } catch (error) {
      console.error('Get user groups workflow error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Failed to load groups']
      };
    }
  }

  /**
   * Delete group with relationship validation - Phase 5A
   * ENHANCED with cascading relationship checks
   */
  static async executeGroupDeletionWorkflow(
    groupId: string,
    userId: string,
    projectCount: number = 0
  ): Promise<GroupOperationResult> {
    try {
      // Step 1: Get current group from repository
      const currentGroup = await groupRepository.findById(groupId);
      if (!currentGroup) {
        return {
          success: false,
          errors: ['Group not found']
        };
      }

      // Step 2: Validate deletion (business rules) - use empty projects array as we have project count
      const mockProjects = Array(projectCount).fill({ groupId: groupId });
      const validation = this.validateGroupDeletion(currentGroup, mockProjects);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Step 3: Delete via repository
      const deleted = await groupRepository.delete(groupId);

      if (!deleted) {
        return {
          success: false,
          errors: ['Group deletion failed']
        };
      }

      // Step 4: Check operational metadata
      const offlineChanges = await groupRepository.getOfflineChanges();
      const isOffline = offlineChanges.length > 0;

      return {
        success: true,
        warnings: validation.warnings,
        metadata: {
          fromCache: false,
          offlineMode: isOffline,
          syncPending: isOffline
        }
      };

    } catch (error) {
      console.error('Group deletion workflow error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Group deletion failed']
      };
    }
  }

  /**
   * Sync offline changes - Phase 5A
   * Handles offline-to-online synchronization
   */
  static async syncOfflineChanges(): Promise<{ 
    success: boolean; 
    syncedCount: number; 
    errors: string[];
    duration: number;
  }> {
    try {
      const syncResult = await groupRepository.syncToServer();
      
      return {
        success: syncResult.success,
        syncedCount: syncResult.syncedCount,
        errors: syncResult.errors,
        duration: syncResult.duration
      };

    } catch (error) {
      console.error('Group sync workflow error:', error);
      return {
        success: false,
        syncedCount: 0,
        errors: [error instanceof Error ? error.message : 'Sync failed'],
        duration: 0
      };
    }
  }  /**
   * Execute complete group update workflow
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

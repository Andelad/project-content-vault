/**
 * Group Orchestrator
 * 
 * Orchestrates complex group management workflows.
 * Handles validation, business rules, and database operations.
 * 
 * Phase 2 Simplification:
 * ✅ Direct Supabase access (no repository wrapper)
 * ✅ Business rule validation
 * ✅ Workflow coordination
 */

import { Group } from '@/types/core';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { calculateGroupStatistics } from '@/services/calculations';

type GroupRow = Database['public']['Tables']['groups']['Row'];
type GroupInsert = Database['public']['Tables']['groups']['Insert'];
type GroupUpdate = Database['public']['Tables']['groups']['Update'];

// =====================================================================================
// DATABASE HELPERS (inline - no repository layer)
// =====================================================================================

function transformFromDatabase(dbGroup: GroupRow): Group {
  return {
    id: dbGroup.id,
    name: dbGroup.name,
    color: dbGroup.color,
    description: dbGroup.description || undefined,
    userId: dbGroup.user_id,
    createdAt: new Date(dbGroup.created_at),
    updatedAt: new Date(dbGroup.updated_at)
  };
}

function transformToDatabase(group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): GroupInsert {
  return {
    name: group.name,
    color: group.color,
    description: group.description || null,
    user_id: group.userId
  };
}

function transformUpdateToDatabase(updates: Partial<Group>): GroupUpdate {
  const dbUpdates: GroupUpdate = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.description !== undefined) dbUpdates.description = updates.description || null;
  dbUpdates.updated_at = new Date().toISOString();
  return dbUpdates;
}

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

      // Step 2: Check name uniqueness (inline database check)
      const { data: existingGroups, error: checkError } = await supabase
        .from('groups')
        .select('id')
        .eq('user_id', userId)
        .eq('name', request.name.trim());

      if (checkError) throw checkError;
      
      if (existingGroups && existingGroups.length > 0) {
        return {
          success: false,
          errors: ['A group with this name already exists'],
          warnings: validation.warnings
        };
      }

      // Step 3: Prepare group data following AI Development Rules
      const preparedGroup = this.prepareGroupForCreation(request);

      // Step 4: Create group (direct database call)
      const groupToCreate: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> = {
        name: preparedGroup.name,
        description: preparedGroup.description || '',
        color: preparedGroup.color,
        userId: userId
      };
      
      const dbData = transformToDatabase(groupToCreate);
      const { data: createdData, error: createError } = await supabase
        .from('groups')
        .insert(dbData)
        .select()
        .single();

      if (createError) throw createError;
      if (!createdData) {
        return {
          success: false,
          errors: ['Group creation failed - no group returned']
        };
      }

      const createdGroup = transformFromDatabase(createdData);

      return {
        success: true,
        group: createdGroup,
        warnings: validation.warnings,
        metadata: {
          fromCache: false,
          offlineMode: false,
          syncPending: false
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
      // Step 1: Get current group (direct database call)
      const { data: currentData, error: fetchError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', request.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      if (!currentData) {
        return {
          success: false,
          errors: ['Group not found']
        };
      }

      const currentGroup = transformFromDatabase(currentData);

      // Step 2: Validate updates
      const validation = this.validateGroupUpdate(request, currentGroup);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Step 3: Check name uniqueness if name is changing (inline database check)
      if (request.name && request.name !== currentGroup.name) {
        const { data: duplicates, error: checkError } = await supabase
          .from('groups')
          .select('id')
          .eq('user_id', userId)
          .eq('name', request.name.trim())
          .neq('id', request.id);

        if (checkError) throw checkError;
        
        if (duplicates && duplicates.length > 0) {
          return {
            success: false,
            errors: ['A group with this name already exists'],
            warnings: validation.warnings
          };
        }
      }

      // Step 4: Prepare group data
      const preparedUpdate = this.prepareGroupForUpdate(request);

      // Step 5: Update group (direct database call)
      const updatedData: Partial<Group> = {};
      if (preparedUpdate.name !== undefined) updatedData.name = preparedUpdate.name;
      if (preparedUpdate.description !== undefined) updatedData.description = preparedUpdate.description;
      if (preparedUpdate.color !== undefined) updatedData.color = preparedUpdate.color;

      const dbUpdates = transformUpdateToDatabase(updatedData);
      const { data: updatedDbData, error: updateError } = await supabase
        .from('groups')
        .update(dbUpdates)
        .eq('id', request.id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (!updatedDbData) {
        return {
          success: false,
          errors: ['Group update failed - no group returned']
        };
      }

      const updatedGroup = transformFromDatabase(updatedDbData);

      return {
        success: true,
        group: updatedGroup,
        warnings: validation.warnings,
        metadata: {
          fromCache: false,
          offlineMode: false,
          syncPending: false
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
   * Get user's groups
   */
  static async getUserGroupsWorkflow(userId: string): Promise<GroupOperationResult & { groups?: Group[] }> {
    try {
      // Direct database call
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      
      const groups = (data || []).map(transformFromDatabase);
      
      return {
        success: true,
        groups,
        metadata: {
          fromCache: false,
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
   * Delete group with relationship validation
   */
  static async executeGroupDeletionWorkflow(
    groupId: string,
    userId: string,
    projectCount: number = 0
  ): Promise<GroupOperationResult> {
    try {
      // Step 1: Get current group (direct database call)
      const { data: currentData, error: fetchError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      if (!currentData) {
        return {
          success: false,
          errors: ['Group not found']
        };
      }

      const currentGroup = transformFromDatabase(currentData);

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

      // Step 3: Delete group (direct database call)
      const { error: deleteError } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (deleteError) throw deleteError;

      return {
        success: true,
        warnings: validation.warnings,
        metadata: {
          fromCache: false,
          offlineMode: false,
          syncPending: false
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
    // Repository sync is handled automatically - this method is kept for API compatibility
    return {
      success: true,
      syncedCount: 0,
      errors: [],
      duration: 0
    };
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
    // Delegate to calculation function
    return calculateGroupStatistics(group, projects);
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

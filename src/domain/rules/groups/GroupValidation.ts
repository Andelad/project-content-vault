/**
 * Group Validation Rules
 * 
 * Business rules for validating group operations:
 * - Group creation/update validation
 * - Group deletion constraints
 * - System group protection
 * - Project membership validation
 * 
 * Part of three-layer architecture:
 * - domain/rules/groups/GroupValidation.ts (THIS FILE - validation rules)
 * - domain/rules/groups/GroupCalculations.ts (statistics & calculations)
 * - services/orchestrators/GroupOrchestrator.ts (workflow coordination)
 */

import type { Group, Project } from '@/types/core';

export interface GroupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Group Validation Rules
 * Pure business logic for group validation
 */
export class GroupValidationRules {
  
  /**
   * System group IDs that have special protection
   */
  private static readonly SYSTEM_GROUP_IDS = ['work-group', 'home-group'];

  /**
   * RULE 1: Validate group name
   * 
   * Business Logic:
   * - Name must not be empty
   * - Name must not exceed 100 characters
   * - Name should be meaningful
   * 
   * @param name - Group name to validate
   * @returns Validation result
   */
  static validateGroupName(name: string | undefined): {
    isValid: boolean;
    error?: string;
  } {
    if (name === undefined) {
      return { isValid: true }; // Optional field
    }

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      return {
        isValid: false,
        error: 'Group name cannot be empty'
      };
    }

    if (trimmedName.length > 100) {
      return {
        isValid: false,
        error: 'Group name cannot exceed 100 characters'
      };
    }

    return { isValid: true };
  }

  /**
   * RULE 2: Check if group is a system group
   * 
   * Business Logic:
   * System groups (work-group, home-group) have special protection
   * and should not be deleted or renamed
   * 
   * @param groupId - Group ID to check
   * @returns true if group is a system group
   */
  static isSystemGroup(groupId: string): boolean {
    return this.SYSTEM_GROUP_IDS.includes(groupId);
  }

  /**
   * RULE 3: Validate group update
   * 
   * Business Logic:
   * - Group ID is required
   * - Name validation if name is being updated
   * - Warn if modifying system group names
   * 
   * @param groupId - ID of group being updated
   * @param name - New name (if being updated)
   * @param currentGroup - Current group data
   * @returns Validation result
   */
  static validateGroupUpdate(
    groupId: string | undefined,
    name: string | undefined,
    currentGroup: Group
  ): GroupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate ID
    if (!groupId || groupId.trim().length === 0) {
      errors.push('Group ID is required for updates');
    }

    // Validate name if provided
    const nameValidation = this.validateGroupName(name);
    if (!nameValidation.isValid && nameValidation.error) {
      errors.push(nameValidation.error);
    }

    // Business rule: Warn about modifying system groups
    if (this.isSystemGroup(currentGroup.id) && name && name !== currentGroup.name) {
      warnings.push('Modifying system group names may affect default workflows');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * RULE 4: Validate group deletion
   * 
   * Business Logic:
   * - System groups cannot be deleted
   * - Warn about projects that will be affected
   * 
   * @param group - Group to delete
   * @param projects - Projects to check for membership
   * @returns Validation result
   */
  static validateGroupDeletion(
    group: Group,
    projects: Project[] = []
  ): GroupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Business rule: Cannot delete system groups
    if (this.isSystemGroup(group.id)) {
      errors.push('System groups cannot be deleted');
    }

    // Business rule: Warn about projects in group
    const groupProjects = projects.filter(p => p.groupId === group.id);
    if (groupProjects.length > 0) {
      warnings.push(
        `Deleting this group will affect ${groupProjects.length} project(s). ` +
        `They will need to be reassigned to another group.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * RULE 5: Check if project can be added to group
   * 
   * Business Logic:
   * - Group must exist
   * - Project must not already be in a different group (optional check)
   * 
   * @param groupId - Target group ID
   * @param projectId - Project to add
   * @param existingGroups - Available groups
   * @param currentProjectGroup - Project's current group ID (if any)
   * @returns Validation result
   */
  static canAddProjectToGroup(
    groupId: string,
    projectId: string,
    existingGroups: Group[],
    currentProjectGroup?: string
  ): {
    canAdd: boolean;
    error?: string;
    warning?: string;
  } {
    // Check if target group exists
    const targetGroup = existingGroups.find(g => g.id === groupId);
    if (!targetGroup) {
      return {
        canAdd: false,
        error: 'Target group does not exist'
      };
    }

    // Check if moving from another group
    if (currentProjectGroup && currentProjectGroup !== groupId) {
      return {
        canAdd: true,
        warning: `Project will be moved from current group to ${targetGroup.name}`
      };
    }

    return { canAdd: true };
  }

  /**
   * RULE 6: Validate group membership consistency
   * 
   * Business Logic:
   * - All projects should belong to a valid group
   * - No orphaned projects
   * 
   * @param projects - Projects to validate
   * @param groups - Available groups
   * @returns Validation result with orphaned projects
   */
  static validateGroupMembership(
    projects: Project[],
    groups: Group[]
  ): {
    isValid: boolean;
    orphanedProjects: Project[];
    errors: string[];
  } {
    const groupIds = new Set(groups.map(g => g.id));
    const orphanedProjects = projects.filter(p => p.groupId && !groupIds.has(p.groupId));

    const errors: string[] = [];
    if (orphanedProjects.length > 0) {
      errors.push(
        `${orphanedProjects.length} project(s) belong to non-existent groups`
      );
    }

    return {
      isValid: orphanedProjects.length === 0,
      orphanedProjects,
      errors
    };
  }
}

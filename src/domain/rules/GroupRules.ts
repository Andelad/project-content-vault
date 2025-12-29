/**
 * Group Business Rules
 *
 * Single source of truth for all group-related business logic.
 * Defines validation, constraints, and business rules for group entities.
 *
 * This is the domain layer - pure business logic with no external dependencies.
 *
 * @see docs/core/App Logic.md#5-group for complete group documentation
 * @see docs/core/Business Logic.md for business rules
 */

import type { Group } from '@/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GroupValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// GROUP BUSINESS RULES
// ============================================================================

/**
 * Group Business Rules
 *
 * Centralized location for all group-related business logic.
 */
export class GroupRules {

  // ==========================================================================
  // RULE 1: GROUP NAME VALIDATION
  // ==========================================================================

  /**
   * RULE 1: Group name must be valid
   *
   * Business Logic: Group names must be non-empty and reasonable length
   *
   * @param name - The group name to validate
   * @returns true if name is valid, false otherwise
   */
  static validateGroupName(name: string): boolean {
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length <= 100;
  }

  // ==========================================================================
  // RULE 2: GROUP NAME NORMALIZATION
  // ==========================================================================

  /**
   * RULE 2: Normalize group name for consistency
   *
   * Business Logic: Groups are unique by case-insensitive name per user
   *
   * @param name - The group name to normalize
   * @returns Normalized group name (lowercase, trimmed)
   */
  static normalizeGroupName(name: string): string {
    return name.trim().toLowerCase();
  }

  /**
   * RULE 3: Check if two group names are equivalent
   *
   * Business Logic: Case-insensitive comparison for duplicate detection
   *
   * @param name1 - First group name
   * @param name2 - Second group name
   * @returns true if names are equivalent
   */
  static areGroupNamesEquivalent(name1: string, name2: string): boolean {
    return this.normalizeGroupName(name1) === this.normalizeGroupName(name2);
  }

  // ==========================================================================
  // RULE 4: GROUP UNIQUENESS VALIDATION
  // ==========================================================================

  /**
   * RULE 4: Group names must be unique per user (case-insensitive)
   *
   * Business Logic: Prevents duplicate group names for the same user
   *
   * @param name - The group name to check
   * @param existingGroups - All groups for the user
   * @param currentGroupId - ID of group being edited (optional, for updates)
   * @returns Validation result
   */
  static validateGroupUniqueness(
    name: string,
    existingGroups: Group[],
    currentGroupId?: string
  ): GroupValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const normalizedName = this.normalizeGroupName(name);

    // Check for duplicates
    const duplicate = existingGroups.find(
      g => this.normalizeGroupName(g.name) === normalizedName && g.id !== currentGroupId
    );

    if (duplicate) {
      errors.push(`Group "${duplicate.name}" already exists (names are case-insensitive)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 5: COMPREHENSIVE GROUP VALIDATION
  // ==========================================================================

  /**
   * RULE 5: Validate all group properties
   *
   * Combines all validation rules for a complete check
   *
   * @param name - Group name
   * @param existingGroups - All groups for the user
   * @param currentGroupId - ID of group being edited (optional)
   * @returns Validation result
   */
  static validateGroup(
    name: string,
    existingGroups: Group[],
    currentGroupId?: string
  ): GroupValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: Name must be valid
    if (!this.validateGroupName(name)) {
      errors.push('Group name must be between 1 and 100 characters');
    }

    // Rule 4: Name must be unique (only if name is valid)
    if (errors.length === 0) {
      const uniquenessCheck = this.validateGroupUniqueness(name, existingGroups, currentGroupId);
      errors.push(...uniquenessCheck.errors);
      warnings.push(...uniquenessCheck.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 6: GROUP DELETION CONSTRAINTS
  // ==========================================================================

  /**
   * RULE 6: Groups can be deleted (projects will be orphaned/cascade)
   *
   * Business Logic: Groups can be deleted, but consider projects
   * 
   * Note: Actual cascade/orphan behavior depends on database constraints
   * This rule just provides guidance
   *
   * @param groupId - The group to check
   * @param projectCount - Number of projects in this group
   * @returns Validation result with warnings
   */
  static canDeleteGroup(groupId: string, projectCount: number): GroupValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (projectCount > 0) {
      warnings.push(
        `This group contains ${projectCount} project${projectCount > 1 ? 's' : ''}. ` +
        'Deleting the group may orphan these projects.'
      );
    }

    return {
      isValid: true, // Can delete, but with warning
      errors,
      warnings
    };
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Find a group by name (case-insensitive)
   *
   * @param name - Group name to search for
   * @param groups - Groups to search in
   * @returns Found group or undefined
   */
  static findGroupByName(name: string, groups: Group[]): Group | undefined {
    const normalizedName = this.normalizeGroupName(name);
    return groups.find(g => this.normalizeGroupName(g.name) === normalizedName);
  }

  /**
   * Get suggested name if duplicate exists
   *
   * @param name - Desired group name
   * @param existingGroups - Existing groups
   * @returns Suggested unique name (e.g., "Work 2")
   */
  static suggestUniqueName(name: string, existingGroups: Group[]): string {
    const baseName = name.trim();
    let counter = 2;
    let suggestedName = baseName;

    while (this.findGroupByName(suggestedName, existingGroups)) {
      suggestedName = `${baseName} ${counter}`;
      counter++;
    }

    return suggestedName;
  }
}

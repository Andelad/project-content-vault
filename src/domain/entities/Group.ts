/**
 * Group Domain Entity
 * 
 * Represents a primary way to organize projects by life area.
 * Examples: "Work", "Personal", "Health & Fitness"
 * 
 * This is a RICH DOMAIN MODEL - state + behavior together.
 * 
 * @see docs/core/App Logic.md#5-group - Entity definition
 * @see docs/core/Business Logic.md - Detailed business rules
 */

import type { Group as GroupData } from '@/types/core';
import type { DomainResult } from './Project';

/**
 * Group creation parameters
 */
export interface CreateGroupParams {
  name: string;
  userId: string;
}

/**
 * Group update parameters
 */
export interface UpdateGroupParams {
  name?: string;
}

/**
 * Group Domain Entity
 * 
 * Enforces business invariants and encapsulates group behavior.
 * Cannot be created in an invalid state.
 * 
 * Key Rules:
 * 1. Group name must be unique per user (case-insensitive)
 * 2. Group name must be between 1 and 100 characters
 */
export class Group {
  // Immutable core properties
  private readonly id: string;
  private readonly userId: string;
  private readonly createdAt: Date;
  
  // Mutable business properties
  private name: string;
  private updatedAt: Date;

  private constructor(data: GroupData) {
    // Direct assignment - validation happens in factory methods
    this.id = data.id;
    this.userId = data.userId;
    this.name = data.name;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
  }

  // ============================================================================
  // FACTORY METHODS - Enforce invariants at creation
  // ============================================================================

  /**
   * Create a new group (not yet persisted)
   * 
   * Validates all business rules before construction.
   * Cannot create an invalid group.
   * 
   * Note: Uniqueness check must be done by orchestrator/repository
   * as it requires database access.
   * 
   * @param params - Group creation parameters
   * @returns Result with group or validation errors
   */
  static create(params: CreateGroupParams): DomainResult<Group> {
    const errors: string[] = [];

    // RULE 1: Group name must be valid
    const trimmedName = params.name.trim();
    if (trimmedName.length === 0) {
      errors.push('Group name is required');
    } else if (trimmedName.length > 100) {
      errors.push('Group name must be 100 characters or less');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const groupData: GroupData = {
      id: crypto.randomUUID(),
      name: trimmedName,
      userId: params.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return {
      success: true,
      data: new Group(groupData)
    };
  }

  /**
   * Reconstitute a group from database data
   * 
   * Use this when loading existing groups from the database.
   * Assumes data is already valid (was validated on creation).
   * 
   * @param data - Group data from database
   * @returns Group entity
   */
  static fromDatabase(data: GroupData): Group {
    return new Group(data);
  }

  // ============================================================================
  // BUSINESS OPERATIONS
  // ============================================================================

  /**
   * Update group details
   * 
   * Validates all business rules before applying changes.
   * 
   * Note: Uniqueness check must be done by orchestrator/repository
   * as it requires database access.
   * 
   * @param params - Fields to update
   * @returns Result with updated state or validation errors
   */
  update(params: UpdateGroupParams): DomainResult<void> {
    const errors: string[] = [];

    // Validate name if provided
    if (params.name !== undefined) {
      const trimmedName = params.name.trim();
      if (trimmedName.length === 0) {
        errors.push('Group name is required');
      } else if (trimmedName.length > 100) {
        errors.push('Group name must be 100 characters or less');
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply updates
    if (params.name !== undefined) {
      this.name = params.name.trim();
      this.updatedAt = new Date();
    }

    return { success: true };
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Get normalized name for uniqueness comparison
   * Groups are unique by case-insensitive name
   */
  getNormalizedName(): string {
    return this.name.toLowerCase();
  }

  /**
   * Check if this group matches a name (case-insensitive)
   * 
   * @param name - Name to compare
   * @returns True if names match (case-insensitive)
   */
  matchesName(name: string): boolean {
    return this.getNormalizedName() === name.toLowerCase().trim();
  }

  // ============================================================================
  // DATA CONVERSION - For persistence layer
  // ============================================================================

  /**
   * Convert to plain data object for database persistence
   * 
   * @returns Plain group data object
   */
  toData(): GroupData {
    return {
      id: this.id,
      name: this.name,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // ============================================================================
  // GETTERS - Read-only access to properties
  // ============================================================================

  getId(): string { return this.id; }
  getName(): string { return this.name; }
  getUserId(): string { return this.userId; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }
}

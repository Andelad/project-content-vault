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

import type { Group as GroupData } from '@/shared/types/core';
import type { Database } from '@/infrastructure/database/types';
import type { DomainResult } from './Project';

type GroupRow = Database['public']['Tables']['groups']['Row'];

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
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _createdAt: Date;
  
  // Mutable business properties
  private _name: string;
  private _updatedAt: Date;

  // ============================================================================
  // PUBLIC GETTERS - Backward compatibility for migration (Phase 2a)
  // ============================================================================
  
  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get name(): string { return this._name; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  private constructor(data: GroupData) {
    // Direct assignment - validation happens in factory methods
    this._id = data.id;
    this._userId = data.userId;
    this._name = data.name;
    this._createdAt = new Date(data.createdAt);
    this._updatedAt = new Date(data.updatedAt);
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
   * @param data - Group data from database (snake_case)
   * @returns Group entity
   */
  static fromDatabase(data: GroupRow): Group {
    // Convert database format (snake_case) to entity format (camelCase)
    const groupData: GroupData = {
      id: data.id,
      name: data.name,
      userId: data.user_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
    return new Group(groupData);
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
      this._name = params.name.trim();
      this._updatedAt = new Date();
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
    return this._name.toLowerCase();
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
      id: this._id,
      name: this._name,
      userId: this._userId,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
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

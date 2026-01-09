/**
 * Label Domain Entity
 * 
 * Represents flexible tags for categorizing projects.
 * Examples: "#urgent", "#q1-2026", "#pro-bono"
 * 
 * This is a RICH DOMAIN MODEL - state + behavior together.
 * 
 * @see docs/core/App Logic.md#6-label - Entity definition
 * @see docs/core/Business Logic.md - Detailed business rules
 */

import type { Label as LabelData } from '@/shared/types/core';
import type { Database } from '@/infrastructure/database/types';
import type { DomainResult } from './Project';

type LabelRow = Database['public']['Tables']['labels']['Row'];

/**
 * Label creation parameters
 */
export interface CreateLabelParams {
  name: string;
  color?: string;
  userId: string;
}

/**
 * Label update parameters
 */
export interface UpdateLabelParams {
  name?: string;
  color?: string;
}

/**
 * Label Domain Entity
 * 
 * Enforces business invariants and encapsulates label behavior.
 * Cannot be created in an invalid state.
 * 
 * Key Rules:
 * 1. Label name must be unique per user (case-insensitive)
 * 2. Label name must be between 1 and 100 characters
 * 3. Color is optional, validated if provided
 */
export class Label {
  // Immutable core properties
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _createdAt: Date;
  
  // Mutable business properties
  private _name: string;
  private _color?: string;
  private _updatedAt: Date;

  // ============================================================================
  // PUBLIC GETTERS - Backward compatibility for migration (Phase 2a)
  // ============================================================================
  
  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get name(): string { return this._name; }
  get color(): string | undefined { return this._color; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  private constructor(data: LabelData) {
    // Direct assignment - validation happens in factory methods
    this._id = data.id;
    this._userId = data.userId;
    this._name = data.name;
    this._color = data.color;
    this._createdAt = new Date(data.createdAt);
    this._updatedAt = new Date(data.updatedAt);
  }

  // ============================================================================
  // FACTORY METHODS - Enforce invariants at creation
  // ============================================================================

  /**
   * Create a new label (not yet persisted)
   * 
   * Validates all business rules before construction.
   * Cannot create an invalid label.
   * 
   * Note: Uniqueness check must be done by orchestrator/repository
   * as it requires database access.
   * 
   * @param params - Label creation parameters
   * @returns Result with label or validation errors
   */
  static create(params: CreateLabelParams): DomainResult<Label> {
    const errors: string[] = [];

    // RULE 1: Label name must be valid
    const trimmedName = params.name.trim();
    if (trimmedName.length === 0) {
      errors.push('Label name is required');
    } else if (trimmedName.length > 100) {
      errors.push('Label name must be 100 characters or less');
    }

    // RULE 2: Color must be valid hex format (if provided)
    if (params.color && !this.isValidColor(params.color)) {
      errors.push('Label color must be a valid hex color (e.g., #FF5733)');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const labelData: LabelData = {
      id: crypto.randomUUID(),
      name: trimmedName,
      color: params.color?.trim(),
      userId: params.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return {
      success: true,
      data: new Label(labelData)
    };
  }

  /**
   * Reconstitute a label from database data
   * 
   * Use this when loading existing labels from the database.
   * Assumes data is already valid (was validated on creation).
   * 
   * @param data - Label data from database (snake_case)
   * @returns Label entity
   */
  static fromDatabase(data: LabelRow): Label {
    // Convert database format (snake_case) to entity format (camelCase)
    const labelData: LabelData = {
      id: data.id,
      name: data.name,
      color: data.color,
      userId: data.user_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
    return new Label(labelData);
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Validate hex color format
   * 
   * @param color - Color string to validate
   * @returns True if valid hex color
   */
  private static isValidColor(color: string): boolean {
    // Accepts #RGB or #RRGGBB format
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color.trim());
  }

  // ============================================================================
  // BUSINESS OPERATIONS
  // ============================================================================

  /**
   * Update label details
   * 
   * Validates all business rules before applying changes.
   * 
   * Note: Uniqueness check must be done by orchestrator/repository
   * as it requires database access.
   * 
   * @param params - Fields to update
   * @returns Result with updated state or validation errors
   */
  update(params: UpdateLabelParams): DomainResult<void> {
    const errors: string[] = [];

    // Validate name if provided
    if (params.name !== undefined) {
      const trimmedName = params.name.trim();
      if (trimmedName.length === 0) {
        errors.push('Label name is required');
      } else if (trimmedName.length > 100) {
        errors.push('Label name must be 100 characters or less');
      }
    }

    // Validate color if provided
    if (params.color !== undefined && params.color && !Label.isValidColor(params.color)) {
      errors.push('Label color must be a valid hex color (e.g., #FF5733)');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply updates
    if (params.name !== undefined) {
      this._name = params.name.trim();
    }
    if (params.color !== undefined) {
      this._color = params.color?.trim();
    }
    this._updatedAt = new Date();

    return { success: true };
  }

  /**
   * Remove color from label
   */
  removeColor(): void {
    this._color = undefined;
    this._updatedAt = new Date();
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Get normalized name for uniqueness comparison
   * Labels are unique by case-insensitive name
   */
  getNormalizedName(): string {
    return this._name.toLowerCase();
  }

  /**
   * Check if this label matches a name (case-insensitive)
   * 
   * @param name - Name to compare
   * @returns True if names match (case-insensitive)
   */
  matchesName(name: string): boolean {
    return this.getNormalizedName() === name.toLowerCase().trim();
  }

  /**
   * Check if label has a color assigned
   */
  hasColor(): boolean {
    return !!this._color;
  }

  /**
   * Get display name (with optional # prefix convention)
   */
  getDisplayName(): string {
    return this._name.startsWith('#') ? this._name : `#${this._name}`;
  }

  // ============================================================================
  // DATA CONVERSION - For persistence layer
  // ============================================================================

  /**
   * Convert to plain data object for database persistence
   * 
   * @returns Plain label data object
   */
  toData(): LabelData {
    return {
      id: this._id,
      name: this._name,
      color: this._color,
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
  getColor(): string | undefined { return this.color; }
  getUserId(): string { return this.userId; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }
}
